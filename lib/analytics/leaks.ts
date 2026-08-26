/**
 * Fuites de capital — chiffre en euros ce que les erreurs de discipline
 * coûtent réellement au trader.
 *
 * Détection 100 % déterministe (pas d'appel IA) : chaque catégorie flague des
 * trades selon des signaux objectifs, puis son "coût" = P&L net cumulé des
 * trades flagués, uniquement s'il est négatif. Le total récupérable est
 * calculé sur l'UNION des trades flagués (un trade à la fois revenge ET
 * émotionnel n'est compté qu'une fois).
 *
 * Mêmes heuristiques que PatternAlerts / lib/analytics/insights.ts, mais
 * orientées impact financier plutôt qu'alerte comportementale.
 */

export interface LeakTrade {
  open_time: string;
  close_time?: string | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  lot_size?: number | null;
  pair?: string | null;
  emotion?: string | null;
}

export type LeakType = "revenge" | "emotional" | "overtrading" | "oversizing" | "bad_hour";

export interface CapitalLeak {
  type: LeakType;
  /** Nombre de trades concernés. */
  count: number;
  /** Coût en devise du compte (> 0 = argent perdu). */
  cost: number;
  /** Contexte d'affichage (tranche horaire, limite/jour). */
  meta?: { hour?: number; maxPerDay?: number };
}

export interface LeaksResult {
  /** Fuites au coût > 0, triées de la plus chère à la moins chère. */
  leaks: CapitalLeak[];
  /** Perte cumulée sur l'union des trades flagués (> 0 = récupérable). */
  totalRecoverable: number;
  tradesAnalyzed: number;
  /** Taille de l'union des trades flagués. */
  flaggedCount: number;
}

/** Émotions considérées à risque (alignées sur lib/emotions.ts). */
const RISK_EMOTIONS = new Set(["revenge", "fomo", "greedy", "cupide", "overconfident", "frustrated"]);

/** Un trade repris moins de 30 min après une perte = signal revenge. */
const REVENGE_WINDOW_MS = 30 * 60 * 1000;
/** Lot > 1.5× le lot médian après une perte = sizing tilt. */
const OVERSIZE_FACTOR = 1.5;
/** Une tranche horaire n'est significative qu'à partir de 5 trades. */
/**
 * Trades minimum dans une tranche horaire pour la nommer « ta pire heure ».
 *
 * ⚠️ RELEVÉ DE 5 À 10 LE 2026-08-26, ET LE CHIFFRE N'EST PAS ARBITRAIRE : c'est
 * celui que ce fichier a DÉJÀ choisi comme plancher pour dire quoi que ce soit
 * (`DEFAULT_MIN_TRADES`). Une tranche horaire n'a aucune raison d'être plus
 * laxiste que le module qui la contient.
 *
 * Ce qui a déclenché la revue : `lib/projection-segments.ts` refuse de nommer
 * un segment sous VINGT trades, au motif qu'en dessous un écart est une
 * fluctuation d'échantillonnage. Deux modules du même produit ne peuvent pas
 * être en désaccord sur ce qui constitue une preuve, et à 5 trades « ta pire
 * heure » désignait souvent une seule mauvaise séance.
 *
 * On ne monte pas à 20 pour autant : cette carte est une promesse de la landing
 * servie au plan GRATUIT, et la museler pour la plupart des comptes ferait plus
 * de dégâts que l'imprécision qu'on corrige. Le nombre de trades reste affiché
 * à côté de chaque fuite, donc le constat porte sa propre réserve.
 */
const MIN_HOUR_TRADES = 10;
/** En dessous de ce volume, pas assez de signal pour chiffrer quoi que ce soit. */
const DEFAULT_MIN_TRADES = 10;

function netPnl(t: LeakTrade): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface LeakOptions {
  maxTradesPerDay?: number | null;
  minTrades?: number;
}

interface FlagResult {
  /** index (ordre chronologique) → catégories qui le flaguent. */
  flagged: Map<number, Set<LeakType>>;
  worstHour: { hour: number; idxs: number[]; total: number } | null;
  maxPerDay: number | null;
}

