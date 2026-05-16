import { describe, it, expect } from "vitest";
import { calculatePips, detectAssetType, getPipValue, getTradeResult } from "./pips";

describe("detectAssetType", () => {
  it("detects XAUUSD variants", () => {
    expect(detectAssetType("XAUUSD")).toBe("xauusd");
    expect(detectAssetType("XAUUSD.m")).toBe("xauusd");
    expect(detectAssetType("XAUUSDm")).toBe("xauusd");
    expect(detectAssetType("XAUUSD#")).toBe("xauusd");
    expect(detectAssetType("GOLD")).toBe("xauusd");
  });

  it("detects XAGUSD", () => {
    expect(detectAssetType("XAGUSD")).toBe("xagusd");
    expect(detectAssetType("SILVER")).toBe("xagusd");
  });

  it("detects JPY pairs", () => {
    expect(detectAssetType("USDJPY")).toBe("forex_jpy");
    expect(detectAssetType("EURJPY")).toBe("forex_jpy");
  });

  it("detects forex majors", () => {
    expect(detectAssetType("EURUSD")).toBe("forex_major");
    expect(detectAssetType("GBPUSD")).toBe("forex_major");
    expect(detectAssetType("USDCAD")).toBe("forex_major");
  });

  it("detects indices", () => {
    expect(detectAssetType("US30")).toBe("index");
    expect(detectAssetType("NAS100")).toBe("index");
    expect(detectAssetType("GER40")).toBe("index");
  });

  it("detects crypto", () => {
    expect(detectAssetType("BTCUSD")).toBe("crypto");
    expect(detectAssetType("ETHUSD")).toBe("crypto");
  });

  it("detects oil", () => {
    expect(detectAssetType("XTIUSD")).toBe("oil");
    expect(detectAssetType("USOIL")).toBe("oil");
    expect(detectAssetType("BRENT")).toBe("oil");
  });
});

describe("calculatePips", () => {
  it("XAUUSD: entry=2050.0 sl=2049.6 → 4 pips (NOT 40)", () => {
    expect(calculatePips("XAUUSD", 2050.0, 2049.6)).toBe(4);
  });

  it("EURUSD: entry=1.0800 sl=1.0780 → 20 pips", () => {
    expect(calculatePips("EURUSD", 1.0800, 1.0780)).toBe(20);
  });

  it("USDJPY: entry=150.50 sl=150.30 → 20 pips", () => {
    expect(calculatePips("USDJPY", 150.50, 150.30)).toBe(20);
  });

  it("US30: entry=38000 sl=37980 → 20 pips", () => {
    expect(calculatePips("US30", 38000, 37980)).toBe(20);
  });

  it("XAGUSD: entry=28.50 sl=28.40 → 10 pips", () => {
    expect(calculatePips("XAGUSD", 28.50, 28.40)).toBe(10);
  });

  it("handles symbol suffixes", () => {
    expect(calculatePips("XAUUSD.m", 2050.0, 2049.6)).toBe(4);
    expect(calculatePips("EURUSD#", 1.0800, 1.0780)).toBe(20);
  });
});

describe("getTradeResult", () => {
  it("returns breakeven for near-zero P&L", () => {
    expect(getTradeResult(0.5)).toBe("breakeven");
    expect(getTradeResult(-1.2)).toBe("breakeven");
    expect(getTradeResult(1.99)).toBe("breakeven");
  });

  it("returns win for positive P&L above threshold", () => {
    expect(getTradeResult(15)).toBe("win");
    expect(getTradeResult(2.5)).toBe("win");
  });

  it("returns loss for negative P&L below threshold", () => {
    expect(getTradeResult(-10)).toBe("loss");
    expect(getTradeResult(-3)).toBe("loss");
  });

  it("uses account balance for dynamic threshold", () => {
    expect(getTradeResult(5, 10000)).toBe("breakeven"); // threshold = max(2, 10) = 10
    expect(getTradeResult(15, 10000)).toBe("win");
    expect(getTradeResult(-8, 10000)).toBe("breakeven");
    expect(getTradeResult(-12, 10000)).toBe("loss");
  });
});
