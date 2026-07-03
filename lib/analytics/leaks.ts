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
const MIN_HOUR_TRADES = 5;
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

export function computeCapitalLeaks(
  trades: LeakTrade[],
  opts?: { maxTradesPerDay?: number | null; minTrades?: number }
): LeaksResult {
  const minTrades = opts?.minTrades ?? DEFAULT_MIN_TRADES;
  const sorted = [...trades].sort((a, b) => a.open_time.localeCompare(b.open_time));
  const empty: LeaksResult = { leaks: [], totalRecoverable: 0, tradesAnalyzed: sorted.length, flaggedCount: 0 };
  if (sorted.length < minTrades) return empty;

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
