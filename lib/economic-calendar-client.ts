/**
 * economic-calendar-client.ts
 * Browser-side loaders shared by EconomicCalendarCard and NewsWindowGuard.
 * Reads the shared `economic_events` cache and the trader's own symbols,
 * then narrows to the events that actually matter for them.
 *
 * Defensive by design: if the migration hasn't been applied yet (table
 * missing) or anything errors, callers get an empty list — the feature
 * silently no-ops rather than breaking the dashboard.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currenciesForPairs,
  filterRelevantEvents,
  type EconomicEvent,
  type Impact,
} from "@/lib/economic-calendar";

/** Currencies to watch when the trader has no recorded trades yet. */
const DEFAULT_CURRENCIES = ["USD", "EUR", "GBP", "JPY"];

export interface UserNewsContext {
  events: EconomicEvent[];
  currencies: string[];
}

/** Start/end of today in the local timezone, as UTC ISO bounds. */
function localDayBoundsIso(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Distinct currencies the trader is exposed to, derived from their symbols. */
async function loadUserCurrencies(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - 120);
  const { data, error } = await supabase
    .from("trades")
    .select("pair")
    .eq("user_id", userId)
    .gte("open_time", since.toISOString())
    .limit(500);
  if (error || !data || data.length === 0) return DEFAULT_CURRENCIES;
  const pairs = Array.from(new Set(data.map((r) => (r as { pair: string }).pair).filter(Boolean)));
  const currencies = currenciesForPairs(pairs);
  return currencies.length > 0 ? currencies : DEFAULT_CURRENCIES;
}

/**
 * Today's relevant economic events for the signed-in trader.
 * `minImpact` defaults to "high" (the guardrail bar); the card passes
 * "medium" to give a slightly fuller agenda.
 */
export async function loadTodayNews(
  supabase: SupabaseClient,
  minImpact: Impact = "high",
): Promise<UserNewsContext> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { events: [], currencies: [] };

    const { start, end } = localDayBoundsIso();
    const [{ data: rows, error }, currencies] = await Promise.all([
      supabase
        .from("economic_events")
        .select("event_time, currency, title, impact, forecast, previous, actual")
        .gte("event_time", start)
        .lte("event_time", end)
        .order("event_time", { ascending: true }),
      loadUserCurrencies(supabase, user.id),
    ]);

    if (error || !rows) return { events: [], currencies };

    const events = filterRelevantEvents(rows as EconomicEvent[], currencies, minImpact);
    return { events, currencies };
  } catch {
    return { events: [], currencies: [] };
  }
}
