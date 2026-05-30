import { type AnalyticsTrade, netPnl } from "./types";

/**
 * One cell of the day×hour heatmap.
 * day: 0 = Lundi, 6 = Dimanche (European convention).
 * hour: 0..23 from open_time.
 */
export type HeatmapCell = {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hour: number;
  pnl: number;       // cumulated net P&L on this cell
  trades: number;    // number of trades
  wins: number;      // winning trades
  winRate: number;   // 0..1
};

/**
 * Build a 7×24 matrix indexed [day][hour].
 * Returns an empty (all-zero) matrix if trades is empty.
 */
export function buildHeatmap(trades: AnalyticsTrade[]): HeatmapCell[][] {
  const raw: Array<Array<{ pnl: number; trades: number; wins: number }>> =
    Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ pnl: 0, trades: 0, wins: 0 }))
    );

  for (const tr of trades) {
    if (!tr.open_time) continue;
    const d = new Date(tr.open_time);
    if (isNaN(d.getTime())) continue;

    // Convert JS Sunday=0 → Monday=0 (European convention)
    const day = ((d.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hour = d.getHours();
    if (hour < 0 || hour > 23) continue;

    const net = netPnl(tr);
    raw[day][hour].pnl += net;
    raw[day][hour].trades++;
    if (net > 0) raw[day][hour].wins++;
  }

  return raw.map((row, day) =>
    row.map((cell, hour) => ({
      day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      hour,
      pnl: Number(cell.pnl.toFixed(2)),
      trades: cell.trades,
      wins: cell.wins,
      winRate: cell.trades > 0 ? cell.wins / cell.trades : 0,
    }))
  );
}

// ─── Active bounds (for auto-crop) ───────────────────────────────────────────

export type ActiveBounds = {
  minDay: number;
  maxDay: number;
  minHour: number;
  maxHour: number;
  hasData: boolean;
};

/**
 * Scan the 7×24 matrix and return the tightest bounding box that contains
 * every cell that has at least one trade.
 */
export function getActiveBounds(cells: HeatmapCell[][]): ActiveBounds {
  let minDay = 6, maxDay = 0, minHour = 23, maxHour = 0;
  let hasData = false;

  for (let d = 0; d < cells.length; d++) {
    for (let h = 0; h < cells[d].length; h++) {
      if (cells[d][h].trades > 0) {
        hasData = true;
        if (d < minDay)  minDay  = d;
        if (d > maxDay)  maxDay  = d;
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
    }
  }

  return hasData
    ? { minDay, maxDay, minHour, maxHour, hasData: true }
    : { minDay: 0, maxDay: 6, minHour: 0, maxHour: 23, hasData: false };
}

// ─── Percentile helper ────────────────────────────────────────────────────────

/** Linear-interpolated percentile on a pre-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── Bounds ───────────────────────────────────────────────────────────────────

export type HeatmapBounds = {
  /** p90 of positive-PnL cells — clipping ceiling for green interpolation. */
  pClipHigh: number;
  /** p10 of negative-PnL cells (negative value) — clipping floor for red. */
  pClipLow: number;
  /** Raw min PnL across all active cells — used for legend label only. */
  minPnl: number;
  /** Raw max PnL across all active cells — used for legend label only. */
  maxPnl: number;
  totalTrades: number;
};

/**
 * Compute colour-interpolation bounds using separate percentile pools for
 * positive and negative cells.
 *
 * Why separate pools: mixing positive + negative PnL values into a single
 * p10/p90 calculation biases the clipping when the distribution is
 * asymmetric (e.g. 80 % positive cells → p10 lands near 0 and nearly all
 * negative cells saturate immediately).
 */
export function getHeatmapBounds(cells: HeatmapCell[][]): HeatmapBounds {
  const positives: number[] = [];
  const negatives: number[] = [];
  let minPnl = 0;
  let maxPnl = 0;
  let totalTrades = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.trades === 0) continue;
      totalTrades += cell.trades;
      if (cell.pnl < minPnl) minPnl = cell.pnl;
      if (cell.pnl > maxPnl) maxPnl = cell.pnl;
      if (cell.pnl > 0) positives.push(cell.pnl);
      if (cell.pnl < 0) negatives.push(cell.pnl);
    }
  }

  positives.sort((a, b) => a - b);
  negatives.sort((a, b) => a - b); // ascending: most-negative first

  // Use p95 of positives as ceiling (or raw max if pool too small)
  const pClipHigh =
    positives.length >= 5 ? percentile(positives, 0.95) : maxPnl;

  // Use p05 of negatives as floor — p05 on ascending-sorted negatives gives
  // the 5th-percentile, i.e. the value at 5 % from the most-negative end
  const pClipLow =
    negatives.length >= 5 ? percentile(negatives, 0.05) : minPnl;

  return { pClipHigh, pClipLow, minPnl, maxPnl, totalTrades };
}
