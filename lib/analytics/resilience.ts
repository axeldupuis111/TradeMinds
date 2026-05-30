import { type AnalyticsTrade, netPnl } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawdownPoint = {
  tradeIndex: number;
  cumPnl: number;
  drawdown: number;      // € below peak (always >= 0)
  drawdownPct: number;   // % below peak
  peak: number;          // running peak at this point
};

export type Streak = {
  type: "win" | "loss";
  length: number;
  startIndex: number;
  endIndex: number;
};

export type ResilienceInsight = {
  id: string;
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  strength: number; // 0..1 — used for sorting
};

// ─── Drawdown series ──────────────────────────────────────────────────────────

/**
 * Build a cumulative drawdown series, one point per trade sorted by open_time.
 * Drawdown is measured from the running all-time peak.
 */
export function buildDrawdownSeries(trades: AnalyticsTrade[]): DrawdownPoint[] {
  if (trades.length === 0) return [];

  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  let cumPnl = 0;
  let peak = 0;
  const series: DrawdownPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    cumPnl += netPnl(sorted[i]);
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak > 0 ? Math.max(0, peak - cumPnl) : 0;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
    series.push({
      tradeIndex: i,
      cumPnl: Number(cumPnl.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
      drawdownPct: Number(drawdownPct.toFixed(2)),
      peak: Number(peak.toFixed(2)),
    });
  }

  return series;
}

// ─── Max drawdown ─────────────────────────────────────────────────────────────

export type MaxDrawdownResult = {
  maxDrawdown: number;      // € worst drawdown
  maxDrawdownPct: number;   // % worst drawdown
  recoveryTrades: number | null; // trades to recover (null = not recovered)
};

export function getMaxDrawdown(series: DrawdownPoint[]): MaxDrawdownResult {
  if (series.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0, recoveryTrades: null };
  }

  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let maxDrawdownIdx = 0;

  for (let i = 0; i < series.length; i++) {
    if (series[i].drawdown > maxDrawdown) {
      maxDrawdown = series[i].drawdown;
      maxDrawdownPct = series[i].drawdownPct;
      maxDrawdownIdx = i;
    }
  }

  if (maxDrawdown === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0, recoveryTrades: 0 };
  }

  // Find the peak value that was lost
  const peakAtMaxDD = series[maxDrawdownIdx].peak;

  // Count trades from maxDrawdownIdx+1 until cumPnl >= peakAtMaxDD
  let recoveryTrades: number | null = null;
  for (let i = maxDrawdownIdx + 1; i < series.length; i++) {
    if (series[i].cumPnl >= peakAtMaxDD) {
      recoveryTrades = i - maxDrawdownIdx;
      break;
    }
  }

  return {
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    recoveryTrades,
  };
}

// ─── Streak builder ───────────────────────────────────────────────────────────

/**
 * Build chronological win/loss streaks.
 * Trades with pnl === 0 break the current streak (treated as neutral, skipped).
 */
export function buildStreaks(trades: AnalyticsTrade[]): Streak[] {
  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const streaks: Streak[] = [];
  let current: Streak | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const pnl = netPnl(sorted[i]);
    if (pnl === 0) {
      // Break current streak
      if (current) {
        streaks.push(current);
        current = null;
      }
      continue;
    }
    const type: "win" | "loss" = pnl > 0 ? "win" : "loss";
    if (current && current.type === type) {
      current.length++;
      current.endIndex = i;
    } else {
      if (current) streaks.push(current);
      current = { type, length: 1, startIndex: i, endIndex: i };
    }
  }
  if (current) streaks.push(current);

  return streaks;
}

// ─── Streak stats ─────────────────────────────────────────────────────────────

export type StreakStats = {
  longestWin: number;
  longestLoss: number;
  current: { type: "win" | "loss" | "none"; length: number };
  streaks: Streak[];
};

export function getStreakStats(streaks: Streak[]): StreakStats {
  let longestWin = 0;
  let longestLoss = 0;

  for (const s of streaks) {
    if (s.type === "win"  && s.length > longestWin)  longestWin  = s.length;
    if (s.type === "loss" && s.length > longestLoss) longestLoss = s.length;
  }

  const last = streaks[streaks.length - 1];
  const current = last
    ? { type: last.type, length: last.length }
    : { type: "none" as const, length: 0 };

  return { longestWin, longestLoss, current, streaks };
}

// ─── Median helper ────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Insight detectors ────────────────────────────────────────────────────────

