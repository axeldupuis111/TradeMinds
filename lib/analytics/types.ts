/**
 * Shared analytic trade type — minimal subset used by heatmap + insights.
 * Compatible (structural typing) with TradeRow in analytics/page.tsx.
 */
export type AnalyticsTrade = {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
  direction: string; // "long" | "short" in practice
};

/** Net P&L after commission and swap. */
export function netPnl(tr: AnalyticsTrade): number {
  return tr.pnl + (tr.commission ?? 0) + (tr.swap ?? 0);
}
