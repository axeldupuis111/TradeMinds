/**
 * trade-guard.ts
 * Pure "commitment device": confronts the trader with their OWN rules at the
 * moment they log a trade. Returns the rules that the new trade would break, so
 * the UI can show a confirmation gate ("you're about to break rule X — sure?").
 *
 * Intentionally conservative: only flags unambiguous, rule-backed violations.
 * No session/timing check here (the strategy "session" keys don't map cleanly
 * to a trade's local hour) — handled elsewhere.
 */

export interface GuardStrategy {
  /** Allowed pairs. Empty/null = all pairs allowed. */
  pairs: string[] | null;
  /** Max trades allowed per day. Null = no limit. */
  max_trades_per_day: number | null;
  /** Stop after this many consecutive losses. Null = no limit. */
  max_consecutive_losses: number | null;
}

export interface GuardTradeToday {
  /** Net P&L of the trade (already commission/swap-adjusted). */
  netPnl: number;
}

export interface GuardIntent {
  /** Pair of the trade about to be logged. */
  pair: string;
}

export type GuardWarningType = "wrong_pair" | "max_trades" | "consecutive_losses";

export interface GuardWarning {
  type: GuardWarningType;
  /** Values for message interpolation ({pair}, {count}, {max}, {run}). */
  values: Record<string, string | number>;
}

/**
 * @param strategy   the trader's active strategy rules
 * @param todayTrades today's already-logged trades, chronological (oldest→newest)
 * @param intent     the trade about to be logged
 */
export function checkTradeGuard(
  strategy: GuardStrategy | null,
  todayTrades: GuardTradeToday[],
  intent: GuardIntent,
): GuardWarning[] {
  if (!strategy) return [];
  const warnings: GuardWarning[] = [];

  // ── Pair not in the strategy ──────────────────────────────────────────────
  const allowed = (strategy.pairs ?? []).map((p) => p.trim().toUpperCase()).filter(Boolean);
  const pair = intent.pair.trim().toUpperCase();
  if (allowed.length > 0 && pair && !allowed.includes(pair)) {
    warnings.push({ type: "wrong_pair", values: { pair } });
  }

  // ── Max trades per day reached ────────────────────────────────────────────
  if (strategy.max_trades_per_day != null && strategy.max_trades_per_day > 0) {
    if (todayTrades.length >= strategy.max_trades_per_day) {
      warnings.push({
        type: "max_trades",
        values: { count: todayTrades.length, max: strategy.max_trades_per_day },
      });
    }
  }

  // ── Trading after N consecutive losses ────────────────────────────────────
  if (strategy.max_consecutive_losses != null && strategy.max_consecutive_losses > 0) {
    let run = 0;
    for (let i = todayTrades.length - 1; i >= 0; i--) {
      if (todayTrades[i].netPnl < 0) run++;
      else break;
    }
    if (run >= strategy.max_consecutive_losses) {
      warnings.push({
        type: "consecutive_losses",
        values: { run, max: strategy.max_consecutive_losses },
      });
    }
  }

  return warnings;
}
