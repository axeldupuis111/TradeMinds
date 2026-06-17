import { describe, it, expect } from "vitest";
import { projectChallenge, barrierProbability } from "./challenge-projection";

describe("barrierProbability (gambler's ruin with drift)", () => {
  it("reduces to b/(a+b) with no edge (driftless)", () => {
    // equal barriers, no drift → 50/50
    expect(barrierProbability(100, 100, 0, 50)).toBeCloseTo(0.5, 5);
    // closer to the target than the floor → > 0.5
    expect(barrierProbability(50, 150, 0, 50)).toBeCloseTo(0.75, 5);
  });

  it("rises above the fair value with positive drift (an edge)", () => {
    const fair = barrierProbability(100, 100, 0, 50);
    const withEdge = barrierProbability(100, 100, 5, 50);
    expect(withEdge).toBeGreaterThan(fair);
    expect(withEdge).toBeLessThanOrEqual(1);
  });

  it("falls below the fair value with negative drift", () => {
    expect(barrierProbability(100, 100, -5, 50)).toBeLessThan(0.5);
  });

  it("handles the edge cases", () => {
    expect(barrierProbability(0, 100, 1, 50)).toBe(1); // target reached
    expect(barrierProbability(100, 0, 1, 50)).toBe(0); // at the floor
    expect(barrierProbability(100, 100, 1, 0)).toBe(1); // deterministic win (drift>0, no variance)
  });
});

describe("projectChallenge", () => {
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => `2026-06-${String((i % 28) + 1).padStart(2, "0")}T10:00:00`);

  it("returns passed when no profit remains", () => {
    const r = projectChallenge({ profitRemainingEur: 0, ddBufferEur: 5000, tradePnls: [], tradeDays: [] });
    expect(r.status).toBe("passed");
    expect(r.successProb).toBe(1);
  });

  it("returns failed when the drawdown buffer is gone", () => {
    const r = projectChallenge({ profitRemainingEur: 1000, ddBufferEur: 0, tradePnls: [], tradeDays: [] });
    expect(r.status).toBe("failed");
    expect(r.successProb).toBe(0);
  });

  it("flags insufficient data below 10 trades but still gives a pace", () => {
    const pnls = [100, 100, 100]; // 3 trades over 3 days = 100/day
    const r = projectChallenge({
      profitRemainingEur: 1000,
      ddBufferEur: 5000,
      tradePnls: pnls,
      tradeDays: days(3),
    });
    expect(r.status).toBe("insufficient");
    expect(r.successProb).toBeNull();
    expect(r.pacePerDay).toBeCloseTo(100);
    expect(r.daysToTarget).toBe(10); // 1000 / 100
  });

  it("projects a high probability for a consistent winner with a big buffer", () => {
    const pnls = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 120 : -40)); // net positive edge
    const r = projectChallenge({
      profitRemainingEur: 500,
      ddBufferEur: 5000,
      tradePnls: pnls,
      tradeDays: days(20),
    });
    expect(r.successProb).not.toBeNull();
    expect(r.successProb!).toBeGreaterThan(0.6);
    expect(r.status).toBe("on_track");
  });

  it("projects a low probability for a net loser close to the floor", () => {
    const pnls = Array.from({ length: 20 }, (_, i) => (i % 3 === 0 ? 50 : -60)); // negative edge
    const r = projectChallenge({
      profitRemainingEur: 2000,
      ddBufferEur: 400,
      tradePnls: pnls,
      tradeDays: days(20),
    });
    expect(r.successProb!).toBeLessThan(0.35);
    expect(r.status).toBe("at_risk");
    expect(r.daysToTarget).toBeNull(); // losing pace → no ETA
  });
});
