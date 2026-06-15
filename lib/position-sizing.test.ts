import { describe, it, expect } from "vitest";
import {
  getDefaultPipValuePerLot,
  getUnitsPerLot,
  computeMaxRiskEur,
  computeLotSize,
  computeContracts,
  actualRiskForContracts,
} from "./position-sizing";

describe("getDefaultPipValuePerLot / getUnitsPerLot", () => {
  it("returns known defaults for forex and metals", () => {
    expect(getDefaultPipValuePerLot("EURUSD")).toBe(10);
    expect(getDefaultPipValuePerLot("USDJPY")).toBe(9);
    expect(getDefaultPipValuePerLot("XAUUSD")).toBe(10);
    expect(getDefaultPipValuePerLot("XAGUSD")).toBe(50);
    expect(getUnitsPerLot("EURUSD")).toBe(100000);
    expect(getUnitsPerLot("XAUUSD")).toBe(100);
  });

  it("returns null where contract specs vary by broker", () => {
    expect(getDefaultPipValuePerLot("NAS100")).toBeNull();
    expect(getDefaultPipValuePerLot("BTCUSD")).toBeNull();
    expect(getUnitsPerLot("WTIUSD")).toBeNull();
  });
});

describe("computeMaxRiskEur", () => {
  it("uses the strategy risk_pct when no DD ceilings are given", () => {
    const r = computeMaxRiskEur({ riskPct: 1, accountSize: 50_000 });
    expect(r).toEqual({ riskEur: 500, cappedBy: "risk_pct" });
  });

  it("returns null when nothing constrains the risk", () => {
    expect(computeMaxRiskEur({ riskPct: null, accountSize: 50_000 })).toBeNull();
    expect(computeMaxRiskEur({ riskPct: 0, accountSize: 50_000 })).toBeNull();
  });

  it("picks the most restrictive ceiling", () => {
    const r = computeMaxRiskEur({
      riskPct: 2, // 1_000
      accountSize: 50_000,
      dailyDdRemainingEur: 300,
      totalDdRemainingEur: 800,
    });
    expect(r).toEqual({ riskEur: 300, cappedBy: "daily_dd" });
  });

  it("treats a remaining DD of 0 as a real ceiling (limit reached)", () => {
    const r = computeMaxRiskEur({
      riskPct: 2,
      accountSize: 50_000,
      dailyDdRemainingEur: 0,
    });
    expect(r).toEqual({ riskEur: 0, cappedBy: "daily_dd" });
  });

  it("never returns a negative risk even if a margin is overshot", () => {
    const r = computeMaxRiskEur({
      accountSize: 50_000,
      totalDdRemainingEur: -200,
    });
    expect(r).toEqual({ riskEur: 0, cappedBy: "total_dd" });
  });
});

describe("computeLotSize", () => {
  it("converts risk € into a lot size rounded to 0.01", () => {
    // 200 € / (20 pips * 10 €/pip/lot) = 1.0 lot
    expect(computeLotSize({ riskEur: 200, slPips: 20, pipValuePerLot: 10 })).toEqual({
      lots: 1,
      raw: 1,
    });
    // 150 € / (30 * 10) = 0.5 lot
    expect(computeLotSize({ riskEur: 150, slPips: 30, pipValuePerLot: 10 })).toEqual({
      lots: 0.5,
      raw: 0.5,
    });
  });

  it("rounds to 0.01 while keeping the raw value", () => {
    const r = computeLotSize({ riskEur: 100, slPips: 33, pipValuePerLot: 10 })!;
    expect(r.lots).toBe(0.3); // 0.303... → 0.30
    expect(r.raw).toBeCloseTo(0.30303, 4);
  });

  it("returns null for invalid inputs", () => {
    expect(computeLotSize({ riskEur: 0, slPips: 20, pipValuePerLot: 10 })).toBeNull();
    expect(computeLotSize({ riskEur: 200, slPips: 0, pipValuePerLot: 10 })).toBeNull();
    expect(computeLotSize({ riskEur: 200, slPips: 20, pipValuePerLot: 0 })).toBeNull();
  });
});

describe("computeContracts (futures) — floors so risk never exceeds budget", () => {
  it("floors the contract count", () => {
    // 1000 $ / (10 pts * 50 $/pt) = 2.0 → 2 contracts
    expect(computeContracts({ riskAmount: 1000, slPoints: 10, pointValue: 50 })).toBe(2);
    // 1000 $ / (12 * 50) = 1.66 → 1 contract (never round up)
    expect(computeContracts({ riskAmount: 1000, slPoints: 12, pointValue: 50 })).toBe(1);
  });

  it("returns 0 when the budget cannot cover a single contract or inputs are invalid", () => {
    expect(computeContracts({ riskAmount: 100, slPoints: 10, pointValue: 50 })).toBe(0);
    expect(computeContracts({ riskAmount: 0, slPoints: 10, pointValue: 50 })).toBe(0);
    expect(computeContracts({ riskAmount: 1000, slPoints: 0, pointValue: 50 })).toBe(0);
  });

  it("actualRiskForContracts reflects the post-floor exposure", () => {
    const contracts = computeContracts({ riskAmount: 1000, slPoints: 12, pointValue: 50 });
    const risk = actualRiskForContracts({ contracts, slPoints: 12, pointValue: 50 });
    expect(risk).toBe(600); // 1 * 12 * 50, ≤ 1000 budget
    expect(risk).toBeLessThanOrEqual(1000);
  });
});
