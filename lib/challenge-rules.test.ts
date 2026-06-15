import { describe, it, expect } from "vitest";
import { computeChallengeRules, type ChallengeForRules } from "./challenge-rules";

const base: ChallengeForRules = {
  account_size: 100_000,
  profit_target_pct: 10, // 10_000 €
  max_daily_dd_pct: 5, //  5_000 €
  max_total_dd_pct: 10, // 10_000 €
  trailing_drawdown: false,
};

describe("computeChallengeRules — profit", () => {
  it("tracks profit toward the target", () => {
    const r = computeChallengeRules(base, 104_000, 0, []);
    expect(r.profitMax).toBe(10_000);
    expect(r.profitUsed).toBe(4_000);
    expect(r.profitRemainingEur).toBe(6_000);
    expect(r.objectiveProgressPct).toBeCloseTo(0.4);
    expect(r.currentPnl).toBe(4_000);
  });

  it("clamps profit to 0 when the account is underwater", () => {
    const r = computeChallengeRules(base, 96_000, 0, []);
    expect(r.profitUsed).toBe(0);
    expect(r.profitRemainingEur).toBe(10_000);
    expect(r.currentPnl).toBe(-4_000);
  });
});

describe("computeChallengeRules — daily drawdown", () => {
  it("consumes daily DD only from a negative today P&L", () => {
    const r = computeChallengeRules(base, 100_000, -2_000, []);
    expect(r.dailyDdMax).toBe(5_000);
    expect(r.dailyDdUsed).toBe(2_000);
    expect(r.dailyDdRemainingEur).toBe(3_000);
    expect(r.ddDailyUsedPct).toBeCloseTo(0.4);
  });

  it("uses no daily DD on a green day", () => {
    const r = computeChallengeRules(base, 100_000, 3_000, []);
    expect(r.dailyDdUsed).toBe(0);
    expect(r.dailyDdRemainingEur).toBe(5_000);
  });
});

describe("computeChallengeRules — static total drawdown", () => {
  it("measures total DD from the initial account size", () => {
    const r = computeChallengeRules(base, 93_000, 0, [98_000, 93_000]);
    // static: peak is always account_size, regardless of equity curve
    expect(r.equityHigh).toBe(100_000);
    expect(r.totalDdUsed).toBe(7_000);
    expect(r.totalDdRemainingEur).toBe(3_000);
    expect(r.ddTotalUsedPct).toBeCloseTo(0.7);
  });

  it("reports no total DD when in profit", () => {
    const r = computeChallengeRules(base, 105_000, 0, []);
    expect(r.totalDdUsed).toBe(0);
    expect(r.totalDdRemainingEur).toBe(10_000);
  });
});

describe("computeChallengeRules — trailing total drawdown", () => {
  it("measures total DD from the equity peak, not the account size", () => {
    // Peaked at 108k, now back to 104k → 4k below the trailing peak,
    // even though still +4k vs the starting balance.
    const r = computeChallengeRules(
      { ...base, trailing_drawdown: true },
      104_000,
      0,
      [103_000, 108_000, 104_000],
    );
    expect(r.equityHigh).toBe(108_000);
    expect(r.totalDdUsed).toBe(4_000);
    expect(r.totalDdRemainingEur).toBe(6_000);
  });

  it("never lets the trailing peak drop below the account size", () => {
    // Account only ever lost money → peak stays at account_size.
    const r = computeChallengeRules(
      { ...base, trailing_drawdown: true },
      97_000,
      -1_000,
      [99_000, 98_000, 97_000],
    );
    expect(r.equityHigh).toBe(100_000);
    expect(r.totalDdUsed).toBe(3_000);
  });

  it("falls back to the account size when no equity curve is supplied", () => {
    const r = computeChallengeRules({ ...base, trailing_drawdown: true }, 102_000, 0, []);
    expect(r.equityHigh).toBe(100_000);
  });
});
