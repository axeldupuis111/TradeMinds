/**
 * calendar-discipline.ts
 * Pure, deterministic per-day "process" check for the trading calendar.
 *
 * The calendar colours days by P&L (outcome). This adds the orthogonal signal
 * the app is actually about: did the trader respect their process that day?
 * A green (profitable) day can still break the rules; a red day can be perfectly
 * disciplined. We only flag objective, rule-backed day-level breaches — no AI,
 * no guesswork.
 */

export interface DayDisciplineRules {
  /** Strategy's max trades per day. Null/0 = not enforced. */
  maxTradesPerDay: number | null;
  /** Account's max daily loss in currency (€). Null/0 = not enforced. */
  maxDailyLossEur: number | null;
}

export interface DayDisciplineInput {
  /** Number of trades that day. */
  count: number;
  /** Net P&L that day (commission/swap included). */
  netPnl: number;
}

export type DayBreach = "over_trades" | "daily_loss";

/** Returns the rule-backed breaches for a single day (empty = clean). */
export function dayBreaches(day: DayDisciplineInput, rules: DayDisciplineRules): DayBreach[] {
  const breaches: DayBreach[] = [];
  if (rules.maxTradesPerDay != null && rules.maxTradesPerDay > 0 && day.count > rules.maxTradesPerDay) {
    breaches.push("over_trades");
  }
  if (rules.maxDailyLossEur != null && rules.maxDailyLossEur > 0 && day.netPnl <= -rules.maxDailyLossEur) {
    breaches.push("daily_loss");
  }
  return breaches;
}

/** True when at least one rule can be evaluated (otherwise the overlay is hidden). */
export function hasDisciplineRules(rules: DayDisciplineRules | null | undefined): boolean {
  if (!rules) return false;
  return (
    (rules.maxTradesPerDay != null && rules.maxTradesPerDay > 0) ||
    (rules.maxDailyLossEur != null && rules.maxDailyLossEur > 0)
  );
}
