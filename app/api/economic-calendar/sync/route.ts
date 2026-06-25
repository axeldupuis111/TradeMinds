import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseFeed, type RawFeedRow } from "@/lib/economic-calendar";

/**
 * Economic-calendar sync — daily Vercel cron.
 *
 * Fetches a public weekly macro-calendar feed (faireconomy/ForexFactory
 * JSON by default), normalises it, and upserts into `economic_events`.
 * This is the only writer of that shared table; the app only ever reads.
 *
 * No third-party API key required for the default feed. Override the
 * source with ECONOMIC_CALENDAR_URL if you switch providers.
 *
 * `?dryRun=1` : fetch + parse and report counts without writing.
 */

const DEFAULT_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const NEXT_WEEK_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_nextweek.json";

/** Fetch + JSON-parse one feed. Returns null (not throw) so one feed failing
 *  never sinks the whole sync — we want this-week even if next-week 404s. */
async function fetchFeed(feedUrl: string): Promise<RawFeedRow[] | null> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "TradeDiscipline/1.0 (+https://tradediscipline.app)" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Economic calendar feed ${feedUrl} responded ${res.status}`);
      return null;
    }
    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? (json as RawFeedRow[]) : null;
  } catch (err) {
    console.error(`Economic calendar fetch failed (${feedUrl}):`, err);
    return null;
  }
}

async function handle(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  // This week is the source of truth; next week extends the forward horizon
  // for the calendar page. A custom override replaces this-week only.
  const thisWeekUrl = process.env.ECONOMIC_CALENDAR_URL || DEFAULT_FEED_URL;
  const [thisWeek, nextWeek] = await Promise.all([
    fetchFeed(thisWeekUrl),
    fetchFeed(NEXT_WEEK_FEED_URL),
  ]);

  // Bail only if we got nothing at all — a missing next-week is tolerated.
  if (thisWeek === null && nextWeek === null) {
    return NextResponse.json({ error: "Feed fetch failed" }, { status: 502 });
  }

  const rows: RawFeedRow[] = [...(thisWeek ?? []), ...(nextWeek ?? [])];
  const events = parseFeed(rows);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      fetched: rows.length,
      parsed: events.length,
      sample: events.slice(0, 8),
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Upsert on the natural key so re-runs refresh forecast/actual in place.
  const { error } = await supabase
    .from("economic_events")
    .upsert(
      events.map((e) => ({
        event_time: e.event_time,
        currency: e.currency,
        title: e.title,
        impact: e.impact,
        forecast: e.forecast,
        previous: e.previous,
        actual: e.actual,
        source: "faireconomy",
      })),
      { onConflict: "event_time,currency,title" },
    );

  if (error) {
    console.error("Economic calendar upsert failed:", error);
    return NextResponse.json({ error: "Upsert failed", detail: error.message }, { status: 500 });
  }

  // Housekeeping: keep ~1 year of history so the calendar's date picker can
  // surface past announcements (the table stays small — a few thousand rows).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  await supabase.from("economic_events").delete().lt("event_time", cutoff.toISOString());

  return NextResponse.json({ upserted: events.length });
}

// Vercel crons invoke via GET; POST kept for manual testing.
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
