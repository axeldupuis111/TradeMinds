/**
 * analysis-insights.ts
 * Le socle déterministe de l'analyse IA des trades : statistiques agrégées
 * injectées dans le prompt (le modèle raisonne sur des faits calculés, pas
 * sur 500 lignes brutes), coût en euros de chaque violation, courbe d'équité
 * contrefactuelle (« et si tu avais respecté ta stratégie ? ») et détection
 * de l'edge réel du trader. Aucun I/O, aucun appel IA — tout est testable.
 */

import type { Violation } from "@/lib/discipline-score";

/** Sous-ensemble d'un trade nécessaire aux calculs (superset toléré). */
export interface InsightTrade {
  open_time: string;
  close_time: string;
  pair: string;
  direction: string;
  lot_size: number;
  pnl: number;
  commission?: number | null;
  swap?: number | null;
  ict_setup?: string | null;
  emotion?: string | null;
  ict_confluence_score?: number | null;
  checklist_total?: number | null;
}

/** P&L net (commissions et swap inclus). */
export function netPnl(t: InsightTrade): number {
  return t.pnl + (t.commission ?? 0) + (t.swap ?? 0);
}

/** Agrégat sur un sous-ensemble de trades. */
export interface Bucket {
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
}

function emptyBucket(): Bucket {
  return { trades: 0, wins: 0, losses: 0, netPnl: 0 };
}

function addToBucket(b: Bucket, pnl: number) {
  b.trades += 1;
  b.netPnl += pnl;
  if (pnl > 0) b.wins += 1;
  else if (pnl < 0) b.losses += 1;
}

export function winRate(b: Bucket): number {
  const decided = b.wins + b.losses;
  return decided === 0 ? 0 : Math.round((b.wins / decided) * 100);
}

export interface TradeStats {
  total: {
    trades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number;
    netPnl: number;
    grossProfit: number;
    grossLoss: number;
    /** Infinity encodée comme null (aucune perte). */
    profitFactor: number | null;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    bestTrade: number;
    worstTrade: number;
  };
  /** Clé = heure locale "0".."23" (fuseau du trader). */
  byHour: Record<string, Bucket>;
  /** Clé = jour ISO "1" (lundi) .. "7" (dimanche), heure locale. */
  byWeekday: Record<string, Bucket>;
  byPair: Record<string, Bucket>;
  byDirection: Record<string, Bucket>;
  byEmotion: Record<string, Bucket>;
  bySetup: Record<string, Bucket>;
  /** Comportement après une perte (fenêtre revenge = ouverture < 30 min après la clôture perdante). */
  afterLoss: {
    within30min: Bucket;
    later: Bucket;
    avgLotAfterLoss: number | null;
    avgLotAfterWin: number | null;
  };
  maxConsecutiveLosses: number;
  /** Winrate selon la complétion de la checklist (≥ 80 % vs < 80 %), si renseignée. */
  checklist: { high: Bucket; low: Bucket } | null;
}

/** Heure et jour locaux d'un instant dans le fuseau du trader (fallback UTC). */
function localParts(iso: string, timezone: string): { hour: number; isoWeekday: number } {
  const d = new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? d.getUTCHours()) % 24;
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return { hour, isoWeekday: map[wd] ?? ((d.getUTCDay() + 6) % 7) + 1 };
  } catch {
    return { hour: d.getUTCHours(), isoWeekday: ((d.getUTCDay() + 6) % 7) + 1 };
  }
}

