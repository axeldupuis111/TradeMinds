import { money } from "@/lib/account-currency";
import { nombre, pourcent } from "@/lib/nombres";
import { type AnalyticsTrade, netPnl } from "./types";

export type Insight = {
  id: string;
  severity: "positive" | "negative" | "neutral";
  icon:
    | "trending-up"
    | "trending-down"
    | "alert-triangle"
    | "target"
    | "clock"
    | "calendar";
  title: string;
  /** Description with [[value]] markers — rendered as bold spans by AutoInsights. */
  description: string;
  /** 0..1 — used to sort insights by significance. */
  strength: number;
};

/** Translator injected from the UI so insight text is localized (fr/en/de/es). */
type Translate = (key: string) => string;

/**
 * ── LES CHIFFRES DE CES PHRASES SONT ÉCRITS COMME PARTOUT AILLEURS ──────────
 *
 * ⚠️⚠️ CE FICHIER AVAIT SON PROPRE FORMATEUR D'ARGENT. Sur la page Analytics,
 * le KPI écrivait « +14 607,50€ » pendant que la phrase juste à côté disait
 * « -2365 € » : euro en dur, aucun séparateur de milliers, espace avant le
 * symbole. Sur la MÊME page, et sur un compte qui pourrait être en dollars.
 *
 * ⚠️ ET LE RATIO ÉTAIT EN « 5.7× » : point décimal anglais dans une phrase
 * française. La quatrième copie privée d'une règle qui existe déjà.
 */
function fmtPnl(n: number, devise: string): string {
  return money(Math.round(n), devise, { signed: true });
}

function fmtPct(n: number): string {
  return pourcent(Math.round(n));
}

/** Le signe multiplié est « × », pas la lettre x. */
function fmtRatio(n: number): string {
  return `${nombre(n, 1)}×`;
}

// ─── Individual detectors ─────────────────────────────────────────────────────

function detectStrongHour(trades: AnalyticsTrade[], t: Translate, devise: string): Insight | null {
  const globalTotal = trades.reduce((s, t) => s + netPnl(t), 0);
  const globalAvg = globalTotal / trades.length;
  // Only meaningful when overall avg is positive
  if (globalAvg <= 0) return null;

  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    pnl: 0,
    count: 0,
  }));

  for (const tr of trades) {
    if (!tr.open_time) continue;
    const d = new Date(tr.open_time);
    if (isNaN(d.getTime())) continue;
    const h = d.getHours();
    byHour[h].pnl += netPnl(tr);
    byHour[h].count++;
  }

  let best: { hour: number; avg: number; ratio: number } | null = null;
  for (const h of byHour) {
    if (h.count < 5) continue;
    const avg = h.pnl / h.count;
    const ratio = avg / globalAvg;
    if (ratio >= 1.5 && (!best || ratio > best.ratio)) {
      best = { hour: h.hour, avg, ratio };
    }
  }

  if (!best) return null;

  return {
    id: "hour-strong",
    severity: "positive",
    icon: "clock",
    title: t("insights_hour_strong_title"),
    description: t("insights_hour_strong_desc")
      .replace("{hour}", String(best.hour))
      .replace("{ratio}", fmtRatio(best.ratio))
      .replace("{avg}", fmtPnl(best.avg, devise))
      .replace("{global}", fmtPnl(globalAvg, devise)),
    strength: Math.min(1, (best.ratio - 1) / 3),
  };
}

function detectWeakHour(trades: AnalyticsTrade[], t: Translate, devise: string): Insight | null {
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    pnl: 0,
    count: 0,
    wins: 0,
  }));

  for (const tr of trades) {
    if (!tr.open_time) continue;
    const d = new Date(tr.open_time);
    if (isNaN(d.getTime())) continue;
    const h = d.getHours();
    const net = netPnl(tr);
    byHour[h].pnl += net;
    byHour[h].count++;
    if (net > 0) byHour[h].wins++;
  }

  let worst: { hour: number; totalPnl: number; count: number; wr: number } | null =
    null;
  for (const h of byHour) {
    if (h.count < 5) continue;
    const avg = h.pnl / h.count;
    if (avg > -30) continue;
    if (!worst || h.pnl < worst.totalPnl) {
      worst = {
        hour: h.hour,
        totalPnl: h.pnl,
        count: h.count,
        wr: Math.round((h.wins / h.count) * 100),
      };
    }
  }

  if (!worst) return null;

  return {
    id: "hour-weak",
    severity: "negative",
    icon: "alert-triangle",
    title: t("insights_hour_weak_title"),
    description: t("insights_hour_weak_desc")
      .replace("{hour}", String(worst.hour))
      .replace("{pnl}", fmtPnl(worst.totalPnl, devise))
      .replace("{count}", String(worst.count))
      .replace("{wr}", fmtPct(worst.wr)),
    strength: Math.min(1, Math.abs(worst.totalPnl) / 500),
  };
}

function detectStrongDay(trades: AnalyticsTrade[], t: Translate): Insight | null {
  const globalAvg = trades.reduce((s, t) => s + netPnl(t), 0) / trades.length;
  if (globalAvg <= 0) return null;

  const byDay = Array.from({ length: 7 }, (_, d) => ({
    day: d,
    pnl: 0,
    count: 0,
  }));

  for (const tr of trades) {
    if (!tr.open_time) continue;
    const d = new Date(tr.open_time);
    if (isNaN(d.getTime())) continue;
    const day = (d.getDay() + 6) % 7; // Monday=0
    byDay[day].pnl += netPnl(tr);
    byDay[day].count++;
  }

  let best: { day: number; avg: number; ratio: number } | null = null;
  for (const d of byDay) {
    if (d.count < 5) continue;
    const avg = d.pnl / d.count;
    const ratio = avg / globalAvg;
    if (ratio >= 1.5 && (!best || ratio > best.ratio)) {
      best = { day: d.day, avg, ratio };
    }
  }

  if (!best) return null;

  return {
    id: "day-strong",
    severity: "positive",
    icon: "calendar",
    title: t("insights_day_strong_title"),
    description: t("insights_day_strong_desc")
      .replace("{day}", t(`insights_day_${best.day}`))
      .replace("{ratio}", fmtRatio(best.ratio)),
    strength: Math.min(1, (best.ratio - 1) / 3),
  };
}

