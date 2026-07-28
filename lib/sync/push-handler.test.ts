import { describe, it, expect } from "vitest";
import { mapSource, mapDirection, toIso, isValidTrade, tradeRejectReason, readTicket } from "./push-parse";

describe("mapSource", () => {
  it("accepts every known platform (case/space-insensitive)", () => {
    expect(mapSource("mt4")).toBe("mt4");
    expect(mapSource("MT5")).toBe("mt5");
    expect(mapSource(" cTrader ")).toBe("ctrader");
    expect(mapSource("NinjaTrader")).toBe("ninjatrader");
  });
  it("defaults to mt5 for missing/unknown values (legacy EAs send none)", () => {
    expect(mapSource(undefined)).toBe("mt5");
    expect(mapSource("")).toBe("mt5");
    expect(mapSource("binance")).toBe("mt5");
    expect(mapSource(42)).toBe("mt5");
  });
});

describe("mapDirection", () => {
  it("maps buy/long → long and sell/short → short", () => {
    expect(mapDirection("buy")).toBe("long");
    expect(mapDirection("LONG")).toBe("long");
    expect(mapDirection("sell")).toBe("short");
    expect(mapDirection(" Short ")).toBe("short");
  });
  it("returns null for anything else", () => {
    expect(mapDirection("hold")).toBeNull();
    expect(mapDirection("")).toBeNull();
  });
});

describe("toIso", () => {
  it("passes through ISO strings", () => {
    expect(toIso("2026-06-15T10:00:00.000Z")).toBe("2026-06-15T10:00:00.000Z");
  });
  it("treats large numbers as Unix seconds (MT/cTrader) ", () => {
    const secs = 1_700_000_000;
    expect(toIso(secs)).toBe(new Date(secs * 1000).toISOString());
    expect(toIso(String(secs))).toBe(new Date(secs * 1000).toISOString());
  });
  it("treats epoch-ms-magnitude numbers as milliseconds", () => {
    const ms = 1_700_000_000_000;
    expect(toIso(ms)).toBe(new Date(ms).toISOString());
  });
  it("returns null for empty / invalid", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso("")).toBeNull();
    expect(toIso("not-a-date")).toBeNull();
  });
});

describe("isValidTrade", () => {
  const base = {
    ticket: 12345,
    symbol: "EURUSD",
    direction: "buy",
    volume: 1,
    open_price: 1.1,
    close_price: 1.2,
    open_time: 1_700_000_000,
    close_time: 1_700_000_500,
    profit: 100,
  };

  it("accepts a well-formed trade (numeric ticket — cTrader/MT)", () => {
    expect(isValidTrade(base)).toBe(true);
  });
  it("accepts a string ticket (NinjaTrader ExecutionId)", () => {
    expect(isValidTrade({ ...base, ticket: "EXEC-abc-123" })).toBe(true);
  });
  it("rejects empty string ticket", () => {
    expect(isValidTrade({ ...base, ticket: "" })).toBe(false);
  });
  it("rejects missing/blank symbol", () => {
    expect(isValidTrade({ ...base, symbol: "  " })).toBe(false);
  });
  it("rejects an unmappable direction", () => {
    expect(isValidTrade({ ...base, direction: "neither" })).toBe(false);
  });
  it("rejects non-positive volume / prices", () => {
    expect(isValidTrade({ ...base, volume: 0 })).toBe(false);
    expect(isValidTrade({ ...base, open_price: 0 })).toBe(false);
    expect(isValidTrade({ ...base, close_price: -1 })).toBe(false);
  });
  it("rejects invalid times and non-objects", () => {
    expect(isValidTrade({ ...base, open_time: "nope" })).toBe(false);
    expect(isValidTrade(null)).toBe(false);
    expect(isValidTrade("x")).toBe(false);
  });

  // Un trade refusé doit dire pourquoi : sans motif, l'EA voyait un 200 et
  // le trade disparaissait sans laisser de trace (cas MT5 open_price = 0).
  it("explique le refus au lieu de l'avaler en silence", () => {
    expect(tradeRejectReason(base)).toBeNull();
    expect(tradeRejectReason({ ...base, open_price: 0 })).toContain("ouverture");
    expect(tradeRejectReason({ ...base, open_time: 0 })).toContain("ouverture");
    expect(tradeRejectReason({ ...base, ticket: "" })).toContain("ticket");
    expect(tradeRejectReason({ ...base, volume: 0 })).toContain("volume");
  });

  it("lit le ticket même sur un payload non conforme (messages d'erreur)", () => {
    expect(readTicket({ ...base, open_price: 0 })).toBe("12345");
    expect(readTicket(null)).toBe("?");
  });
});
