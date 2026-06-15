import { describe, it, expect } from "vitest";
import { estimatePnl } from "./pnl-calculator";

describe("estimatePnl", () => {
  it("computes a winning forex long (standard lot = 100k units)", () => {
    // +0.0010 on EURUSD, 1 lot → 0.0010 * 1 * 100000 = 100
    const pnl = estimatePnl({ entry: 1.1, exit: 1.101, lot: 1, direction: "long", pair: "EURUSD" });
    expect(pnl).toBe(100);
  });

  it("flips the sign for a short that the price moved against", () => {
    // price went up on a short → loss
    const pnl = estimatePnl({ entry: 1.1, exit: 1.101, lot: 1, direction: "short", pair: "EURUSD" });
    expect(pnl).toBe(-100);
  });

  it("treats buy/sell as aliases of long/short", () => {
    expect(estimatePnl({ entry: 1.1, exit: 1.101, lot: 1, direction: "buy", pair: "EURUSD" })).toBe(100);
    expect(estimatePnl({ entry: 1.1, exit: 1.101, lot: 1, direction: "sell", pair: "EURUSD" })).toBe(-100);
  });

  it("uses the metals multiplier (100) for XAUUSD", () => {
    // +2.00 on gold, 1 lot → 2 * 1 * 100 = 200
    const pnl = estimatePnl({ entry: 2000, exit: 2002, lot: 1, direction: "long", pair: "XAUUSD" });
    expect(pnl).toBe(200);
  });

  it("uses a 1:1 multiplier for indices/crypto", () => {
    // +50 on NAS100, 1 lot → 50
    expect(estimatePnl({ entry: 18000, exit: 18050, lot: 1, direction: "long", pair: "NAS100" })).toBe(50);
    expect(estimatePnl({ entry: 60000, exit: 60001, lot: 1, direction: "long", pair: "BTCUSD" })).toBe(1);
  });

  it("scales linearly with lot size and rounds to 2 decimals", () => {
    const pnl = estimatePnl({ entry: 1.1, exit: 1.1003, lot: 0.5, direction: "long", pair: "EURUSD" });
    // 0.0003 * 0.5 * 100000 = 15
    expect(pnl).toBe(15);
  });

  it("returns 0 for non-finite or non-positive inputs", () => {
    expect(estimatePnl({ entry: NaN, exit: 1.1, lot: 1, direction: "long", pair: "EURUSD" })).toBe(0);
    expect(estimatePnl({ entry: 1.1, exit: 1.1, lot: 0, direction: "long", pair: "EURUSD" })).toBe(0);
    expect(estimatePnl({ entry: 1.1, exit: 1.1, lot: -2, direction: "long", pair: "EURUSD" })).toBe(0);
  });

  it("is case- and whitespace-insensitive on the pair", () => {
    const pnl = estimatePnl({ entry: 2000, exit: 2002, lot: 1, direction: "long", pair: " xauusd " });
    expect(pnl).toBe(200);
  });
});