function detectOvertrading(trades: AnalyticsTrade[], t: Translate): Insight | null {
  // Group by calendar date
  const byDate: Record<string, { count: number; wins: number }> = {};
  for (const tr of trades) {
    if (!tr.open_time) continue;
    const date = tr.open_time.split("T")[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { count: 0, wins: 0 };
    byDate[date].count++;
    if (netPnl(tr) > 0) byDate[date].wins++;
  }

  const days = Object.values(byDate);
  if (days.length < 5) return null;

  // Median trades/day
  const counts = [...days.map((d) => d.count)].sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];

  const lowDays = days.filter((d) => d.count <= median);
  const highDays = days.filter((d) => d.count > median);
  if (lowDays.length === 0 || highDays.length === 0) return null;

  const wrLow =
    lowDays.reduce((s, d) => s + d.wins, 0) /
    lowDays.reduce((s, d) => s + d.count, 0);
  const wrHigh =
    highDays.reduce((s, d) => s + d.wins, 0) /
    highDays.reduce((s, d) => s + d.count, 0);

  const diffPts = Math.round((wrLow - wrHigh) * 100);
  if (diffPts < 10) return null;

  return {
    id: "overtrading",
    severity: "negative",
    icon: "trending-down",
    title: t("insights_overtrading_title"),
    description: t("insights_overtrading_desc")
      .replace("{median}", String(median))
      .replace("{diff}", String(diffPts)),
    strength: Math.min(1, diffPts / 30),
  };
}

function detectDirectionBias(trades: AnalyticsTrade[], t: Translate): Insight | null {
  const longs = trades.filter(
    (t) => t.direction?.toLowerCase() === "long"
  );
  const shorts = trades.filter(
    (t) => t.direction?.toLowerCase() === "short"
  );

  if (longs.length < 10 || shorts.length < 10) return null;

  const wrLong =
    longs.filter((t) => netPnl(t) > 0).length / longs.length;
  const wrShort =
    shorts.filter((t) => netPnl(t) > 0).length / shorts.length;

  const diffPts = Math.round(Math.abs(wrLong - wrShort) * 100);
  if (diffPts < 8) return null;

  const betterDir = wrLong >= wrShort ? "Long" : "Short";
  const worseDir = wrLong >= wrShort ? "Short" : "Long";
  const betterWr = Math.max(wrLong, wrShort) * 100;
  const worseWr = Math.min(wrLong, wrShort) * 100;

  return {
    id: "direction-bias",
    severity: "positive",
    icon: "target",
    title: t("insights_direction_title"),
    description: t("insights_direction_desc")
      .replace("{diff}", String(diffPts))
      .replace("{better}", betterDir)
      .replace("{betterWr}", fmtPct(betterWr))
      .replace("{worseWr}", fmtPct(worseWr))
      .replace("{worse}", worseDir),
    strength: Math.min(1, diffPts / 30),
  };
}

function detectPairConcentration(trades: AnalyticsTrade[], t: Translate): Insight | null {
  const totalAbsPnl = trades.reduce((s, t) => s + Math.abs(netPnl(t)), 0);
  if (totalAbsPnl === 0) return null;

  const byPair: Record<string, number> = {};
  for (const tr of trades) {
    if (!tr.pair) continue;
    byPair[tr.pair] = (byPair[tr.pair] ?? 0) + Math.abs(netPnl(tr));
  }

  const sorted = Object.entries(byPair).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return null;

  const [topPair, topAbs] = sorted[0];
  const pairShare = topAbs / totalAbsPnl;
  const pct = Math.round(pairShare * 100);
  if (pct < 50) return null;

  if (pairShare >= 0.7) {
    return {
      id: "pair-concentration",
      severity: "negative",
      icon: "alert-triangle",
      title: t("insights_pair_over_title"),
      description: t("insights_pair_over_desc")
        .replace("{pair}", topPair)
        .replace("{pct}", fmtPct(pct)),
      strength: Math.min(1, (pct - 50) / 50),
    };
  }

  return {
    id: "pair-concentration",
    severity: "neutral",
    icon: "trending-up",
    title: t("insights_pair_conc_title"),
    description: t("insights_pair_conc_desc")
      .replace("{pair}", topPair)
      .replace("{pct}", fmtPct(pct)),
    strength: Math.min(1, (pct - 50) / 50),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run all 6 detectors and return insights sorted by strength (highest first).
 * Returns [] if fewer than 10 trades.
 */
export function generateInsights(trades: AnalyticsTrade[], t: Translate, devise: string): Insight[] {
  if (trades.length < 10) return [];

  const detectors = [
    detectStrongHour,
    detectWeakHour,
    detectStrongDay,
    detectOvertrading,
    detectDirectionBias,
    detectPairConcentration,
  ];

  // ⚠️ Les détecteurs qui n'annoncent aucun montant ne prennent pas la devise :
  // une fonction à deux paramètres satisfait une signature à trois.
  const results: Insight[] = [];
  for (const detect of detectors) {
    const ins = detect(trades, t, devise);
    if (ins) results.push(ins);
  }

  return results.sort((a, b) => b.strength - a.strength);
}
