import { describe, it, expect } from "vitest";
import { checkTradeGuard, type GuardStrategy } from "./trade-guard";

const strat: GuardStrategy = {
  pairs: ["XAUUSD", "EURUSD"],
  max_trades_per_day: 3,
  max_consecutive_losses: 2,
};

const loss = { netPnl: -50 };
const win = { netPnl: 80 };

describe("checkTradeGuard", () => {
  it("returns nothing without a strategy", () => {
    expect(checkTradeGuard(null, [loss, loss], { pair: "GBPUSD" })).toEqual([]);
  });

  it("passes a clean, in-rules trade", () => {
    expect(checkTradeGuard(strat, [win], { pair: "XAUUSD" })).toEqual([]);
  });

  it("flags a pair outside the strategy (case/space-insensitive)", () => {
    const w = checkTradeGuard(strat, [], { pair: " gbpusd " });
    expect(w).toHaveLength(1);
    expect(w[0]).toEqual({ type: "wrong_pair", values: { pair: "GBPUSD" } });
  });

  it("allows any pair when the strategy lists none", () => {
    const open: GuardStrategy = { ...strat, pairs: null };
    expect(checkTradeGuard(open, [], { pair: "GBPUSD" })).toEqual([]);
  });

  it("flags reaching the daily trade cap", () => {
    const w = checkTradeGuard(strat, [win, win, win], { pair: "XAUUSD" });
    expect(w.some((x) => x.type === "max_trades")).toBe(true);
    expect(w.find((x) => x.type === "max_trades")!.values).toEqual({ count: 3, max: 3 });
  });

  it("flags trading after the consecutive-loss limit (trailing run only)", () => {
    const w = checkTradeGuard(strat, [win, loss, loss], { pair: "XAUUSD" });
    expect(w.some((x) => x.type === "consecutive_losses")).toBe(true);
    expect(w.find((x) => x.type === "consecutive_losses")!.values).toEqual({ run: 2, max: 2 });
  });

  it("does not flag consecutive losses when the run was broken by a win", () => {
    const w = checkTradeGuard(strat, [loss, loss, win], { pair: "XAUUSD" });
    expect(w.some((x) => x.type === "consecutive_losses")).toBe(false);
  });

  it("can flag several rules at once", () => {
    const w = checkTradeGuard(strat, [loss, loss, loss], { pair: "GBPUSD" });
    const types = w.map((x) => x.type).sort();
    expect(types).toEqual(["consecutive_losses", "max_trades", "wrong_pair"]);
  });
});
