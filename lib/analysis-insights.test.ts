import { describe, it, expect } from "vitest";
import {
  computeTradeStats,
  computeViolationCosts,
  computeCounterfactual,
  computeEdgeHighlights,
  renderStatsBlock,
  netPnl,
  winRate,
  type InsightTrade,
} from "./analysis-insights";

function trade(over: Partial<InsightTrade>): InsightTrade {
  return {
    open_time: "2026-07-06T08:00:00Z",
    close_time: "2026-07-06T09:00:00Z",
    pair: "EURUSD",
    direction: "buy",
    lot_size: 0.5,
    pnl: 100,
    commission: -5,
    swap: 0,
    ...over,
  };
}

describe("netPnl", () => {
  it("inclut commission et swap, tolère les null", () => {
    expect(netPnl(trade({ pnl: 100, commission: -5, swap: -2 }))).toBe(93);
    expect(netPnl(trade({ pnl: 50, commission: null, swap: null }))).toBe(50);
  });
});

describe("computeTradeStats", () => {
  const trades: InsightTrade[] = [
    trade({ open_time: "2026-07-06T08:10:00Z", close_time: "2026-07-06T09:00:00Z", pnl: 105, commission: -5 }), // +100, lundi 10h Paris
    trade({ open_time: "2026-07-06T14:10:00Z", close_time: "2026-07-06T14:40:00Z", pnl: -45, commission: -5, pair: "XAUUSD", emotion: "FOMO " }), // -50
    trade({ open_time: "2026-07-06T14:50:00Z", close_time: "2026-07-06T15:20:00Z", pnl: -75, commission: -5, pair: "XAUUSD", lot_size: 1.0, emotion: "fomo" }), // -80, revenge < 30min
    trade({ open_time: "2026-07-07T08:05:00Z", close_time: "2026-07-07T09:00:00Z", pnl: 55, commission: -5, direction: "SELL", ict_setup: "OB + FVG" }), // +50
    trade({ open_time: "2026-07-07T10:00:00Z", close_time: "2026-07-07T10:30:00Z", pnl: 5, commission: -5 }), // 0 (breakeven)
  ];
  const stats = computeTradeStats(trades, "Europe/Paris");

  it("agrège le global correctement", () => {
    expect(stats.total.trades).toBe(5);
    expect(stats.total.wins).toBe(2);
    expect(stats.total.losses).toBe(2);
    expect(stats.total.breakevens).toBe(1);
    expect(stats.total.netPnl).toBe(20);
    expect(stats.total.winRate).toBe(50); // 2 wins / 4 décidés
    expect(stats.total.profitFactor).toBeCloseTo(150 / 130, 2);
    expect(stats.total.bestTrade).toBe(100);
    expect(stats.total.worstTrade).toBe(-80);
  });

  it("bucketise par heure locale du fuseau (08:10 UTC = 10h à Paris en été)", () => {
    expect(stats.byHour["10"].trades).toBe(2);
    expect(stats.byHour["16"].trades).toBe(2); // 14:10 et 14:50 UTC
  });

  it("bucketise par jour ISO (lundi = 1)", () => {
    expect(stats.byWeekday["1"].trades).toBe(3);
    expect(stats.byWeekday["2"].trades).toBe(2);
  });

  it("normalise paires, sens et émotions", () => {
    expect(stats.byPair["XAUUSD"].netPnl).toBe(-130);
    expect(stats.byDirection["sell"].trades).toBe(1);
    expect(stats.byEmotion["fomo"].trades).toBe(2);
    expect(stats.bySetup["OB + FVG"].trades).toBe(1);
  });

  it("détecte la fenêtre revenge et l'escalade de lot après perte", () => {
    expect(stats.afterLoss.within30min.trades).toBe(1);
    expect(stats.afterLoss.within30min.netPnl).toBe(-80);
    expect(stats.afterLoss.avgLotAfterLoss).toBeCloseTo(0.75); // 1.0 puis 0.5
    expect(stats.maxConsecutiveLosses).toBe(2);
  });

  it("retombe sur l'heure UTC si le fuseau est invalide", () => {
    const s = computeTradeStats(trades, "Pas/Un_Fuseau");
    expect(s.byHour["8"].trades).toBe(2);
  });
});

