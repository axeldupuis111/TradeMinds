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

export type GuardWarningType =
  | "wrong_pair"
  | "max_trades"
  | "consecutive_losses"
  | "daily_loss";

export interface GuardWarning {
  type: GuardWarningType;
  /** Values for message interpolation ({pair}, {count}, {max}, {run}, {lost}, {limit}). */
  values: Record<string, string | number>;
}

export interface GuardContext {
  /** Max daily loss in account currency (€). Null/0 = no limit. */
  dailyLossLimit?: number | null;
  /** Net P&L so far today (closed trades), in account currency. */
  netPnlToday?: number;
}

/**
 * @param strategy   the trader's active strategy rules
 * @param todayTrades today's already-logged trades, chronological (oldest→newest)
 * @param intent     the trade about to be logged
 * @param context    account-level context (daily loss limit + today's net P&L)
 */
export function checkTradeGuard(
  strategy: GuardStrategy | null,
  todayTrades: GuardTradeToday[],
  intent: GuardIntent,
  context: GuardContext = {},
): GuardWarning[] {
  const warnings: GuardWarning[] = [];

  // ── Daily loss limit reached ──────────────────────────────────────────────
  // Account-level rule, independent of the strategy: if the trader has already
  // burned through their max daily loss, opening another trade is the textbook
  // prop-firm blow-up — confront them even with no strategy set.
  const limit = context.dailyLossLimit ?? null;
  const net = context.netPnlToday ?? 0;
  if (limit != null && limit > 0 && net <= -limit) {
    warnings.push({ type: "daily_loss", values: { lost: Math.round(-net), limit: Math.round(limit) } });
  }

  if (!strategy) return warnings;

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
