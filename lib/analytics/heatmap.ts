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
  // raw accumulators
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

/** Bounds for colour interpolation and legend. */
export function getHeatmapBounds(cells: HeatmapCell[][]): {
  minPnl: number;
  maxPnl: number;
  totalTrades: number;
} {
  let minPnl = 0;
  let maxPnl = 0;
  let totalTrades = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.trades === 0) continue;
      if (cell.pnl < minPnl) minPnl = cell.pnl;
      if (cell.pnl > maxPnl) maxPnl = cell.pnl;
      totalTrades += cell.trades;
    }
  }

  return { minPnl, maxPnl, totalTrades };
}
