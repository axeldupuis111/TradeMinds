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
  /** Strategy's allowed pairs (upper-case). Null/empty = not enforced. */
  allowedPairs?: string[] | null;
}

export interface DayDisciplineInput {
  /** Number of trades that day. */
  count: number;
  /** Net P&L that day (commission/swap included). */
  netPnl: number;
  /** Pairs traded that day (any case). */
  pairs?: string[];
}

export type DayBreach = "over_trades" | "daily_loss" | "wrong_pair";

/** Returns the rule-backed breaches for a single day (empty = clean). */
export function dayBreaches(day: DayDisciplineInput, rules: DayDisciplineRules): DayBreach[] {
  const breaches: DayBreach[] = [];
  if (rules.maxTradesPerDay != null && rules.maxTradesPerDay > 0 && day.count > rules.maxTradesPerDay) {
    breaches.push("over_trades");
  }
  if (rules.maxDailyLossEur != null && rules.maxDailyLossEur > 0 && day.netPnl <= -rules.maxDailyLossEur) {
    breaches.push("daily_loss");
  }
  const allowed = (rules.allowedPairs ?? []).map((p) => p.trim().toUpperCase()).filter(Boolean);
  if (allowed.length > 0 && (day.pairs ?? []).some((p) => p.trim() && !allowed.includes(p.trim().toUpperCase()))) {
    breaches.push("wrong_pair");
  }
  return breaches;
}

/** True when at least one rule can be evaluated (otherwise the overlay is hidden). */
export function hasDisciplineRules(rules: DayDisciplineRules | null | undefined): boolean {
  if (!rules) return false;
  return (
    (rules.maxTradesPerDay != null && rules.maxTradesPerDay > 0) ||
    (rules.maxDailyLossEur != null && rules.maxDailyLossEur > 0) ||
    ((rules.allowedPairs ?? []).filter((p) => p.trim()).length > 0)
  );
}