/** After 3+ loss streak, does the win rate drop >= 10 pts vs global? */
function detectPostLossDecline(
  trades: AnalyticsTrade[],
  streaks: Streak[],
  globalWR: number,
): ResilienceInsight | null {
  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const postTrades: AnalyticsTrade[] = [];

  for (const streak of streaks) {
    if (streak.type !== "loss" || streak.length < 3) continue;
    // Collect the 5 trades immediately after this streak
    const afterStart = streak.endIndex + 1;
    const afterEnd   = Math.min(afterStart + 5, sorted.length);
    for (let i = afterStart; i < afterEnd; i++) {
      postTrades.push(sorted[i]);
    }
  }

  if (postTrades.length < 5) return null;

  const wins = postTrades.filter((t) => netPnl(t) > 0).length;
  const wr   = (wins / postTrades.length) * 100;
  const drop = globalWR - wr;

  if (drop < 10) return null;

  return {
    id: "post_loss_decline",
    type: "negative",
    title: "Baisse après série perdante",
    description: `Ton win rate chute de ${Math.round(drop)} pts après 3+ pertes consécutives (${Math.round(wr)}% vs ${Math.round(globalWR)}% global). Prends une pause.`,
    strength: Math.min(1, drop / 40),
  };
}

/** After losses, does the win rate stay >= 1.2× global? */
function detectComeback(
  trades: AnalyticsTrade[],
  streaks: Streak[],
  globalWR: number,
): ResilienceInsight | null {
  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const postTrades: AnalyticsTrade[] = [];

  for (const streak of streaks) {
    if (streak.type !== "loss" || streak.length < 2) continue;
    const afterStart = streak.endIndex + 1;
    const afterEnd   = Math.min(afterStart + 5, sorted.length);
    for (let i = afterStart; i < afterEnd; i++) {
      postTrades.push(sorted[i]);
    }
  }

  if (postTrades.length < 5) return null;

  const wins = postTrades.filter((t) => netPnl(t) > 0).length;
  const wr   = (wins / postTrades.length) * 100;

  if (wr < globalWR * 1.2) return null;

  return {
    id: "comeback",
    type: "positive",
    title: "Excellente résilience",
    description: `Après des pertes, tu rebondis fort : ${Math.round(wr)}% de win rate (vs ${Math.round(globalWR)}% global). Tu sais gérer la pression.`,
    strength: Math.min(1, (wr - globalWR) / globalWR),
  };
}

/**
 * Detect drawdown events where drawdownPct crosses 5%.
 * Count trades to recover above previous peak.
 * Exclude unrecovered events. Fire if >= 3 recovered events AND median <= 5 trades.
 */
function detectAverageRecovery(series: DrawdownPoint[]): ResilienceInsight | null {
  if (series.length === 0) return null;

  const recoveryCounts: number[] = [];
  let i = 0;

  while (i < series.length) {
    // Find start of a drawdown event (drawdownPct crosses 5%)
    if (series[i].drawdownPct < 5) { i++; continue; }

    // We're in a drawdown >= 5% — record the peak we need to recover
    const targetPeak = series[i].peak;

    // Find the trough (deepest point of this event)
    let troughIdx = i;
    while (troughIdx + 1 < series.length && series[troughIdx + 1].drawdown >= series[troughIdx].drawdown) {
      troughIdx++;
    }

    // From trough onwards, find recovery (cumPnl >= targetPeak)
    let recovered = false;
    for (let j = troughIdx + 1; j < series.length; j++) {
      if (series[j].cumPnl >= targetPeak) {
        recoveryCounts.push(j - troughIdx);
        recovered = true;
        i = j + 1; // advance past this recovered event
        break;
      }
    }

    if (!recovered) {
      // Event not recovered — skip this entire drawdown
      i = troughIdx + 1;
    }
  }

  if (recoveryCounts.length < 3) return null;

  const med = median(recoveryCounts);
  if (med > 5) return null;

  return {
    id: "avg_recovery",
    type: "positive",
    title: "Récupération rapide",
    description: `Tu reviens à ton pic en médiane ${Math.round(med)} trade${med > 1 ? "s" : ""} après un drawdown. Excellent contrôle de risque.`,
    strength: Math.min(1, (6 - med) / 5),
  };
}

/**
 * Detect revenge trading: trades within 90 min of a big loss (>= 1.5× avg loss).
 * Fire if >= 5 revenge trades AND their avg P&L is significantly worse than global.
 */