export function computeTradeStats(trades: InsightTrade[], timezone = "UTC"): TradeStats {
  const byHour: Record<string, Bucket> = {};
  const byWeekday: Record<string, Bucket> = {};
  const byPair: Record<string, Bucket> = {};
  const byDirection: Record<string, Bucket> = {};
  const byEmotion: Record<string, Bucket> = {};
  const bySetup: Record<string, Bucket> = {};

  let wins = 0, losses = 0, breakevens = 0;
  let grossProfit = 0, grossLoss = 0, total = 0;
  let best = -Infinity, worst = Infinity;

  const bucketInto = (rec: Record<string, Bucket>, key: string, pnl: number) => {
    (rec[key] ??= emptyBucket());
    addToBucket(rec[key], pnl);
  };

  for (const t of trades) {
    const pnl = netPnl(t);
    total += pnl;
    if (pnl > 0) { wins += 1; grossProfit += pnl; }
    else if (pnl < 0) { losses += 1; grossLoss += -pnl; }
    else breakevens += 1;
    if (pnl > best) best = pnl;
    if (pnl < worst) worst = pnl;

    const { hour, isoWeekday } = localParts(t.open_time, timezone);
    bucketInto(byHour, String(hour), pnl);
    bucketInto(byWeekday, String(isoWeekday), pnl);
    bucketInto(byPair, t.pair.toUpperCase(), pnl);
    bucketInto(byDirection, t.direction.toLowerCase(), pnl);
    if (t.emotion) bucketInto(byEmotion, t.emotion.trim().toLowerCase(), pnl);
    if (t.ict_setup) bucketInto(bySetup, t.ict_setup.trim(), pnl);
  }

  // Séquentiel : trié par ouverture pour le comportement après perte.
  const seq = [...trades].sort((a, b) => a.open_time.localeCompare(b.open_time));
  const within30min = emptyBucket();
  const later = emptyBucket();
  const lotsAfterLoss: number[] = [];
  const lotsAfterWin: number[] = [];
  let maxConsecutiveLosses = 0;
  let streak = 0;
  for (let i = 0; i < seq.length; i++) {
    const pnl = netPnl(seq[i]);
    if (pnl < 0) {
      streak += 1;
      if (streak > maxConsecutiveLosses) maxConsecutiveLosses = streak;
    } else if (pnl > 0) {
      streak = 0;
    }
    if (i === 0) continue;
    const prev = seq[i - 1];
    const prevPnl = netPnl(prev);
    if (prevPnl < 0) {
      lotsAfterLoss.push(seq[i].lot_size);
      const gapMin = (new Date(seq[i].open_time).getTime() - new Date(prev.close_time).getTime()) / 60_000;
      addToBucket(gapMin >= 0 && gapMin < 30 ? within30min : later, pnl);
    } else if (prevPnl > 0) {
      lotsAfterWin.push(seq[i].lot_size);
    }
  }
  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

  // Checklist : ratio de complétion ≥ 80 % vs < 80 %.
  const withChecklist = trades.filter(
    (t) => t.ict_confluence_score != null && (t.checklist_total ?? 0) > 0,
  );
  let checklist: TradeStats["checklist"] = null;
  if (withChecklist.length >= 5) {
    const high = emptyBucket();
    const low = emptyBucket();
    for (const t of withChecklist) {
      const ratio = (t.ict_confluence_score ?? 0) / (t.checklist_total ?? 1);
      addToBucket(ratio >= 0.8 ? high : low, netPnl(t));
    }
    checklist = { high, low };
  }

  const decided = wins + losses;
  return {
    total: {
      trades: trades.length,
      wins,
      losses,
      breakevens,
      winRate: decided === 0 ? 0 : Math.round((wins / decided) * 100),
      netPnl: round2(total),
      grossProfit: round2(grossProfit),
      grossLoss: round2(grossLoss),
      profitFactor: grossLoss === 0 ? null : round2(grossProfit / grossLoss),
      avgWin: wins === 0 ? 0 : round2(grossProfit / wins),
      avgLoss: losses === 0 ? 0 : round2(-grossLoss / losses),
      expectancy: trades.length === 0 ? 0 : round2(total / trades.length),
      bestTrade: trades.length === 0 ? 0 : round2(best),
      worstTrade: trades.length === 0 ? 0 : round2(worst),
    },
    byHour,
    byWeekday,
    byPair,
    byDirection,
    byEmotion,
    bySetup,
    afterLoss: {
      within30min,
      later,
      avgLotAfterLoss: avg(lotsAfterLoss) === null ? null : round2(avg(lotsAfterLoss)!),
      avgLotAfterWin: avg(lotsAfterWin) === null ? null : round2(avg(lotsAfterWin)!),
    },
    maxConsecutiveLosses,
    checklist,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const WEEKDAY_FR = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function bucketLine(key: string, b: Bucket): string {
  return `${key}: ${b.trades} trades, winrate ${winRate(b)}%, P&L net ${b.netPnl >= 0 ? "+" : ""}${round2(b.netPnl)}`;
}

/**
 * Bloc texte injecté dans le prompt. Français volontaire : le prompt de
 * l'analyse est rédigé en français et le modèle traduit sa sortie dans la
 * langue demandée. On n'inclut que les segments à ≥ 3 trades pour éviter
 * que le modèle généralise sur du bruit.
 */
export function renderStatsBlock(stats: TradeStats, timezone: string): string {
  const s = stats.total;
  const lines: string[] = [];
  lines.push(
    `GLOBAL : ${s.trades} trades — ${s.wins} gagnants / ${s.losses} perdants / ${s.breakevens} BE — winrate ${s.winRate}% — P&L net ${fmtSigned(s.netPnl)} — profit factor ${s.profitFactor ?? "∞"} — gain moyen ${fmtSigned(s.avgWin)} — perte moyenne ${fmtSigned(s.avgLoss)} — espérance/trade ${fmtSigned(s.expectancy)} — meilleur ${fmtSigned(s.bestTrade)} — pire ${fmtSigned(s.worstTrade)} — max pertes consécutives ${stats.maxConsecutiveLosses}`,
  );

  const section = (title: string, rec: Record<string, Bucket>, label: (k: string) => string, min = 3) => {
    const entries = Object.entries(rec)
      .filter(([, b]) => b.trades >= min)
      .sort(([, a], [, b]) => b.netPnl - a.netPnl);
    if (entries.length === 0) return;
    lines.push(`${title} :`);
    for (const [k, b] of entries) lines.push(`  - ${bucketLine(label(k), b)}`);
  };

  section(`PAR HEURE D'OUVERTURE (fuseau du trader, ${timezone})`, stats.byHour, (h) => `${h}h`);
  section("PAR JOUR DE LA SEMAINE", stats.byWeekday, (d) => WEEKDAY_FR[Number(d)] ?? d);
  section("PAR INSTRUMENT", stats.byPair, (k) => k);
  section("PAR SENS", stats.byDirection, (k) => k, 1);
  section("PAR ÉMOTION ANNOTÉE", stats.byEmotion, (k) => k);
  section("PAR SETUP", stats.bySetup, (k) => k);

  const al = stats.afterLoss;
  if (al.within30min.trades + al.later.trades > 0) {
    lines.push("APRÈS UNE PERTE :");
    if (al.within30min.trades > 0)
      lines.push(`  - ${bucketLine("trade repris < 30 min après la perte (fenêtre revenge)", al.within30min)}`);
    if (al.later.trades > 0)
      lines.push(`  - ${bucketLine("trade repris ≥ 30 min après la perte", al.later)}`);
    if (al.avgLotAfterLoss != null && al.avgLotAfterWin != null)
      lines.push(`  - lot moyen après perte ${al.avgLotAfterLoss} vs après gain ${al.avgLotAfterWin}`);
  }

  if (stats.checklist) {
    lines.push("CHECKLIST :");
    lines.push(`  - ${bucketLine("complétion ≥ 80%", stats.checklist.high)}`);
    lines.push(`  - ${bucketLine("complétion < 80%", stats.checklist.low)}`);
  }

  return lines.join("\n");
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${round2(n)}`;
}

// ─── Coût des violations ───────────────────────────────────────────────────────

export interface ViolationCostResult {
  /** Coût par violation, aligné sur le tableau d'entrée (somme des P&L nets des trades cités). */
  perViolation: (number | null)[];
  /** Indices (dans le tableau de trades) impliqués dans au moins une violation. */
  violationIndices: number[];
  /** P&L net cumulé des trades en violation (négatif = l'indiscipline a coûté). */
  totalCost: number;
}

/**
 * Chiffre chaque violation : combien ont rapporté/coûté les trades cités.
 * Les trade_ids sont les index [0..n-1] utilisés dans le prompt ; les index
 * hors bornes (hallucinés) sont ignorés.
 */
export function computeViolationCosts(
  violations: Pick<Violation, "trade_ids">[],
  trades: InsightTrade[],
): ViolationCostResult {
  const union = new Set<number>();
  const perViolation = violations.map((v) => {
    const valid = (v.trade_ids ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < trades.length);
    if (valid.length === 0) return null;
    for (const i of valid) union.add(i);
    return round2(valid.reduce((sum, i) => sum + netPnl(trades[i]), 0));
  });
  const indices = Array.from(union).sort((a, b) => a - b);
  const totalCost = round2(indices.reduce((sum, i) => sum + netPnl(trades[i]), 0));
  return { perViolation, violationIndices: indices, totalCost };
}

// ─── Courbe contrefactuelle ────────────────────────────────────────────────────

export interface CounterfactualPoint {
  /** ISO de clôture du trade. */
  t: string;
  real: number;
  clean: number;
}

export interface Counterfactual {
  points: CounterfactualPoint[];
  realFinal: number;
  cleanFinal: number;
  /** cleanFinal - realFinal : ce que la discipline aurait rapporté en plus. */
  gain: number;
}

/**
 * Équité cumulée réelle vs « discipline respectée » (trades en violation
 * retirés). Les points sont ordonnés par clôture et rééchantillonnés à
 * `maxPoints` pour rester légers côté client.
 */
export function computeCounterfactual(
  trades: InsightTrade[],
  violationIndices: number[],
  maxPoints = 120,
): Counterfactual | null {
  if (trades.length === 0 || violationIndices.length === 0) return null;
  const excluded = new Set(violationIndices);
  const order = trades
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.close_time.localeCompare(b.t.close_time));

  let real = 0;
  let clean = 0;
  const all: CounterfactualPoint[] = [{ t: order[0].t.close_time, real: 0, clean: 0 }];
  for (const { t, i } of order) {
    const pnl = netPnl(t);
    real += pnl;
    if (!excluded.has(i)) clean += pnl;
    all.push({ t: t.close_time, real: round2(real), clean: round2(clean) });
  }

  let points = all;
  if (all.length > maxPoints) {
    points = [];
    const step = (all.length - 1) / (maxPoints - 1);
    for (let k = 0; k < maxPoints; k++) points.push(all[Math.round(k * step)]);
  }

  return {
    points,
    realFinal: round2(real),
    cleanFinal: round2(clean),
    gain: round2(clean - real),
  };
}

// ─── Edge réel ─────────────────────────────────────────────────────────────────

export type EdgeDimension = "pair" | "hour" | "weekday" | "setup" | "emotion" | "direction";

export interface EdgeHighlight {
  kind: "best" | "worst";
  dimension: EdgeDimension;
  /** Clé brute du segment (paire, "14" pour 14h, "1" pour lundi, setup, émotion…). */
  key: string;
  netPnl: number;
  winRate: number;
  trades: number;
}

/**
 * Le meilleur et le pire segment du trader, toutes dimensions confondues,
 * avec un minimum d'échantillon pour ne pas ériger du bruit en edge.
 */
export function computeEdgeHighlights(stats: TradeStats, minTrades = 5): EdgeHighlight[] {
  const candidates: EdgeHighlight[] = [];
  const collect = (dimension: EdgeDimension, rec: Record<string, Bucket>) => {
    for (const [key, b] of Object.entries(rec)) {
      if (b.trades < minTrades) continue;
      candidates.push({ kind: "best", dimension, key, netPnl: round2(b.netPnl), winRate: winRate(b), trades: b.trades });
    }
  };
  collect("pair", stats.byPair);
  collect("hour", stats.byHour);
  collect("weekday", stats.byWeekday);
  collect("setup", stats.bySetup);
  collect("emotion", stats.byEmotion);
  collect("direction", stats.byDirection);

  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => b.netPnl - a.netPnl);
  const out: EdgeHighlight[] = [];
  const best = sorted[0];
  if (best.netPnl > 0) out.push({ ...best, kind: "best" });
  const worst = sorted[sorted.length - 1];
  if (worst.netPnl < 0 && worst !== best) out.push({ ...worst, kind: "worst" });
  return out;
}
