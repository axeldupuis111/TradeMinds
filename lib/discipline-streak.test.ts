import { describe, it, expect } from "vitest";
import { computeDisciplineStreaks, type DisciplineDay } from "./discipline-streak";

const d = (day: string, emotional = false): DisciplineDay => ({ day, emotional });

describe("computeDisciplineStreaks", () => {
  it("returns zeros with no data", () => {
    expect(computeDisciplineStreaks([])).toEqual({ current: 0, record: 0, isRecord: false });
  });

  it("counts a clean trailing streak and marks it as the record", () => {
    const r = computeDisciplineStreaks([d("2026-06-01"), d("2026-06-02"), d("2026-06-03")]);
    expect(r).toEqual({ current: 3, record: 3, isRecord: true });
  });

  it("breaks the current streak on the most recent emotional day", () => {
    const r = computeDisciplineStreaks([d("2026-06-01"), d("2026-06-02"), d("2026-06-03", true)]);
    expect(r.current).toBe(0);
    expect(r.record).toBe(2);
    expect(r.isRecord).toBe(false);
  });

  it("keeps a higher past record above the current streak", () => {
    // 4 clean, then a slip, then 2 clean → record 4, current 2
    const r = computeDisciplineStreaks([
      d("2026-06-01"), d("2026-06-02"), d("2026-06-03"), d("2026-06-04"),
      d("2026-06-05", true),
      d("2026-06-06"), d("2026-06-09"),
    ]);
    expect(r).toEqual({ current: 2, record: 4, isRecord: false });
  });

  it("ignores calendar gaps (weekend-aware: only trading days count)", () => {
    // Fri, Mon, Tue — non-consecutive calendar days but consecutive trading days
    const r = computeDisciplineStreaks([d("2026-06-05"), d("2026-06-08"), d("2026-06-09")]);
    expect(r.current).toBe(3);
    expect(r.record).toBe(3);
  });

  it("flags a new record when the current run ties the previous best", () => {
    const r = computeDisciplineStreaks([
      d("2026-06-01"), d("2026-06-02"),
      d("2026-06-03", true),
      d("2026-06-04"), d("2026-06-05"),
    ]);
    expect(r).toEqual({ current: 2, record: 2, isRecord: true });
  });

  it("de-duplicates multiple trades on the same day (one bad trade taints the day)", () => {
    const r = computeDisciplineStreaks([d("2026-06-01"), d("2026-06-01", true), d("2026-06-02")]);
    expect(r.current).toBe(1); // 06-01 is tainted, only 06-02 clean at the end
    expect(r.record).toBe(1);
  });
});