function detectRevengeTrading(trades: AnalyticsTrade[]): ResilienceInsight | null {
  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  if (sorted.length === 0) return null;

  // Compute average loss (negative values)
  const losses = sorted.map(netPnl).filter((p) => p < 0);
  if (losses.length === 0) return null;
  const avgLoss = losses.reduce((s, v) => s + v, 0) / losses.length; // negative
  const bigLossThreshold = avgLoss * 1.5; // more negative than avgLoss

  const revengeTrades: AnalyticsTrade[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const pnl = netPnl(sorted[i]);
    if (pnl > bigLossThreshold) continue; // not a big loss

    const bigLossTime  = new Date(sorted[i].open_time).getTime();
    const windowEnd    = bigLossTime + 90 * 60 * 1000; // +90 minutes

    for (let j = i + 1; j < sorted.length; j++) {
      const t = new Date(sorted[j].open_time).getTime();
      if (t <= bigLossTime) continue;
      if (t > windowEnd) break;
      revengeTrades.push(sorted[j]);
    }
  }

  if (revengeTrades.length < 5) return null;

  const revengeAvgPnl = revengeTrades.reduce((s, t) => s + netPnl(t), 0) / revengeTrades.length;
  const globalAvgPnl  = sorted.reduce((s, t) => s + netPnl(t), 0) / sorted.length;

  // Fire only if revenge trades perform significantly worse (>= 20% worse)
  if (revengeAvgPnl >= globalAvgPnl * 0.8) return null;

  return {
    id: "revenge_trading",
    type: "negative",
    title: "Trading revenge détecté",
    description: `${revengeTrades.length} trades passés dans les 90 min après une grosse perte ont un P&L moyen de ${revengeAvgPnl.toFixed(0)}€ vs ${globalAvgPnl.toFixed(0)}€ global. Arrête-toi après une grosse perte.`,
    strength: Math.min(1, Math.abs(revengeAvgPnl - globalAvgPnl) / (Math.abs(globalAvgPnl) + 1)),
  };
}

/**
 * After 3+ win streaks, collect the 5 trades that follow each.
 * Fire if >= 5 such trades AND their P&L is worse than global avg.
 */
function detectAfterStreakPattern(
  trades: AnalyticsTrade[],
  streaks: Streak[],
  globalAvgPnl: number,
): ResilienceInsight | null {
  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const afterStreakTrades: AnalyticsTrade[] = [];

  for (const streak of streaks) {
    if (streak.type !== "win" || streak.length < 3) continue;
    const afterStart = streak.endIndex + 1;
    const afterEnd   = Math.min(afterStart + 5, sorted.length);
    for (let i = afterStart; i < afterEnd; i++) {
      afterStreakTrades.push(sorted[i]);
    }
  }

  if (afterStreakTrades.length < 5) return null;

  const afterAvgPnl = afterStreakTrades.reduce((s, t) => s + netPnl(t), 0) / afterStreakTrades.length;

  if (afterAvgPnl >= globalAvgPnl) return null;

  return {
    id: "after_streak_pattern",
    type: "negative",
    title: "Relâchement après série gagnante",
    description: `Après 3+ wins consécutifs, tes trades suivants baissent à ${afterAvgPnl.toFixed(0)}€ de P&L moyen (vs ${globalAvgPnl.toFixed(0)}€). Reste discipliné.`,
    strength: Math.min(1, Math.abs(afterAvgPnl - globalAvgPnl) / (Math.abs(globalAvgPnl) + 1)),
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate up to 3 resilience insights, sorted by strength desc.
 * Returns [] if trades.length < 20 or no insights fire.
 */
export function generateResilienceInsights(trades: AnalyticsTrade[]): ResilienceInsight[] {
  if (trades.length < 20) return [];

  const sorted = [...trades]
    .filter((t) => t.open_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const pnls      = sorted.map(netPnl);
  const wins      = pnls.filter((p) => p > 0).length;
  const globalWR  = (wins / sorted.length) * 100;
  const globalAvgPnl = pnls.reduce((s, v) => s + v, 0) / sorted.length;

  const streaks   = buildStreaks(sorted);
  const ddSeries  = buildDrawdownSeries(sorted);

  const candidates: (ResilienceInsight | null)[] = [
    detectComeback(sorted, streaks, globalWR),
    detectAverageRecovery(ddSeries),
    detectPostLossDecline(sorted, streaks, globalWR),
    detectRevengeTrading(sorted),
    detectAfterStreakPattern(sorted, streaks, globalAvgPnl),
  ];

  return candidates
    .filter((i): i is ResilienceInsight => i !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
}
