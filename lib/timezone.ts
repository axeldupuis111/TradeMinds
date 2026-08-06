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
 * L'ancienne page Paramètres stockait des libellés « UTC+1 » / « UTC-5 » dans
 * profiles.timezone. Ce ne sont PAS des identifiants IANA : Intl les rejette,
 * donc safeTz retombait sur UTC et tous les gates « heure locale » (rappel
 * quotidien, rapport hebdo, réactivation, streak-guard, quotas IA) s'évaluaient
 * en heure UTC. On traduit ces valeurs héritées vers la zone IANA de la ville
 * qui était affichée dans l'ancien menu (donc avec le bon régime d'heure d'été).
 */
const LEGACY_TZ: Record<string, string> = {
  "UTC+1": "Europe/Paris",
  "UTC+2": "Europe/Helsinki",
  "UTC+3": "Europe/Moscow",
  "UTC+4": "Asia/Dubai",
  "UTC+5:30": "Asia/Kolkata",
  "UTC+8": "Asia/Singapore",
  "UTC+9": "Asia/Tokyo",
  "UTC-5": "America/New_York",
  "UTC-6": "America/Chicago",
  "UTC-7": "America/Denver",
  "UTC-8": "America/Los_Angeles",
};

/**
 * Resolve a stored profile timezone to a valid IANA identifier: translates
 * legacy "UTC±N" labels, validates against Intl, falls back to UTC.
 */
export function normalizeTimezone(tz?: string | null): string {
  if (!tz) return FALLBACK;
  const candidate = LEGACY_TZ[tz] ?? tz;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return FALLBACK;
  }
}

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
  return normalizeTimezone(tz);
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

/**
 * The UTC instant at which the local day `key` ("YYYY-MM-DD") starts in `tz`.
 *
 * Sert à traduire une date parlée (« hier ») en borne de requête sur une
 * colonne timestamptz : sans ça, `gte("open_time", "2026-08-05")` compare à
 * minuit UTC, donc pour un trader à Paris les deux premières heures de sa
 * journée tombent du mauvais côté de la borne.
 *
 * On ancre à midi UTC pour être insensible aux décalages et aux changements
 * d'heure, puis on redescend au début du jour local correspondant.
 */
export function startOfDateKeyUtc(key: string, tz?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!m) return null;
  const noonUtc = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  if (Number.isNaN(noonUtc.getTime())) return null;
  return startOfLocalDayUtc(tz, noonUtc);
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
