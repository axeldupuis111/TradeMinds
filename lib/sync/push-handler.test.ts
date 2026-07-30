import { describe, it, expect } from "vitest";
import { mapSource, mapDirection, toIso, isValidTrade, tradeRejectReason, readTicket, readAccountSnapshot, brokerOffsetSeconds } from "./push-parse";

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

describe("brokerOffsetSeconds", () => {
  // MetaTrader date ses trades en heure SERVEUR du broker. On déduit le décalage
  // en comparant le TimeCurrent() de l'EA à NOTRE horloge, sans jamais dépendre
  // de l'horloge ni du fuseau de la machine du trader.
  const nowMs = Date.parse("2026-07-31T10:00:00.000Z");
  const nowSec = nowMs / 1000;

  it("déduit un broker à GMT+3", () => {
    expect(brokerOffsetSeconds(nowSec + 3 * 3600, nowMs)).toBe(3 * 3600);
  });

  it("déduit un broker à GMT-5", () => {
    expect(brokerOffsetSeconds(nowSec - 5 * 3600, nowMs)).toBe(-5 * 3600);
  });

  it("absorbe la latence réseau en arrondissant à l'heure pleine", () => {
    // 2 h et 40 s d'écart : la latence ne doit pas inventer un décalage bâtard.
    expect(brokerOffsetSeconds(nowSec + 2 * 3600 + 40, nowMs)).toBe(2 * 3600);
    expect(brokerOffsetSeconds(nowSec + 2 * 3600 - 40, nowMs)).toBe(2 * 3600);
  });

  it("renvoie 0 pour un broker déjà à l'heure UTC", () => {
    expect(brokerOffsetSeconds(nowSec, nowMs)).toBe(0);
    expect(brokerOffsetSeconds(nowSec + 90, nowMs)).toBe(0);
  });

  it("ne corrige rien sans server_time : les anciens EA gardent leur comportement", () => {
    expect(brokerOffsetSeconds(undefined, nowMs)).toBe(0);
    expect(brokerOffsetSeconds(null, nowMs)).toBe(0);
    expect(brokerOffsetSeconds(0, nowMs)).toBe(0);
  });

  it("ne corrige rien sur une valeur aberrante plutôt que de décaler de travers", () => {
    expect(brokerOffsetSeconds("pas une heure", nowMs)).toBe(0);
    // Horloge de terminal complètement fausse (un an d'écart) : on s'abstient.
    expect(brokerOffsetSeconds(nowSec + 365 * 86_400, nowMs)).toBe(0);
    expect(brokerOffsetSeconds(nowSec - 365 * 86_400, nowMs)).toBe(0);
  });
});

describe("toIso avec décalage broker", () => {
  it("ramène un horodatage serveur GMT+3 à l'UTC réel", () => {
    // 23h30 heure serveur GMT+3 = 20h30 UTC : sans correction, ce trade était
    // daté du lendemain et faussait le P&L du jour.
    const serverEpoch = Date.parse("2026-07-31T23:30:00.000Z") / 1000;
    expect(toIso(serverEpoch, 3 * 3600)).toBe("2026-07-31T20:30:00.000Z");
  });

  it("laisse les horodatages inchangés quand le décalage est nul", () => {
    const epoch = 1_700_000_000;
    expect(toIso(epoch, 0)).toBe(toIso(epoch));
  });

  it("ne touche pas une chaîne ISO, qui porte déjà son fuseau", () => {
    expect(toIso("2026-06-15T10:00:00.000Z", 3 * 3600)).toBe("2026-06-15T10:00:00.000Z");
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

describe("readAccountSnapshot", () => {
  const base = {
    account: "51234567",
    balance: 10_432.5,
    equity: 10_510.25,
    open_positions: 2,
    currency: "eur",
  };

  it("accepte un état de compte complet", () => {
    expect(readAccountSnapshot(base)).toEqual({
      account: "51234567",
      balance: 10_432.5,
      equity: 10_510.25,
      open_positions: 2,
      currency: "EUR",
    });
  });

  it("accepte les nombres sérialisés en texte (clients MQL)", () => {
    const snap = readAccountSnapshot({ ...base, balance: "10432.50", open_positions: "2" });
    expect(snap?.balance).toBe(10_432.5);
    expect(snap?.open_positions).toBe(2);
  });

  it("retombe sur le solde quand l'equity manque", () => {
    const snap = readAccountSnapshot({ account: "1", balance: 500 });
    expect(snap?.equity).toBe(500);
    expect(snap?.open_positions).toBe(0);
    expect(snap?.currency).toBeNull();
  });

  it("accepte un solde négatif (compte grillé en levier)", () => {
    expect(readAccountSnapshot({ ...base, balance: -120, equity: -120 })?.balance).toBe(-120);
  });

  it("refuse un état sans n° de compte : écrire sur le mauvais compte est pire que rien", () => {
    expect(readAccountSnapshot({ ...base, account: "  " })).toBeNull();
    expect(readAccountSnapshot({ balance: 1000, equity: 1000 })).toBeNull();
  });

  it("refuse un solde illisible ou une lecture de compte ratée (0/0)", () => {
    expect(readAccountSnapshot({ ...base, balance: "abc" })).toBeNull();
    expect(readAccountSnapshot({ ...base, balance: undefined })).toBeNull();
    expect(readAccountSnapshot({ account: "1", balance: 0, equity: 0 })).toBeNull();
  });

  it("refuse les non-objets sans jeter", () => {
    expect(readAccountSnapshot(undefined)).toBeNull();
    expect(readAccountSnapshot("10432")).toBeNull();
  });

  it("normalise un nombre de positions aberrant plutôt que de le propager", () => {
    expect(readAccountSnapshot({ ...base, open_positions: -3 })?.open_positions).toBe(0);
    expect(readAccountSnapshot({ ...base, open_positions: 2.7 })?.open_positions).toBe(3);
  });
});
