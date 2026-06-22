import { describe, it, expect } from "vitest";
import {
  currenciesForPair,
  currenciesForPairs,
  filterRelevantEvents,
  activeNewsWindow,
  parseFeed,
  type EconomicEvent,
  type RawFeedRow,
} from "./economic-calendar";

describe("currenciesForPair", () => {
  it("extracts both legs of a fiat pair", () => {
    expect(currenciesForPair("USDJPY").sort()).toEqual(["JPY", "USD"]);
    expect(currenciesForPair("EURUSD").sort()).toEqual(["EUR", "USD"]);
  });

  it("maps gold to USD", () => {
    expect(currenciesForPair("XAUUSD")).toContain("USD");
  });

  it("maps index symbols via hints", () => {
    expect(currenciesForPair("GER40")).toContain("EUR");
    expect(currenciesForPair("US30")).toContain("USD");
  });

  it("returns empty for unrecognised symbols", () => {
    expect(currenciesForPair("XYZ123")).toEqual([]);
  });

  it("unions across several pairs without duplicates", () => {
    expect(currenciesForPairs(["EURUSD", "USDJPY", "XAUUSD"]).sort()).toEqual(["EUR", "JPY", "USD"]);
  });
});

describe("filterRelevantEvents", () => {
  const events: EconomicEvent[] = [
    { event_time: "2026-06-22T12:30:00Z", currency: "USD", title: "CPI", impact: "high" },
    { event_time: "2026-06-22T09:00:00Z", currency: "EUR", title: "ECB speak", impact: "low" },
    { event_time: "2026-06-22T14:00:00Z", currency: "GBP", title: "BoE", impact: "medium" },
  ];

  it("keeps only wanted currencies clearing the impact bar, sorted by time", () => {
    const out = filterRelevantEvents(events, ["USD", "GBP"], "high");
    expect(out.map((e) => e.title)).toEqual(["CPI"]);
  });

  it("a lower bar lets medium events through", () => {
    const out = filterRelevantEvents(events, ["USD", "GBP"], "medium");
    expect(out.map((e) => e.title)).toEqual(["CPI", "BoE"]);
  });

  it("ignores currencies the trader isn't exposed to", () => {
    expect(filterRelevantEvents(events, ["JPY"], "low")).toEqual([]);
  });
});

describe("activeNewsWindow", () => {
  const events: EconomicEvent[] = [
    { event_time: "2026-06-22T12:30:00Z", currency: "USD", title: "CPI", impact: "high" },
  ];

  it("matches inside the ±window and returns null outside", () => {
    expect(activeNewsWindow(events, new Date("2026-06-22T12:40:00Z"))?.title).toBe("CPI");
    expect(activeNewsWindow(events, new Date("2026-06-22T13:30:00Z"))).toBeNull();
  });
});

describe("parseFeed", () => {
  it("normalises faireconomy rows and drops invalid ones", () => {
    const rows: RawFeedRow[] = [
      { title: "Non-Farm Payrolls", country: "USD", date: "2026-06-22T08:30:00-04:00", impact: "High", forecast: "180K" },
      { title: "Bank Holiday", country: "GBP", date: "2026-06-22T00:00:00+01:00", impact: "Holiday" },
      { title: "Missing date", country: "EUR", impact: "Medium" }, // dropped: no date
      { title: "Bad impact", country: "USD", date: "2026-06-22T10:00:00Z", impact: "Unknown" }, // dropped
    ];
    const out = parseFeed(rows);
    expect(out.map((e) => e.title)).toEqual(["Non-Farm Payrolls", "Bank Holiday"]);
    expect(out[0].impact).toBe("high");
    expect(out[0].currency).toBe("USD");
    expect(out[0].event_time).toBe("2026-06-22T12:30:00.000Z"); // -04:00 → UTC
    expect(out[0].forecast).toBe("180K");
  });
});