/** Cœur partagé : flague les trades indisciplinés (ordre chronologique). */
function flagTrades(sorted: LeakTrade[], opts?: LeakOptions): FlagResult {
  const minTrades = opts?.minTrades ?? DEFAULT_MIN_TRADES;
  // index → catégories qui le flaguent (pour l'union du total)
  const flagged = new Map<number, Set<LeakType>>();
  function flag(idx: number, type: LeakType) {
    const set = flagged.get(idx) ?? new Set<LeakType>();
    set.add(type);
    flagged.set(idx, set);
  }

  // ── Revenge : ouvert < 30 min après la fin d'un trade perdant ──────────
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (netPnl(prev) >= 0) continue;
    const prevEnd = new Date(prev.close_time ?? prev.open_time).getTime();
    const curStart = new Date(sorted[i].open_time).getTime();
    if (Number.isNaN(prevEnd) || Number.isNaN(curStart)) continue;
    const gap = curStart - prevEnd;
    if (gap >= 0 && gap <= REVENGE_WINDOW_MS) flag(i, "revenge");
  }

  // ── Émotions à risque annotées par le trader ──────────────────────────
  for (let i = 0; i < sorted.length; i++) {
    const emotion = sorted[i].emotion?.toLowerCase();
    if (emotion && RISK_EMOTIONS.has(emotion)) flag(i, "emotional");
  }

  // ── Overtrading : au-delà de la limite quotidienne de la stratégie ────
  const maxPerDay = opts?.maxTradesPerDay ?? null;
  if (maxPerDay != null && maxPerDay > 0) {
    const perDay = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) {
      const key = dayKey(sorted[i].open_time);
      const n = (perDay.get(key) ?? 0) + 1;
      perDay.set(key, n);
      if (n > maxPerDay) flag(i, "overtrading");
    }
  }

  // ── Sizing tilt : lot gonflé (> 1.5× médiane) juste après une perte ───
  const lots = sorted.map((t) => t.lot_size).filter((l): l is number => l != null && l > 0);
  if (lots.length >= minTrades) {
    const medLot = median(lots);
    if (medLot > 0) {
      for (let i = 1; i < sorted.length; i++) {
        const lot = sorted[i].lot_size;
        if (lot == null || lot <= medLot * OVERSIZE_FACTOR) continue;
        if (netPnl(sorted[i - 1]) < 0) flag(i, "oversizing");
      }
    }
  }

  // ── Pire tranche horaire (≥ 5 trades, total négatif) ──────────────────
  const byHour = new Map<number, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    const h = new Date(sorted[i].open_time).getHours();
    if (Number.isNaN(h)) continue;
    const arr = byHour.get(h) ?? [];
    arr.push(i);
    byHour.set(h, arr);
  }
  let worstHour: { hour: number; idxs: number[]; total: number } | null = null;
  for (const [hour, idxs] of Array.from(byHour.entries())) {
    if (idxs.length < MIN_HOUR_TRADES) continue;
    const total = idxs.reduce((s, i) => s + netPnl(sorted[i]), 0);
    if (total < 0 && (!worstHour || total < worstHour.total)) worstHour = { hour, idxs, total };
  }
  if (worstHour) for (const i of worstHour.idxs) flag(i, "bad_hour");

  return { flagged, worstHour, maxPerDay };
}

export function computeCapitalLeaks(trades: LeakTrade[], opts?: LeakOptions): LeaksResult {
  const minTrades = opts?.minTrades ?? DEFAULT_MIN_TRADES;
  const sorted = [...trades].sort((a, b) => a.open_time.localeCompare(b.open_time));
  const empty: LeaksResult = { leaks: [], totalRecoverable: 0, tradesAnalyzed: sorted.length, flaggedCount: 0 };
  if (sorted.length < minTrades) return empty;

  const { flagged, worstHour, maxPerDay } = flagTrades(sorted, opts);

  // ── Agrégation par catégorie (coût = net cumulé, gardé si négatif) ────
  const leaks: CapitalLeak[] = [];
  const types: LeakType[] = ["revenge", "emotional", "overtrading", "oversizing", "bad_hour"];
  for (const type of types) {
    const idxs = Array.from(flagged.entries()).filter(([, set]) => set.has(type)).map(([i]) => i);
    if (idxs.length === 0) continue;
    const total = idxs.reduce((s, i) => s + netPnl(sorted[i]), 0);
    if (total >= 0) continue; // l'habitude n'a rien coûté sur la période
    const meta: CapitalLeak["meta"] =
      type === "bad_hour" && worstHour ? { hour: worstHour.hour }
      : type === "overtrading" && maxPerDay != null ? { maxPerDay }
      : undefined;
    leaks.push({ type, count: idxs.length, cost: Math.abs(total), ...(meta ? { meta } : {}) });
  }
  leaks.sort((a, b) => b.cost - a.cost);

  // ── Total récupérable : union des trades flagués, sans double compte ──
  const unionNet = Array.from(flagged.keys()).reduce((s, i) => s + netPnl(sorted[i]), 0);
  const totalRecoverable = unionNet < 0 ? Math.abs(unionNet) : 0;

  return {
    leaks,
    totalRecoverable: Math.round(totalRecoverable * 100) / 100,
    tradesAnalyzed: sorted.length,
    flaggedCount: flagged.size,
  };
}

export interface DisciplineCurves {
  /** Cumul du P&L net réel, un point par trade (ordre chronologique). */
  real: number[];
  /** Cumul contrefactuel : mêmes points, mais les trades flagués sont
   *  ignorés (palier plat) — « si tu avais respecté ton plan ». */
  disciplined: number[];
  /** Écart final discipliné − réel (≥ 0 quand l'indiscipline a coûté). */
  finalGap: number;
}

/**
 * Discipline Backtest — le contrefactuel qui matérialise les fuites :
 * rejoue l'historique en retirant les trades indisciplinés (l'union flaguée
 * par flagTrades, la même que computeCapitalLeaks). Les deux courbes ont la
 * même longueur (un point par trade réel), la disciplinée fait un palier sur
 * chaque trade retiré — la divergence se LIT au moment de chaque erreur.
 * L'écart final vaut exactement le net de l'union flaguée : cohérent avec
 * totalRecoverable quand celui-ci est non nul.
 */
export function computeDisciplineCurves(trades: LeakTrade[], opts?: LeakOptions): DisciplineCurves {
  const minTrades = opts?.minTrades ?? DEFAULT_MIN_TRADES;
  const sorted = [...trades].sort((a, b) => a.open_time.localeCompare(b.open_time));
  if (sorted.length < minTrades) return { real: [], disciplined: [], finalGap: 0 };

  const { flagged } = flagTrades(sorted, opts);

  const real: number[] = [];
  const disciplined: number[] = [];
  let cumReal = 0;
  let cumDisc = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumReal += netPnl(sorted[i]);
    if (!flagged.has(i)) cumDisc += netPnl(sorted[i]);
    real.push(Math.round(cumReal * 100) / 100);
    disciplined.push(Math.round(cumDisc * 100) / 100);
  }

  const finalGap = Math.round((cumDisc - cumReal) * 100) / 100;
  return { real, disciplined, finalGap };
}
