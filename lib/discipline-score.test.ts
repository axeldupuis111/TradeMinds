import { describe, it, expect } from "vitest";
import { computeDisciplineScore, type Violation } from "./discipline-score";

function v(partial: Partial<Violation> & Pick<Violation, "category" | "type">): Violation {
  return {
    trade_ids: [],
    occurrences: 1,
    explanation: "",
    ...partial,
  };
}

describe("computeDisciplineScore", () => {
  it("flags insufficient data and scores 0 when there are no trades", () => {
    const result = computeDisciplineScore([], 0);
    expect(result.insufficient).toBe(true);
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("returns a perfect score with no violations", () => {
    const result = computeDisciplineScore([], 10);
    expect(result.insufficient).toBe(false);
    expect(result.score).toBe(100);
    expect(result.totalDeducted).toBe(0);
  });

  it("deducts perOccurrence × occurrences for a single violation", () => {
    // wrong_pair = 10 per occurrence
    const result = computeDisciplineScore(
      [v({ category: "strategy", type: "wrong_pair", occurrences: 2 })],
      10,
    );
    expect(result.totalDeducted).toBe(20);
    expect(result.score).toBe(80);
  });

  it("caps each category independently", () => {
    // execution cap = 20. missing_sl(5) + missing_tp(3) heavily repeated must
    // not exceed the cap.
    const result = computeDisciplineScore(
      [
        v({ category: "execution", type: "missing_sl", occurrences: 10 }), // raw 50
        v({ category: "execution", type: "missing_tp", occurrences: 10 }), // raw 30
      ],
      20,
    );
    const execution = result.breakdown.find((b) => b.category === "execution")!;
    expect(execution.totalRaw).toBe(80);
    expect(execution.totalCapped).toBe(20);
    expect(result.score).toBe(80);
  });

  it("sums capped deductions across categories", () => {
    const result = computeDisciplineScore(
      [
        v({ category: "strategy", type: "wrong_pair", occurrences: 10 }), // raw 100 → capped 40
        v({ category: "behavior", type: "revenge_trading", occurrences: 10 }), // raw 200 → capped 40
        v({ category: "execution", type: "missing_sl", occurrences: 10 }), // raw 50 → capped 20
      ],
      30,
    );
    // 40 + 40 + 20 = 100 deducted
    expect(result.totalDeducted).toBe(100);
    expect(result.score).toBe(0);
  });

  it("never returns a score below 0", () => {
    const result = computeDisciplineScore(
      [
        v({ category: "strategy", type: "wrong_pair", occurrences: 100 }),
        v({ category: "behavior", type: "revenge_trading", occurrences: 100 }),
        v({ category: "execution", type: "missing_sl", occurrences: 100 }),
      ],
      5,
    );
    expect(result.score).toBe(0);
  });

  it("ignores unknown violation types", () => {
    const result = computeDisciplineScore(
      [v({ category: "strategy", type: "not_a_real_type" as Violation["type"] })],
      10,
    );
    expect(result.score).toBe(100);
    expect(result.totalDeducted).toBe(0);
  });
});
