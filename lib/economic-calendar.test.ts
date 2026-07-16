import { describe, it, expect } from "vitest";
import {
  currenciesForPair,
  currenciesForPairs,
  filterRelevantEvents,
  activeNewsWindow,
  findStaleEvents,
  parseFeed,
  type EconomicEvent,
  type ExistingEventRow,
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

describe("findStaleEvents", () => {
  // All the sample events sit in the past relative to NOW unless a test
  // says otherwise, so the same-UTC-day rule is the one under test.
  const NOW = new Date("2026-07-20T00:00:00Z");
  const feedEvent = (over: Partial<EconomicEvent>): EconomicEvent => ({
    event_time: "2026-07-15T14:45:00.000Z",
    currency: "CAD",
    title: "BOC Press Conference",
    impact: "high",
    ...over,
  });
  const row = (over: Partial<ExistingEventRow>): ExistingEventRow => ({
    id: "row-1",
    event_time: "2026-07-15T14:30:00+00:00",
    currency: "CAD",
    title: "BOC Press Conference",
    ...over,
  });

  it("flags the old time when the feed re-schedules a same-day event", () => {
    const stale = findStaleEvents([row({})], [feedEvent({})], NOW);
    expect(stale.map((s) => s.id)).toEqual(["row-1"]);
  });

  it("treats Postgres '+00:00' and JS 'Z' timestamps as the same instant", () => {
    const stale = findStaleEvents(
      [row({ event_time: "2026-07-15T14:45:00+00:00" })],
      [feedEvent({})],
      NOW,
    );
    expect(stale).toEqual([]);
  });

  it("keeps every occurrence of an announcement the feed still lists twice", () => {
    const existing = [
      row({ id: "a", event_time: "2026-07-15T07:01:00Z", title: "New Loans", currency: "CNY" }),
      row({ id: "b", event_time: "2026-07-15T09:33:00Z", title: "New Loans", currency: "CNY" }),
    ];
    const feed = [
      feedEvent({ event_time: "2026-07-15T07:01:00.000Z", title: "New Loans", currency: "CNY" }),
      feedEvent({ event_time: "2026-07-15T09:33:00.000Z", title: "New Loans", currency: "CNY" }),
    ];
    expect(findStaleEvents(existing, feed, NOW)).toEqual([]);
  });

  it("drops only the occurrence the feed no longer lists", () => {
    const existing = [
      row({ id: "a", event_time: "2026-07-15T07:01:00Z", title: "New Loans", currency: "CNY" }),
      row({ id: "b", event_time: "2026-07-15T09:33:00Z", title: "New Loans", currency: "CNY" }),
    ];
    const feed = [
      feedEvent({ event_time: "2026-07-15T09:33:00.000Z", title: "New Loans", currency: "CNY" }),
    ];
    expect(findStaleEvents(existing, feed, NOW).map((s) => s.id)).toEqual(["a"]);
  });

  it("never touches past rows whose (day, currency, title) is absent from the feed", () => {
    const pastRow = row({ event_time: "2026-07-01T14:30:00Z" }); // released history
    const otherTitle = row({ id: "x", title: "BOC Rate Statement" });
    expect(findStaleEvents([pastRow, otherTitle], [feedEvent({})], NOW)).toEqual([]);
  });

  it("does not confuse the same title on different (past) days or currencies", () => {
    const existing = [
      row({ id: "day", event_time: "2026-07-16T14:30:00Z" }),
      row({ id: "ccy", currency: "USD" }),
    ];
    expect(findStaleEvents(existing, [feedEvent({})], NOW)).toEqual([]);
  });

  it("flags a future row the feed moved to another day", () => {
    const now = new Date("2026-07-13T00:00:00Z");
    const existing = [
      row({ id: "old-day", event_time: "2026-07-14T09:33:00Z", title: "New Loans", currency: "CNY" }),
    ];
    const feed = [
      feedEvent({ event_time: "2026-07-15T07:01:00.000Z", title: "New Loans", currency: "CNY" }),
    ];
    expect(findStaleEvents(existing, feed, now).map((s) => s.id)).toEqual(["old-day"]);
  });

  it("flags a future row the feed dropped entirely, but keeps one it still lists", () => {
    const now = new Date("2026-07-13T00:00:00Z");
    const existing = [
      row({ id: "gone", event_time: "2026-07-14T20:00:00Z", title: "Treasury Currency Report", currency: "USD" }),
      row({ id: "kept", event_time: "2026-07-14T14:45:00Z" }),
    ];
    const feed = [feedEvent({ event_time: "2026-07-14T14:45:00.000Z" })];
    expect(findStaleEvents(existing, feed, now).map((s) => s.id)).toEqual(["gone"]);
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
