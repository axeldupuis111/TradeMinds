import { describe, expect, it } from "vitest";
import { computeCapitalLeaks } from "./analytics/leaks";
import { generateDemoTrades } from "./demo-data";

const NOW = new Date("2026-07-03T12:00:00Z");

describe("generateDemoTrades", () => {
  it("génère un volume raisonnable de trades démo, tous clos et marqués", () => {
    const rows = generateDemoTrades(NOW);
    expect(rows.length).toBeGreaterThanOrEqual(40);
    expect(rows.length).toBeLessThanOrEqual(70);
    for (const r of rows) {
      expect(r.is_demo).toBe(true);
      expect(r.status).toBe("closed");
      expect(Number.isFinite(r.pnl)).toBe(true);
      expect(Number.isFinite(r.entry_price)).toBe(true);
      expect(new Date(r.close_time).getTime()).toBeGreaterThan(new Date(r.open_time).getTime());
    }
  });

  it("est déterministe (même seed → même démo)", () => {
    expect(generateDemoTrades(NOW)).toEqual(generateDemoTrades(NOW));
  });

  it("reste dans le passé récent (≤ 45 jours, jamais dans le futur)", () => {
    const rows = generateDemoTrades(NOW);
    const min = NOW.getTime() - 45 * 86400000;
    for (const r of rows) {
      const t = new Date(r.open_time).getTime();
      expect(t).toBeGreaterThan(min);
      expect(t).toBeLessThan(NOW.getTime());
    }
  });

  it("ne trade jamais le week-end", () => {
    for (const r of generateDemoTrades(NOW)) {
      const day = new Date(r.open_time).getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("raconte une histoire de discipline imparfaite : CapitalLeaks a du grain à moudre", () => {
    const rows = generateDemoTrades(NOW);
    const res = computeCapitalLeaks(rows, { maxTradesPerDay: null });
    expect(res.totalRecoverable).toBeGreaterThan(100);
    const types = res.leaks.map((l) => l.type);
    expect(types).toContain("revenge");
    expect(types).toContain("emotional");
    expect(res.leaks.length).toBeGreaterThanOrEqual(3);
  });

  it("reste globalement crédible : winrate entre 40 et 70 %", () => {
    const rows = generateDemoTrades(NOW);
    const wins = rows.filter((r) => r.pnl > 0).length;
    const wr = wins / rows.length;
    expect(wr).toBeGreaterThan(0.4);
    expect(wr).toBeLessThan(0.7);
  });
});
