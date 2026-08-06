/**
 * Sélection des trades envoyés à l'IA d'analyse, et comptage déterministe des
 * violations mécaniques.
 *
 * POURQUOI — /api/analyze envoyait jusqu'à 500 trades bruts à Sonnet 5 (145 000
 * tokens mesurés) et demandait au modèle de compter lui-même les violations.
 * Deux problèmes :
 *
 *  1. le coût : 0,62 € par analyse, soit plus que la marge du plan sur un usage
 *     soutenu ;
 *  2. la justesse : compter « combien de trades hors session » sur 500 lignes
 *     est exactement le genre de tâche où un LLM dérape, alors que la règle est
 *     mécanique et vérifiable en TypeScript.
 *
 * On inverse donc les rôles. Le serveur compte ce qui se compte (règles de la
 * stratégie), le modèle fait ce qu'il sait faire (expliquer, relier, prioriser)
 * sur un échantillon de trades PORTEURS DE PREUVE plutôt que sur tout le lot.
 *
 * Les index renvoyés sont ceux du tableau d'origine : `trade_reviews[].trade_id`
 * continue de désigner le bon trade côté client.
 */

import { calculatePips, getTradeResult } from "@/lib/pips";

export interface SelectionTrade {
  open_time: string;
  close_time: string;
  pair: string;
  direction: string;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  sl_initial?: number | null;
  tp_initial?: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  ict_setup?: string | null;
  emotion?: string | null;
  vision_review?: { grade?: string } | null;
}

export interface SelectionStrategy {
  pairs: string[];
  sessions: string[];
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
}

/** Violations dont la règle est mécanique : le serveur les compte, pas le modèle. */
export type MechanicalViolationType =
  | "wrong_pair"
  | "wrong_session"
  | "low_rr"
  | "sl_too_wide"
  | "missing_sl"
  | "missing_tp"
  | "max_trades_day"
  | "consecutive_losses";

export interface MechanicalViolation {
  category: "strategy" | "execution";
  type: MechanicalViolationType;
  /** Index (dans le tableau d'origine) des trades concernés, plafonné à l'affichage. */
  trade_ids: number[];
  /** Nombre de trades pour les règles par trade, de jours/événements sinon. */
  occurrences: number;
}

const CATEGORY: Record<MechanicalViolationType, "strategy" | "execution"> = {
  wrong_pair: "strategy",
  wrong_session: "strategy",
  low_rr: "strategy",
  sl_too_wide: "strategy",
  max_trades_day: "strategy",
  consecutive_losses: "strategy",
  missing_sl: "execution",
  missing_tp: "execution",
};

/** Fenêtres UTC des sessions, alignées sur SESSION_MAP de la route d'analyse. */
const SESSION_WINDOWS: Record<string, [number, number]> = {
  london: [8, 12],
  new_york: [13, 17],
  asian: [0, 6],
  london_ny_overlap: [13, 16],
};

