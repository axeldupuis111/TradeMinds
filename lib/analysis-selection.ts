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

import { fenetreDeSession } from "@/lib/sessions-de-marche";
import { prixConnu } from "@/lib/prix-connu";
import { calculatePips, getTradeResult } from "@/lib/pips";
import { risqueEnPips } from "@/lib/risque-du-trade";
import {
  chiffreLePlusPermissif,
  perimetreEcrit,
  type FicheDuTrader,
} from "@/lib/regles-du-trader";

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
  /** Perte journalière maximale, en POURCENTAGE du capital du compte. */
  max_daily_loss: number | null;
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
  | "max_daily_loss"
  | "consecutive_losses";

export interface MechanicalViolation {
  category: "strategy" | "execution";
  type: MechanicalViolationType;
  /**
   * Index (dans le tableau d'origine) de TOUS les trades concernés.
   *
   * ⚠️⚠️ CETTE LISTE ÉTAIT PLAFONNÉE À VINGT, et trois mesures s'en servaient
   * comme si elle était complète : le coût de la violation, la courbe
   * contrefactuelle et le compte de trades conformes. Le plafond avait été posé
   * pour le prompt, qui n'en avait pas besoin : `renderMechanicalBlock` ne cite
   * déjà que DIX index à titre d'exemple.
   *
   * ⚠️ REJOUÉ SUR LES DONNÉES RÉELLES LE 2026-09-18 : sur une stratégie de
   * production, `missing_tp` compte 137 occurrences et ne citait que 20 index,
   * `missing_sl` 128 pour 20, `wrong_pair` 92 pour 20. Le coût annoncé
   * (« cette erreur t'a coûté X ») portait donc sur 15 % des trades fautifs, et
   * l'en-tête « N trades conformes » en comptait une centaine de trop.
   */
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
  max_daily_loss: "strategy",
  consecutive_losses: "strategy",
  missing_sl: "execution",
  missing_tp: "execution",
};

