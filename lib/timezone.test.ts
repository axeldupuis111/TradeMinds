import { describe, it, expect } from "vitest";
import {
  localDateKey,
  localHour,
  localWeekday,
  startOfLocalDayUtc,
  weekStartLocalKey,
  addDaysToDateKey,
} from "./timezone";

describe("timezone helpers", () => {
  // 2026-06-30T23:30:00Z → in Paris (UTC+2 summer) it's already 2026-07-01 01:30.
  const lateUtc = new Date("2026-06-30T23:30:00Z");

  it("localDateKey rolls to the next day in a positive-offset zone", () => {
    expect(localDateKey("UTC", lateUtc)).toBe("2026-06-30");
    expect(localDateKey("Europe/Paris", lateUtc)).toBe("2026-07-01");
  });

  it("localDateKey rolls to the previous day in a negative-offset zone", () => {
    // 2026-06-30T02:00Z → New York (UTC-4 summer) is still 2026-06-29 22:00.
    const earlyUtc = new Date("2026-06-30T02:00:00Z");
    expect(localDateKey("America/New_York", earlyUtc)).toBe("2026-06-29");
  });

  it("localHour reflects the zone offset", () => {
    expect(localHour("UTC", lateUtc)).toBe(23);
    expect(localHour("Europe/Paris", lateUtc)).toBe(1); // 01:30 next day
  });

  it("localWeekday accounts for the day rollover", () => {
    // 2026-06-30 is a Tuesday (2). In Paris it's already Wednesday (3).
    expect(localWeekday("UTC", lateUtc)).toBe(2);
    expect(localWeekday("Europe/Paris", lateUtc)).toBe(3);
  });

  it("startOfLocalDayUtc returns the UTC instant of local midnight", () => {
    // Local day in Paris is 2026-07-01; its midnight is 2026-06-30T22:00Z.
    expect(startOfLocalDayUtc("Europe/Paris", lateUtc).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    // UTC: midnight of 2026-06-30 is itself.
    expect(startOfLocalDayUtc("UTC", lateUtc).toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });

  it("weekStartLocalKey returns the local Monday", () => {
    // 2026-06-30 is Tuesday → week Monday is 2026-06-29 (UTC).
    expect(weekStartLocalKey("UTC", lateUtc)).toBe("2026-06-29");
    // In Paris it's Wednesday 2026-07-01 → same week Monday 2026-06-29.
    expect(weekStartLocalKey("Europe/Paris", lateUtc)).toBe("2026-06-29");
  });

  it("handles Sunday as the end of the week, not the start", () => {
    // 2026-07-05 is a Sunday. Week Monday is 2026-06-29.
    const sunday = new Date("2026-07-05T12:00:00Z");
    expect(weekStartLocalKey("UTC", sunday)).toBe("2026-06-29");
  });

  it("addDaysToDateKey shifts calendar days across month/year boundaries", () => {
    expect(addDaysToDateKey("2026-06-30", -1)).toBe("2026-06-29");
    expect(addDaysToDateKey("2026-07-01", -1)).toBe("2026-06-30"); // month boundary
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31"); // year boundary
    expect(addDaysToDateKey("2026-02-28", 1)).toBe("2026-03-01"); // non-leap year
  });

  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    expect(localDateKey("Not/AZone", lateUtc)).toBe(localDateKey("UTC", lateUtc));
    expect(localHour(null, lateUtc)).toBe(23);
    expect(localHour(undefined, lateUtc)).toBe(23);
  });
});
