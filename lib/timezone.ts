/**
 * Timezone-aware "day" helpers.
 *
 * Traders set a `timezone` in their profile, but several daily-boundary
 * computations used UTC (`new Date().toISOString().split("T")[0]`), so a trader
 * in CEST saw their daily-loss window, quota reset and reminders aligned to UTC
 * midnight rather than their own day. These helpers compute the boundaries in
 * the trader's zone instead, using the built-in Intl API (no dependency).
 *
 * Every function falls back to UTC if the timezone string is missing/invalid,
 * so a bad value can never throw in a cron or request path.
 */

const FALLBACK = "UTC";

/**
 * The browser's IANA timezone (client-only). Real-time guards use this — it
 * reflects where the trader physically is right now. Server paths (crons,
 * emails, daily-loss push) use the profile timezone instead. Falls back to UTC.
 */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function safeTz(tz?: string | null): string {
  if (!tz) return FALLBACK;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return FALLBACK;
  }
}

/** Wall-clock parts of `at` as seen in `tz`. */
function wallParts(tz: string, at: Date): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  return map;
}

/** "YYYY-MM-DD" for the calendar day `at` falls on in `tz`. */
export function localDateKey(tz?: string | null, at: Date = new Date()): string {
  const m = wallParts(safeTz(tz), at);
  return `${m.year}-${m.month}-${m.day}`;
}

/** Hour 0–23 of `at` in `tz`. */
export function localHour(tz?: string | null, at: Date = new Date()): number {
  const h = parseInt(wallParts(safeTz(tz), at).hour, 10);
  // Some engines emit "24" for midnight with hour12:false — normalise to 0.
  return h === 24 ? 0 : h;
}

/** Day of week in `tz`: 0=Sunday … 6=Saturday. */
export function localWeekday(tz?: string | null, at: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), weekday: "short" }).format(at);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/**
 * The UTC instant at which the current local day started in `tz`.
 * Use this as a lower bound for timestamptz queries ("trades since local midnight").
 */
export function startOfLocalDayUtc(tz?: string | null, at: Date = new Date()): Date {
  const z = safeTz(tz);
  const [y, mo, d] = localDateKey(z, at).split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  // How far ahead of UTC is the zone at that instant? Re-read the guess in tz.
  const m = wallParts(z, new Date(guess));
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  const offset = asUtc - guess;
  return new Date(guess - offset);
}

/** Shift a "YYYY-MM-DD" key by `delta` calendar days (DST-safe pure date math). */
export function addDaysToDateKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" of the Monday that starts the current week in `tz`. */
export function weekStartLocalKey(tz?: string | null, at: Date = new Date()): string {
  const z = safeTz(tz);
  const [y, mo, d] = localDateKey(z, at).split("-").map(Number);
  const wd = localWeekday(z, at); // 0=Sun
  const diff = wd === 0 ? -6 : 1 - wd; // days back to Monday
  // Pure calendar math on the local date (DST-safe — no clock arithmetic).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + diff);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
