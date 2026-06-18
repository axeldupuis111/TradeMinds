import { describe, it, expect } from "vitest";
import { dayBreaches, hasDisciplineRules, type DayDisciplineRules } from "./calendar-discipline";

const rules: DayDisciplineRules = { maxTradesPerDay: 3, maxDailyLossEur: 500 };

describe("dayBreaches", () => {
  it("returns nothing for a clean disciplined day", () => {
    expect(dayBreaches({ count: 2, netPnl: -120 }, rules)).toEqual([]);
  });

  it("flags over-trading", () => {
    expect(dayBreaches({ count: 5, netPnl: 200 }, rules)).toEqual(["over_trades"]);
  });

  it("flags a daily-loss breach even on a low trade count", () => {
    expect(dayBreaches({ count: 1, netPnl: -540 }, rules)).toEqual(["daily_loss"]);
  });

  it("flags both at once", () => {
    expect(dayBreaches({ count: 6, netPnl: -600 }, rules).sort()).toEqual(["daily_loss", "over_trades"]);
  });

  it("does not flag a green day that respected the count", () => {
    expect(dayBreaches({ count: 3, netPnl: 800 }, rules)).toEqual([]);
  });

  it("skips checks when rules are not set", () => {
    expect(dayBreaches({ count: 99, netPnl: -99999 }, { maxTradesPerDay: null, maxDailyLossEur: null })).toEqual([]);
  });

  it("flags an off-plan pair (case/space-insensitive)", () => {
    const r = dayBreaches(
      { count: 1, netPnl: 50, pairs: [" gbpusd "] },
      { maxTradesPerDay: 3, maxDailyLossEur: 500, allowedPairs: ["XAUUSD"] },
    );
    expect(r).toEqual(["wrong_pair"]);
  });

  it("does not flag when every traded pair is allowed", () => {
    const r = dayBreaches(
      { count: 2, netPnl: 50, pairs: ["XAUUSD", "xauusd"] },
      { maxTradesPerDay: 3, maxDailyLossEur: 500, allowedPairs: ["XAUUSD", "EURUSD"] },
    );
    expect(r.some((b) => b === "wrong_pair")).toBe(false);
  });

  it("ignores the pair check when the strategy lists no pairs", () => {
    const r = dayBreaches(
      { count: 1, netPnl: 50, pairs: ["GBPUSD"] },
      { maxTradesPerDay: 3, maxDailyLossEur: 500, allowedPairs: null },
    );
    expect(r).toEqual([]);
  });
});

describe("hasDisciplineRules", () => {
  it("is false when nothing is enforceable", () => {
    expect(hasDisciplineRules(null)).toBe(false);
    expect(hasDisciplineRules({ maxTradesPerDay: null, maxDailyLossEur: 0 })).toBe(false);
  });
  it("is true when at least one rule exists", () => {
    expect(hasDisciplineRules({ maxTradesPerDay: 4, maxDailyLossEur: null })).toBe(true);
    expect(hasDisciplineRules({ maxTradesPerDay: null, maxDailyLossEur: 500 })).toBe(true);
  });
});
