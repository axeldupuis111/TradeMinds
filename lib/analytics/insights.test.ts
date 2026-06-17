import { describe, it, expect } from "vitest";
import { generateInsights } from "./insights";
import type { AnalyticsTrade } from "./types";
import fr from "@/lib/i18n/fr";

// Mock translators
const tKey = (k: string) => k; // returns the key (identity)
const tFr = (k: string) => fr[k] ?? k; // returns the real FR template

function trade(open_time: string, pnl: number, over: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return { open_time, pnl, commission: 0, swap: 0, pair: "XAUUSD", direction: "long", ...over };
}

// 15 trades at 09:00 (+10 each) and 5 at 17:00 (+100 each), same day, same pair, all long.
// → global avg 32.5; hour 17 is 3.08× → "hour-strong"; XAUUSD = 100% of P&L → "pair-concentration".
const dataset: AnalyticsTrade[] = [
  ...Array.from({ length: 15 }, () => trade("2026-06-10T09:00:00", 10)),
  ...Array.from({ length: 5 }, () => trade("2026-06-10T17:00:00", 100)),
];

describe("generateInsights", () => {
  it("returns nothing below 10 trades", () => {
    expect(generateInsights(dataset.slice(0, 9), tKey)).toEqual([]);
  });

  it("detects a strong hour and pair concentration on the crafted data", () => {
    const ids = generateInsights(dataset, tKey).map((i) => i.id);
    expect(ids).toContain("hour-strong");
    expect(ids).toContain("pair-concentration");
  });

  it("fills the {hour} placeholder with the actual strong hour (17)", () => {
    const hourStrong = generateInsights(dataset, tFr).find((i) => i.id === "hour-strong")!;
    expect(hourStrong.description).toContain("[[17h]]");
  });

  it("leaves no unreplaced {placeholder} in any title or description (interpolation complete)", () => {
    for (const insight of generateInsights(dataset, tFr)) {
      expect(insight.title, `title of ${insight.id}`).not.toMatch(/[{}]/);
      expect(insight.description, `desc of ${insight.id}`).not.toMatch(/\{[a-z]+\}/);
      expect(insight.title.length).toBeGreaterThan(0);
    }
  });

  it("flags overexposure as negative when a pair holds ≥70% of P&L", () => {
    const pair = generateInsights(dataset, tKey).find((i) => i.id === "pair-concentration")!;
    expect(pair.severity).toBe("negative");
  });
});