describe("renderStatsBlock", () => {
  it("produit un bloc lisible avec le global et masque les segments trop petits", () => {
    const trades = Array.from({ length: 4 }, (_, i) =>
      trade({ open_time: `2026-07-0${i + 1}T08:00:00Z`, close_time: `2026-07-0${i + 1}T09:00:00Z` }),
    );
    const block = renderStatsBlock(computeTradeStats(trades, "UTC"), "UTC");
    expect(block).toContain("GLOBAL : 4 trades");
    expect(block).toContain("PAR HEURE");
    // 1 seule paire mais 4 trades → présente ; les émotions absentes → pas de section
    expect(block).toContain("EURUSD");
    expect(block).not.toContain("ÉMOTION");
  });
});

describe("computeViolationCosts", () => {
  const trades = [
    trade({ pnl: -100, commission: 0 }),
    trade({ pnl: 50, commission: 0 }),
    trade({ pnl: -30, commission: 0 }),
  ];

  it("chiffre chaque violation et le total sans double-compter les trades partagés", () => {
    const res = computeViolationCosts(
      [{ trade_ids: [0, 2] }, { trade_ids: [0, 1] }],
      trades,
    );
    expect(res.perViolation).toEqual([-130, -50]);
    expect(res.violationIndices).toEqual([0, 1, 2]);
    expect(res.totalCost).toBe(-80); // union, trade 0 compté une fois
  });

  it("ignore les index hallucinés hors bornes", () => {
    const res = computeViolationCosts([{ trade_ids: [99, -1, 2] }], trades);
    expect(res.perViolation).toEqual([-30]);
    expect(res.violationIndices).toEqual([2]);
  });

  it("renvoie null pour une violation sans trade exploitable", () => {
    const res = computeViolationCosts([{ trade_ids: [] }], trades);
    expect(res.perViolation).toEqual([null]);
    expect(res.totalCost).toBe(0);
  });
});

describe("computeCounterfactual", () => {
  const trades = [
    trade({ close_time: "2026-07-01T10:00:00Z", pnl: 100, commission: 0 }),
    trade({ close_time: "2026-07-02T10:00:00Z", pnl: -60, commission: 0 }),
    trade({ close_time: "2026-07-03T10:00:00Z", pnl: 40, commission: 0 }),
  ];

  it("retire les trades en violation de la courbe propre", () => {
    const cf = computeCounterfactual(trades, [1])!;
    expect(cf.realFinal).toBe(80);
    expect(cf.cleanFinal).toBe(140);
    expect(cf.gain).toBe(60);
    // point de départ à 0 + un point par trade
    expect(cf.points[0]).toEqual({ t: "2026-07-01T10:00:00Z", real: 0, clean: 0 });
    expect(cf.points.at(-1)).toEqual({ t: "2026-07-03T10:00:00Z", real: 80, clean: 140 });
  });

  it("renvoie null sans violation (rien à contrefactualiser)", () => {
    expect(computeCounterfactual(trades, [])).toBeNull();
  });

  it("rééchantillonne les longues séries en gardant premier et dernier points", () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      trade({ close_time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), pnl: 1, commission: 0 }),
    );
    const cf = computeCounterfactual(many, [0], 120)!;
    expect(cf.points.length).toBe(120);
    expect(cf.points[0].real).toBe(0);
    expect(cf.points.at(-1)!.real).toBe(500);
    expect(cf.points.at(-1)!.clean).toBe(499);
  });
});

describe("computeEdgeHighlights", () => {
  it("ressort le meilleur et le pire segment avec échantillon suffisant", () => {
    const trades = [
      ...Array.from({ length: 6 }, () => trade({ pair: "EURUSD", pnl: 55, commission: -5 })),
      ...Array.from({ length: 6 }, () => trade({ pair: "XAUUSD", pnl: -45, commission: -5 })),
    ];
    const highlights = computeEdgeHighlights(computeTradeStats(trades, "UTC"), 5);
    const best = highlights.find((h) => h.kind === "best")!;
    const worst = highlights.find((h) => h.kind === "worst")!;
    expect(best.netPnl).toBeGreaterThan(0);
    expect(worst.dimension === "pair" ? worst.key : "").toBe("XAUUSD");
  });

  it("n'invente pas d'edge sur un petit échantillon", () => {
    const trades = [trade({}), trade({ pnl: -50 })];
    expect(computeEdgeHighlights(computeTradeStats(trades, "UTC"), 5)).toEqual([]);
  });
});

describe("winRate", () => {
  it("ignore les breakevens dans le dénominateur", () => {
    expect(winRate({ trades: 3, wins: 1, losses: 1, netPnl: 0 })).toBe(50);
    expect(winRate({ trades: 0, wins: 0, losses: 0, netPnl: 0 })).toBe(0);
  });
});