/**
 * ⚠️⚠️ LES FENÊTRES VIVENT AILLEURS, AVEC LE LIBELLÉ QUI LES ANNONCE. Cette
 * table existait ici, et le texte lu par le trader (« London (08:00–12:00
 * UTC) ») était recopié à la main dans trois autres fichiers. Rien n'obligeait
 * les quatre à rester d'accord : déplacer une fenêtre d'une heure laissait trois
 * écrans annoncer l'ancienne, et le trader se serait vu reprocher une règle que
 * le produit lui affiche autrement. Voir lib/sessions-de-marche.ts, où le
 * libellé est CONSTRUIT à partir de la fenêtre.
 */

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
  /**
   * Capital nominal du compte, seule référence permettant de convertir la
   * perte journalière maximale (exprimée en %) en montant. Absent, la règle
   * n'est pas vérifiée : mieux vaut ne rien compter que compter faux.
   */
  accountSize?: number | null,
  /**
   * LES AUTRES FICHES STRATÉGIE DU TRADER.
   *
   * ⚠️⚠️ L'ANALYSE JUGE TOUS LES TRADES CONTRE UNE SEULE FICHE, CHOISIE PAR
   * UN `.limit(1)` SANS TRI : la plus ancienne. Un trader qui écrit trois
   * fiches (une par instrument, ce que le produit encourage) voyait donc ses
   * trades NAS100 comptés « mauvaise paire » parce que la fiche retenue parle
   * d'or.
   *
   * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium, 157 trades sur cinq
   * instruments, TROIS fiches dont une « trendline nas100 » — et
   * 92 trades sur 157 comptés « mauvaise paire » contre la fiche « or ». Aucun
   * de ses trades n'est rattaché à une fiche. Sur une analyse payée, le
   * produit lui reprochait 92 fautes qu'il n'a pas commises.
   *
   * ⚠️ LE PÉRIMÈTRE ÉCRIT D'UN TRADER, C'EST L'UNION DE SES FICHES. On ne
   * reproche donc l'instrument ou l'horaire que s'ils sortent de TOUT ce qu'il
   * a écrit. C'est la règle déjà posée deux lignes plus bas : « on se tait
   * plutôt que de juger à moitié ».
   */
  autresFiches: FicheDuTrader[] = [],
): MechanicalViolation[] {
  const hits: Record<string, number[]> = {};
  const add = (type: MechanicalViolationType, idx: number) => {
    (hits[type] ??= []).push(idx);
  };

  /**
   * Le périmètre d'instruments écrit par le trader : l'union de ses fiches.
   * Une fiche sans liste de paires ne restreint rien, donc elle ouvre tout.
   */
  const fichesDInstruments: FicheDuTrader[] = [strategy, ...autresFiches];
  const allowedPairs = perimetreEcrit(fichesDInstruments) ?? [];
  /**
   * ⚠️⚠️ UNE SESSION NON RECONNUE FAISAIT JUGER SUR LA MOITIÉ DE LA RÈGLE. Le
   * `.filter(Boolean)` laissait tomber en silence les identifiants inconnus :
   * une stratégie déclarant « london » et « newyork » n'était plus jugée que
   * sur Londres, donc TOUT trade de la session américaine passait pour un
   * trade hors session.
   *
   * ⚠️ MESURÉ EN PRODUCTION le 2026-09-17 : la stratégie de DÉMONSTRATION
   * écrivait « newyork » là où tout le reste du produit écrit « new_york »,
   * et le rejeu des règles donnait 45 violations « hors session » sur ses
   * 53 trades. C'est la visite guidée du produit qui accusait son trader
   * fictif quatre fois sur cinq.
   *
   * ⚠️ ON SE TAIT PLUTÔT QUE DE JUGER À MOITIÉ : si un seul identifiant est
   * inconnu, on ne connaît pas l'ensemble des heures permises, donc on ne
   * peut rien reprocher. C'est déjà ce que faisait le code quand AUCUNE
   * session n'était reconnue ; il manquait le cas intermédiaire.
   */
  /**
   * ⚠️ LES CHIFFRES AUSSI SONT CEUX DE TOUTES SES FICHES. La fiche analysée
   * est choisie arbitrairement ; juger un trade sur SON ratio minimum ou SON
   * stop maximum, c'est lui appliquer une règle qu'il n'a peut-être pas écrite
   * pour ce trade-là. On retient donc le chiffre le plus permissif, et on se
   * tait dès qu'une fiche ne déclare pas la règle.
   */
  const toutes = fichesDInstruments;
  const regleDuTrader = {
    risk_reward: chiffreLePlusPermissif(toutes.map((f) => f.risk_reward), "plancher"),
    max_sl_pips: chiffreLePlusPermissif(toutes.map((f) => f.max_sl_pips), "plafond"),
    max_trades_per_day: chiffreLePlusPermissif(toutes.map((f) => f.max_trades_per_day), "plafond"),
    max_consecutive_losses: chiffreLePlusPermissif(toutes.map((f) => f.max_consecutive_losses), "plafond"),
    max_daily_loss: chiffreLePlusPermissif(toutes.map((f) => f.max_daily_loss), "plafond"),
  };

  const fenetresDeclarees = fichesDInstruments.flatMap((f) => (f.sessions ?? []).map(fenetreDeSession));
  // ⚠️ Une fiche sans plage horaire n'interdit aucune heure : l'union non plus.
  const uneFicheSansHoraire = fichesDInstruments.some((f) => (f.sessions ?? []).length === 0);
  const toutesReconnues = fenetresDeclarees.every(Boolean);
  const windows: [number, number][] = toutesReconnues && !uneFicheSansHoraire
    ? fenetresDeclarees.filter((f): f is [number, number] => f !== undefined)
    : [];

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

    /**
     * SL/TP absents. On regarde le SL initial s'il est renseigné : un SL déplacé
     * au BE ne doit pas être compté comme « pas de SL ».
     *
     * ⚠️⚠️ ET ZÉRO VAUT ABSENT. MetaTrader annonce « pas de stop » par un ZÉRO
     * (`OrderStopLoss()` vaut 0) et le rail de synchro l'enregistrait tel quel :
     * mesuré en base le 2026-09-17, 20 trades ont `sl = 0` et 67 ont `tp = 0`.
     * Le test `== null` ne les voyait pas, donc un trade SANS STOP n'était pas
     * signalé comme tel et le score de discipline du trader était meilleur que
     * la réalité — pendant que `sl_too_wide`, lui, se déclenchait à tort sur une
     * distance de dizaines de milliers de pips. Voir `lib/prix-connu.ts`.
     */
    const sl = prixConnu(t.sl_initial) ?? prixConnu(t.sl);
    const tp = prixConnu(t.tp_initial) ?? prixConnu(t.tp);
    if (sl == null) add("missing_sl", idx);
    if (tp == null) add("missing_tp", idx);

    /**
     * RR planifié et largeur du SL : calculés sur les mêmes pips que le prompt.
     *
     * ⚠️⚠️ UN STOP SUIVI N'EST PAS UN RISQUE MINUSCULE, C'EST UN RISQUE
     * INCONNU. MetaTrader pousse le stop COURANT à la clôture : remonté au
     * point mort ou en profit, il se retrouve du côté du GAIN, et la distance
     * |entrée − sl| ne mesure plus rien. Mesuré en base le 2026-09-18 :
     * 64 trades sur 447, tous MT5, dont 57 gagnants. `sl_too_wide` ne pouvait
     * donc jamais se déclencher sur eux, et `low_rr` divisait par un risque
     * quasi nul. Les deux contrôles se taisent maintenant plutôt que d'absoudre.
     * Voir lib/risque-du-trade.
     */
    const riskPips = risqueEnPips(t.pair, t.direction, t.entry_price, sl);
    if (riskPips != null) {
      if (regleDuTrader.max_sl_pips != null && riskPips > regleDuTrader.max_sl_pips) {
        add("sl_too_wide", idx);
      }
      if (regleDuTrader.risk_reward != null && tp != null) {
        const rewardPips = calculatePips(t.pair, t.entry_price, tp);
        if (rewardPips > 0 && rewardPips / riskPips < regleDuTrader.risk_reward) {
          add("low_rr", idx);
        }
      }
    }
  });

  const out: MechanicalViolation[] = [];
  for (const [type, ids] of Object.entries(hits)) {
    out.push({
      category: CATEGORY[type as MechanicalViolationType],
      type: type as MechanicalViolationType,
      trade_ids: ids,
      occurrences: ids.length,
    });
  }

  // ── Règles par jour / par série ───────────────────────────────────────────
  if (regleDuTrader.max_trades_per_day != null && regleDuTrader.max_trades_per_day > 0) {
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
      if (idxs.length > regleDuTrader.max_trades_per_day) {
        days++;
        offendingDays.push(...idxs.slice(regleDuTrader.max_trades_per_day));
      }
    }
    if (days > 0) {
      out.push({ category: "strategy", type: "max_trades_day", trade_ids: offendingDays, occurrences: days });
    }
  }

  /**
   * ⚠️⚠️ CETTE RÈGLE ÉTAIT COLLECTÉE, AFFICHÉE, NOTÉE — ET JAMAIS VÉRIFIÉE.
   * `strategies.max_daily_loss` se saisit dans la fiche stratégie, s'affiche
   * sur l'écran de séance (« Perte max journalière : 3 % ») et vaut QUINZE
   * points de score de discipline, le deuxième plus lourd du barème. Mais la
   * limite n'entrait ni dans le comptage du serveur ni dans le prompt, et
   * celui-ci dit noir sur blanc « si un type n'apparaît pas ci-dessus, il n'y a
   * pas de violation de ce type : ne l'invente pas ». Mesuré le 2026-09-17 sur
   * les 32 analyses enregistrées : tous les types de violation y figurent au
   * moins une fois SAUF celui-ci, jamais produit depuis la création du produit.
   *
   * Un trader qui se fixe 3 % et en perd 8 n'en était donc jamais averti.
   *
   * ⚠️ La référence est `account_size`, le capital NOMINAL, parce que c'est
   * déjà celle qu'utilise la jauge de perte du jour de la page Comptes
   * (`account_size * max_daily_loss_pct / 100`). Deux références donneraient
   * deux seuils pour la même règle.
   */
  if (
    regleDuTrader.max_daily_loss != null &&
    regleDuTrader.max_daily_loss > 0 &&
    accountSize != null &&
    accountSize > 0
  ) {
    const limite = (accountSize * regleDuTrader.max_daily_loss) / 100;
    const parJour = new Map<string, number[]>();
    trades.forEach((t, idx) => {
      const d = utcDay(t.open_time);
      const bucket = parJour.get(d);
      if (bucket) bucket.push(idx);
      else parJour.set(d, [idx]);
    });
    const fautifs: number[] = [];
    let jours = 0;
    for (const idxs of Array.from(parJour.values())) {
      const perte = -idxs.reduce((somme, i) => somme + netPnl(trades[i]), 0);
      if (perte > limite) {
        jours++;
        fautifs.push(...idxs);
      }
    }
    if (jours > 0) {
      out.push({ category: "strategy", type: "max_daily_loss", trade_ids: fautifs, occurrences: jours });
    }
  }

  if (regleDuTrader.max_consecutive_losses != null && regleDuTrader.max_consecutive_losses > 0) {
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
        if (streak > regleDuTrader.max_consecutive_losses) {
          events++;
          offenders.push(t.idx);
        }
      } else {
        streak = 0;
      }
    }
    if (events > 0) {
      out.push({ category: "strategy", type: "consecutive_losses", trade_ids: offenders, occurrences: events });
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
    if (getTradeResult(prev.net) !== "loss" || Number.isNaN(prev.close)) continue;
    const ecart = chrono[i].open - prev.close;
    /**
     * ⚠️⚠️ IL MANQUAIT LA BORNE BASSE, ET ELLE FAISAIT LA MAJORITÉ DU LOT.
     * Un écart NÉGATIF veut dire que le trade s'est ouvert AVANT que le
     * précédent ne se referme : ce sont deux positions simultanées, pas une
     * réaction à une perte. Le trader ne pouvait même pas savoir qu'il
     * perdait, la perte n'était pas réalisée.
     *
     * Mesuré en production le 2026-09-17 sur les 447 trades : 195 paires dont
     * le précédent est perdant, 28 vraies ouvertures dans les trente minutes
     * et 48 chevauchements. Près des deux tiers de ce que le serveur
     * étiquetait « moins de 30 min après une perte » n'en était pas, et ces
     * trades partent DÉTAILLÉS dans le prompt, présentés au modèle comme la
     * preuve d'un revenge trading.
     *
     * ⚠️ LES DEUX AUTRES IMPLÉMENTATIONS DE LA MÊME RÈGLE L'AVAIENT :
     * `lib/analytics/leaks.ts` (`gap >= 0 && gap <= REVENGE_WINDOW_MS`) et
     * `lib/analysis-insights.ts` (`gapMin >= 0 && gapMin < 30`). Celle-ci, qui
     * est la seule à parler au modèle, ne l'avait pas.
     */
    if (ecart >= 0 && ecart < 30 * 60 * 1000) {
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

/**
 * Le nom LISIBLE de chaque violation.
 *
 * ⚠️⚠️ IL ETAIT ENFERME DANS `renderMechanicalBlock`, et la memoire du
 * coach, elle, poussait les CODES BRUTS dans le prompt. Mesure en production en
 * posant au coach une question banale : il a repondu au trader « violations
 * recurrentes de pertes consecutives (consecutive_losses) et de stop trop large
 * (sl_too_wide) ». Des identifiants internes, en anglais, dans la voix du
 * produit. C'est le meme defaut que `sync_cooldown` affiche tel quel sur la
 * page des reglages, deja corrige une fois ailleurs.
 */
export const LIBELLE_DE_VIOLATION: Record<MechanicalViolationType, string> = {
  wrong_pair: "paire non autorisée",
  wrong_session: "hors session autorisée",
  low_rr: "RR planifié sous le minimum",
  sl_too_wide: "SL au-delà du maximum",
  missing_sl: "aucun SL",
  missing_tp: "aucun TP",
  max_trades_day: "dépassement du nb max de trades/jour",
  max_daily_loss: "perte journalière maximale dépassée",
  consecutive_losses: "trading poursuivi après N pertes consécutives",
};

/**
 * Remplace les codes internes par leur nom lisible, DANS UN TEXTE REDIGE.
 *
 * ⚠️⚠️ LE TABLEAU DE BORD AFFICHAIT « La violation missing_tp recidive pour
 * la 3e analyse consecutive ». Vu a l'ecran, sur la carte « Insights IA ». Le
 * modele n'a rien invente : le prompt lui donne les codes, il en a besoin pour
 * remplir le champ `violations[].type`, et rien ne lui interdisait de les
 * reutiliser dans la PROSE. Cette prose est ensuite ENREGISTREE, donc le code
 * reste a l'ecran jusqu'a la prochaine analyse.
 *
 * ⚠️ CORRIGE DES DEUX COTES : une regle de prompt nettoie ce qui sera
 * ecrit, celle-ci nettoie ce qui l'a deja ete. Une regle de prompt seule
 * laisserait les vingt-quatre analyses existantes telles quelles.
 *
 * ⚠️ ON NE TOUCHE QUE DES MOTS ENTIERS, et seulement des codes connus : un
 * texte francais ne contient pas « missing_tp » par accident.
 */
export function sansCodesInternes(texte: string): string {
  let sortie = texte;
  for (const [code, libelle] of Object.entries(LIBELLE_DE_VIOLATION)) {
    sortie = sortie.replace(new RegExp("(^|[^A-Za-z0-9_])" + code + "(?![A-Za-z0-9_])", "g"), "$1" + libelle);
  }
  return sortie;
}

/** Rend les violations mécaniques en bloc de faits pour le prompt. */
export function renderMechanicalBlock(violations: MechanicalViolation[], total: number): string {
  if (violations.length === 0) {
    return `Aucune violation mécanique détectée sur les ${total} trades de la période.`;
  }
  const label = LIBELLE_DE_VIOLATION;
  const unit: Partial<Record<MechanicalViolationType, string>> = {
    max_trades_day: "jour(s)",
    max_daily_loss: "jour(s)",
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
