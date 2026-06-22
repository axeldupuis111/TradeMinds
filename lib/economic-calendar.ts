/**
 * economic-calendar.ts
 * Pure helpers for the news guardrail: mapping traded symbols to the
 * currencies they're exposed to, parsing the public calendar feed, and
 * deciding whether a given instant sits inside an announcement's
 * "danger window". No I/O here — all fetching/DB lives in the cron route
 * and the components, so this stays unit-testable.
 */

export type Impact = "high" | "medium" | "low" | "holiday";

export interface EconomicEvent {
  /** UTC ISO instant of the announcement. */
  event_time: string;
  currency: string;
  title: string;
  impact: Impact;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
}

/** Major fiat codes we recognise inside a symbol like "EURUSD" or "USDJPY". */
const FIAT_CODES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNH", "CNY"];

/**
 * Light heuristics for index / commodity / crypto symbols that don't carry
 * an explicit currency pair. Matched as a substring (case-insensitive).
 */
const SYMBOL_HINTS: { needle: string; currency: string }[] = [
  { needle: "XAU", currency: "USD" }, // gold priced in USD
  { needle: "XAG", currency: "USD" }, // silver
  { needle: "WTI", currency: "USD" },
  { needle: "OIL", currency: "USD" },
  { needle: "US30", currency: "USD" },
  { needle: "US100", currency: "USD" },
  { needle: "NAS", currency: "USD" },
  { needle: "SPX", currency: "USD" },
  { needle: "US500", currency: "USD" },
  { needle: "BTC", currency: "USD" },
  { needle: "ETH", currency: "USD" },
  { needle: "GER", currency: "EUR" }, // DAX
  { needle: "DAX", currency: "EUR" },
  { needle: "EU50", currency: "EUR" },
  { needle: "UK100", currency: "GBP" },
  { needle: "FTSE", currency: "GBP" },
  { needle: "JP225", currency: "JPY" },
  { needle: "NIK", currency: "JPY" },
  { needle: "AUS200", currency: "AUD" },
];

/** Currencies a single symbol is exposed to. Empty array if none recognised. */
export function currenciesForPair(pair: string): string[] {
  if (!pair) return [];
  const up = pair.toUpperCase();
  const found = new Set<string>();

  for (const code of FIAT_CODES) {
    if (up.includes(code)) found.add(code);
  }
  for (const hint of SYMBOL_HINTS) {
    if (up.includes(hint.needle)) found.add(hint.currency);
  }
  return Array.from(found);
}

/** Union of currencies across all the trader's symbols. */
export function currenciesForPairs(pairs: string[]): string[] {
  const set = new Set<string>();
  for (const p of pairs) for (const c of currenciesForPair(p)) set.add(c);
  return Array.from(set);
}

/** Keep only events that concern the trader's currencies and clear the impact bar. */
export function filterRelevantEvents(
  events: EconomicEvent[],
  currencies: string[],
  minImpact: Impact = "high",
): EconomicEvent[] {
  const wanted = new Set(currencies.map((c) => c.toUpperCase()));
  const rank: Record<Impact, number> = { holiday: 0, low: 1, medium: 2, high: 3 };
  const bar = rank[minImpact];
  return events
    .filter((e) => wanted.has(e.currency.toUpperCase()) && rank[e.impact] >= bar)
    .sort((a, b) => a.event_time.localeCompare(b.event_time));
}

/** Default half-width of the "don't trade" window around a high-impact print, in minutes. */
export const NEWS_WINDOW_MINUTES = 15;

/**
 * The single most relevant event whose danger window contains `now`, if any.
 * Used by the live guard to surface "you're inside a news window" exactly once.
 */
export function activeNewsWindow(
  events: EconomicEvent[],
  now: Date = new Date(),
  windowMinutes: number = NEWS_WINDOW_MINUTES,
): EconomicEvent | null {
  const ms = windowMinutes * 60_000;
  const t = now.getTime();
  let best: { ev: EconomicEvent; delta: number } | null = null;
  for (const ev of events) {
    const evt = new Date(ev.event_time).getTime();
    if (Number.isNaN(evt)) continue;
    const delta = Math.abs(evt - t);
    if (delta <= ms && (!best || delta < best.delta)) best = { ev, delta };
  }
  return best?.ev ?? null;
}

/** Minutes from now until the event (negative = already passed). */
export function minutesUntil(event_time: string, now: Date = new Date()): number {
  return Math.round((new Date(event_time).getTime() - now.getTime()) / 60_000);
}

// ─── Feed parsing (faireconomy / ForexFactory weekly JSON) ─────────────────────

/** Raw row shape from the public feed (fields are loosely typed on purpose). */
export interface RawFeedRow {
  title?: string;
  country?: string;   // faireconomy uses the currency code here (e.g. "USD")
  currency?: string;  // some mirrors use "currency" instead
  date?: string;      // ISO-8601 with timezone offset
  impact?: string;    // "High" | "Medium" | "Low" | "Holiday"
  forecast?: string;
  previous?: string;
  actual?: string;
}

function normalizeImpact(raw: string | undefined): Impact | null {
  switch ((raw || "").trim().toLowerCase()) {
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    case "holiday": return "holiday";
    default: return null;
  }
}

/**
 * Parse the public feed into normalised events. Rows without a usable
 * date/currency/impact are dropped. Times are converted to UTC ISO.
 */
export function parseFeed(rows: RawFeedRow[]): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  for (const r of rows) {
    const currency = (r.country || r.currency || "").trim().toUpperCase();
    const impact = normalizeImpact(r.impact);
    const title = (r.title || "").trim();
    if (!currency || !impact || !title || !r.date) continue;

    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;

    out.push({
      event_time: d.toISOString(),
      currency,
      title,
      impact,
      forecast: r.forecast?.trim() || null,
      previous: r.previous?.trim() || null,
      actual: r.actual?.trim() || null,
    });
  }
  return out;
}