export function netPnl(t: SelectionTrade): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** Normalise une paire pour comparaison ("eur/usd" et "EURUSD" sont la même). */
function normPair(p: string): string {
  return p.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function utcHour(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? -1 : d.getUTCHours();
}

/** Jour calendaire UTC ("2026-08-06") — sert au comptage par jour. */
function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Compte les violations mécaniques sur l'INTÉGRALITÉ des trades.
 *
 * Une règle non définie dans la stratégie n'est jamais vérifiée : c'est la même
 * convention que le prompt (« valeur Non défini → NE PAS vérifier cette règle »).
 */
export function computeMechanicalViolations(
  trades: SelectionTrade[],
  strategy: SelectionStrategy,
): MechanicalViolation[] {
  const hits: Record<string, number[]> = {};
  const add = (type: MechanicalViolationType, idx: number) => {
    (hits[type] ??= []).push(idx);
  };

  const allowedPairs = strategy.pairs.map(normPair).filter(Boolean);
  const windows = strategy.sessions.map((s) => SESSION_WINDOWS[s]).filter(Boolean);

  trades.forEach((t, idx) => {
    // Paire hors périmètre (seulement si le trader a listé ses paires).
    if (allowedPairs.length > 0 && !allowedPairs.includes(normPair(t.pair))) {
      add("wrong_pair", idx);
    }

    // Hors session (seulement si des sessions sont définies et reconnues).
    if (windows.length > 0) {
      const h = utcHour(t.open_time);
      if (h >= 0 && !windows.some(([start, end]) => h >= start && h < end)) {
        add("wrong_session", idx);
      }
    }

    // SL/TP absents. On regarde le SL initial s'il est renseigné : un SL déplacé
    // au BE ne doit pas être compté comme « pas de SL ».
    const sl = t.sl_initial ?? t.sl;
    const tp = t.tp_initial ?? t.tp;
    if (sl == null) add("missing_sl", idx);
    if (tp == null) add("missing_tp", idx);

    // RR planifié et largeur du SL : calculés sur les mêmes pips que le prompt.
    if (sl != null) {
      const riskPips = calculatePips(t.pair, t.entry_price, sl);
      if (riskPips > 0) {
        if (strategy.max_sl_pips != null && riskPips > strategy.max_sl_pips) {
          add("sl_too_wide", idx);
        }
        if (strategy.risk_reward != null && tp != null) {
          const rewardPips = calculatePips(t.pair, t.entry_price, tp);
          if (rewardPips > 0 && rewardPips / riskPips < strategy.risk_reward) {
            add("low_rr", idx);
          }
        }
      }
    }
  });

  const out: MechanicalViolation[] = [];
  for (const [type, ids] of Object.entries(hits)) {
    out.push({
      category: CATEGORY[type as MechanicalViolationType],
      type: type as MechanicalViolationType,
      trade_ids: ids.slice(0, 20),
      occurrences: ids.length,
    });
  }

  // ── Règles par jour / par série ───────────────────────────────────────────
  if (strategy.max_trades_per_day != null && strategy.max_trades_per_day > 0) {
    const perDay = new Map<string, number[]>();
    trades.forEach((t, idx) => {
      const d = utcDay(t.open_time);
      const bucket = perDay.get(d);
      if (bucket) bucket.push(idx);
      else perDay.set(d, [idx]);
    });
    const offendingDays: number[] = [];
    let days = 0;
    for (const idxs of Array.from(perDay.values())) {
      if (idxs.length > strategy.max_trades_per_day) {
        days++;
        offendingDays.push(...idxs.slice(strategy.max_trades_per_day));
      }
    }
    if (days > 0) {
      out.push({ category: "strategy", type: "max_trades_day", trade_ids: offendingDays.slice(0, 20), occurrences: days });
    }
  }

  if (strategy.max_consecutive_losses != null && strategy.max_consecutive_losses > 0) {
    const chrono = trades
      .map((t, idx) => ({ idx, at: new Date(t.open_time).getTime(), net: netPnl(t) }))
      .sort((a, b) => a.at - b.at);
    let streak = 0;
    let events = 0;
    const offenders: number[] = [];
    for (const t of chrono) {
      // Même convention de « perte » que partout ailleurs dans l'app : un trade
      // quasi nul est un breakeven, il ne prolonge pas une série perdante.
      if (getTradeResult(t.net) === "loss") {
        streak++;
        // Chaque trade pris AU-DELÀ du seuil est une continuation fautive.
        if (streak > strategy.max_consecutive_losses) {
          events++;
          offenders.push(t.idx);
        }
      } else {
        streak = 0;
      }
    }
    if (events > 0) {
      out.push({ category: "strategy", type: "consecutive_losses", trade_ids: offenders.slice(0, 20), occurrences: events });
    }
  }

  return out;
}

export interface SelectionResult {
  /** Index des trades à détailler intégralement dans le prompt. */
  indices: number[];
  /** Pourquoi chaque trade a été retenu (utile au prompt et au debug). */
  reasons: Record<number, string[]>;
}

/**
 * Choisit les trades à envoyer en entier. On garde ce qui porte une PREUVE ou
 * un ENSEIGNEMENT, pas un échantillon au hasard :
 *
 *  - les trades qui enfreignent une règle (ce sont les pièces à conviction) ;
 *  - les pires et les meilleurs résultats (les cas à commenter) ;
 *  - les trades ouverts moins de 30 min après une perte (revenge trading) ;
 *  - ceux dont le graphique a déjà été lu par la vision IA ;
 *  - les trades sans setup renseigné, plafonnés (inutile d'en envoyer 200).
 */
export function selectSignificantTrades(
  trades: SelectionTrade[],
  violations: MechanicalViolation[],
  max = 40,
): SelectionResult {
  const reasons: Record<number, string[]> = {};
  const mark = (idx: number, why: string) => {
    if (idx < 0 || idx >= trades.length) return;
    (reasons[idx] ??= []).push(why);
  };

  for (const v of violations) for (const idx of v.trade_ids) mark(idx, v.type);

  const byNet = trades.map((t, idx) => ({ idx, net: netPnl(t) })).sort((a, b) => a.net - b.net);
  byNet.slice(0, 8).forEach((t) => mark(t.idx, "pire_resultat"));
  byNet.slice(-5).forEach((t) => mark(t.idx, "meilleur_resultat"));

  // Revenge : ouverture < 30 min après la clôture d'un trade perdant.
  const chrono = trades
    .map((t, idx) => ({ idx, open: new Date(t.open_time).getTime(), close: new Date(t.close_time).getTime(), net: netPnl(t) }))
    .filter((t) => !Number.isNaN(t.open))
    .sort((a, b) => a.open - b.open);
  for (let i = 1; i < chrono.length; i++) {
    const prev = chrono[i - 1];
    if (getTradeResult(prev.net) === "loss" && !Number.isNaN(prev.close) && chrono[i].open - prev.close < 30 * 60 * 1000) {
      mark(chrono[i].idx, "moins_30min_apres_perte");
    }
  }

  trades.forEach((t, idx) => {
    if (t.vision_review?.grade) mark(idx, "analyse_visuelle_disponible");
  });

  // Trades sans setup : on en envoie quelques-uns pour illustrer, le COMPTE
  // exact est de toute façon fourni au modèle dans les statistiques.
  const sansSetup = trades.map((t, idx) => ({ t, idx })).filter(({ t }) => !t.ict_setup);
  sansSetup.slice(0, 3).forEach(({ idx }) => mark(idx, "sans_setup"));

  // Priorité : plus un trade cumule de raisons, plus il est instructif.
  const indices = Object.keys(reasons)
    .map(Number)
    .sort((a, b) => {
      const d = reasons[b].length - reasons[a].length;
      if (d !== 0) return d;
      return Math.abs(netPnl(trades[b])) - Math.abs(netPnl(trades[a]));
    })
    .slice(0, max)
    .sort((a, b) => a - b); // remis dans l'ordre chronologique du tableau

  return { indices, reasons };
}

/** Rend les violations mécaniques en bloc de faits pour le prompt. */
export function renderMechanicalBlock(violations: MechanicalViolation[], total: number): string {
  if (violations.length === 0) {
    return `Aucune violation mécanique détectée sur les ${total} trades de la période.`;
  }
  const label: Record<MechanicalViolationType, string> = {
    wrong_pair: "paire non autorisée",
    wrong_session: "hors session autorisée",
    low_rr: "RR planifié sous le minimum",
    sl_too_wide: "SL au-delà du maximum",
    missing_sl: "aucun SL",
    missing_tp: "aucun TP",
    max_trades_day: "dépassement du nb max de trades/jour",
    consecutive_losses: "trading poursuivi après N pertes consécutives",
  };
  const unit: Partial<Record<MechanicalViolationType, string>> = {
    max_trades_day: "jour(s)",
    consecutive_losses: "trade(s) de continuation",
  };
  return [
    `Comptage effectué par le serveur sur les ${total} trades de la période (exhaustif et exact) :`,
    ...violations.map(
      (v) =>
        `- ${v.type} (${label[v.type]}) : ${v.occurrences} ${unit[v.type] ?? "trade(s)"}` +
        (v.trade_ids.length ? ` — exemples d'index : ${v.trade_ids.slice(0, 10).join(", ")}` : ""),
    ),
  ].join("\n");
}
