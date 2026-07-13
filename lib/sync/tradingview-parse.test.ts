import { describe, expect, it } from "vitest";
import { normalizeTradingViewPayload, normalizeTradingViewTrade } from "./tradingview-parse";
import { isValidTrade } from "./push-parse";

// Payload type produit par le snippet Pine fourni (temps en ms Unix, nombres natifs).
const pineTrade = {
  symbol: "EURUSD",
  direction: "long",
  volume: 2,
  entry_price: 1.085,
  exit_price: 1.0895,
  open_time: 1751932800000,
  close_time: 1751961600000,
  profit: 90,
  commission: -1.4,
};

describe("normalizeTradingViewTrade", () => {
  it("accepte le payload du snippet Pine et satisfait le contrat du rail push", () => {
    const t = normalizeTradingViewTrade(pineTrade);
    expect(t).not.toBeNull();
    expect(isValidTrade(t)).toBe(true);
    expect(t!.source).toBe("tradingview");
    expect(t!.profit).toBe(90);
    expect(t!.commission).toBe(-1.4);
  });

  it("coerce les nombres envoyés en string (placeholders TradingView)", () => {
    const t = normalizeTradingViewTrade({
      ticker: "BTCUSD",
      side: "sell",
      qty: "0.5",
      entry: "65000",
      exit: "64200",
      profit: "400",
    });
    expect(t).not.toBeNull();
    expect(t!.symbol).toBe("BTCUSD");
    expect(t!.direction).toBe("short");
    expect(t!.volume).toBe(0.5);
    expect(t!.open_price).toBe(65000);
    expect(t!.close_price).toBe(64200);
    expect(t!.profit).toBe(400);
    expect(isValidTrade(t)).toBe(true);
  });

  it("calcule le P&L en termes de prix quand profit est absent (short gagnant)", () => {
    const t = normalizeTradingViewTrade({
      symbol: "AAPL",
      direction: "short",
      volume: 10,
      entry_price: 200,
      exit_price: 195,
    });
    expect(t!.profit).toBe(50); // (195-200)*10*(-1)
  });

  it("génère un ticket synthétique déterministe (dédoublonnage des retries)", () => {
    const a = normalizeTradingViewTrade(pineTrade ? { ...pineTrade } : {});
    const b = normalizeTradingViewTrade({ ...pineTrade });
    expect(a!.ticket).toBe(b!.ticket);
    expect(String(a!.ticket)).toMatch(/^tv-/);
    // Un trade différent → ticket différent
    const c = normalizeTradingViewTrade({ ...pineTrade, volume: 3 });
    expect(c!.ticket).not.toBe(a!.ticket);
  });

  it("respecte un ticket explicite s'il est fourni", () => {
    const t = normalizeTradingViewTrade({ ...pineTrade, ticket: "12345" });
    expect(t!.ticket).toBe("12345");
  });

  it("rejette les payloads incomplets ou invalides", () => {
    expect(normalizeTradingViewTrade(null)).toBeNull();
    expect(normalizeTradingViewTrade("texte")).toBeNull();
    expect(normalizeTradingViewTrade({})).toBeNull();
    // direction "flat" ({{strategy.market_position}} sans position) → rejet
    expect(normalizeTradingViewTrade({ ...pineTrade, direction: "flat" })).toBeNull();
    expect(normalizeTradingViewTrade({ ...pineTrade, volume: 0 })).toBeNull();
    expect(normalizeTradingViewTrade({ ...pineTrade, entry_price: "{{close}}" })).toBeNull();
  });

  it("défaut des horodatages : close_time = maintenant, open_time = close_time", () => {
    const before = Date.now();
    const t = normalizeTradingViewTrade({
      symbol: "EURUSD",
      direction: "long",
      volume: 1,
      entry_price: 1.1,
      exit_price: 1.11,
    });
    const closeMs = new Date(t!.close_time as string).getTime();
    expect(closeMs).toBeGreaterThanOrEqual(before);
    expect(t!.open_time).toBe(t!.close_time);
  });
});

describe("normalizeTradingViewPayload", () => {
  it("accepte la forme à plat, { trade } et { trades }", () => {
    expect(normalizeTradingViewPayload(pineTrade).trades).toHaveLength(1);
    expect(normalizeTradingViewPayload({ trade: pineTrade }).trades).toHaveLength(1);
    const multi = normalizeTradingViewPayload({ trades: [pineTrade, { ...pineTrade, volume: 1 }] });
    expect(multi.trades).toHaveLength(2);
  });

  it("priorise le token de l'URL sur celui du corps", () => {
    const r = normalizeTradingViewPayload({ ...pineTrade, token: "body-token" }, "url-token");
    expect(r.token).toBe("url-token");
    const r2 = normalizeTradingViewPayload({ ...pineTrade, token: "body-token" }, null);
    expect(r2.token).toBe("body-token");
    const r3 = normalizeTradingViewPayload(pineTrade, null);
    expect(r3.token).toBeNull();
  });

  it("compte les trades invalides sans jeter", () => {
    const r = normalizeTradingViewPayload({ trades: [pineTrade, { symbol: "X" }] });
    expect(r.trades).toHaveLength(1);
    expect(r.invalid).toBe(1);
  });
});
