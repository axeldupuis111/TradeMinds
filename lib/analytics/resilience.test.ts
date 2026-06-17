import { describe, it, expect } from "vitest";
import { generateResilienceInsights } from "./resilience";
import type { AnalyticsTrade } from "./types";
import fr from "@/lib/i18n/fr";

const tKey = (k: string) => k;
const tFr = (k: string) => fr[k] ?? k;

function trade(open_time: string, pnl: number): AnalyticsTrade {
  return { open_time, pnl, commission: 0, swap: 0, pair: "XAUUSD", direction: "long" };
}

// 14 winners (one per day), then a big loss, then 6 small losses within 90 min of it.
// → a long win streak followed by a sharp drop ("after_streak_pattern"), and a
//   cluster of trades right after a big loss ("revenge_trading").
const dataset: AnalyticsTrade[] = [
  ...Array.from({ length: 14 }, (_, d) =>
    trade(`2026-06-${String(d + 1).padStart(2, "0")}T12:00:00`, 20),
  ),
  trade("2026-06-15T10:00:00", -800),
  trade("2026-06-15T10:05:00", -40),
  trade("2026-06-15T10:15:00", -40),
  trade("2026-06-15T10:25:00", -40),
  trade("2026-06-15T10:35:00", -40),
  trade("2026-06-15T10:45:00", -40),
  trade("2026-06-15T10:55:00", -40),
];

describe("generateResilienceInsights", () => {
  it("returns nothing below 20 trades", () => {
    expect(generateResilienceInsights(dataset.slice(0, 19), tKey)).toEqual([]);
  });

  it("returns at most 3 insights, sorted by strength desc", () => {
    const insights = generateResilienceInsights(dataset, tKey);
    expect(insights.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i - 1].strength).toBeGreaterThanOrEqual(insights[i].strength);
    }
  });

  it("detects the let-up after a winning streak", () => {
    const ids = generateResilienceInsights(dataset, tKey).map((i) => i.id);
    expect(ids).toContain("after_streak_pattern");
  });

  it("leaves no unreplaced {placeholder} in any title or description", () => {
    for (const insight of generateResilienceInsights(dataset, tFr)) {
      expect(insight.title, `title of ${insight.id}`).not.toMatch(/\{[a-z]+\}/);
      expect(insight.description, `desc of ${insight.id}`).not.toMatch(/\{[a-z]+\}/);
      expect(insight.title.length).toBeGreaterThan(0);
    }
  });
});
