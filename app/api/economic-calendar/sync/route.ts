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

async function handle(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const feedUrl = process.env.ECONOMIC_CALENDAR_URL || DEFAULT_FEED_URL;

  let rows: RawFeedRow[];
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "TradeDiscipline/1.0 (+https://tradediscipline.app)" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Feed responded ${res.status}` }, { status: 502 });
    }
    rows = (await res.json()) as RawFeedRow[];
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Unexpected feed shape" }, { status: 502 });
    }
  } catch (err) {
    console.error("Economic calendar fetch failed:", err);
    return NextResponse.json({ error: "Feed fetch failed" }, { status: 502 });
  }

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

  // Housekeeping: drop events older than 30 days to keep the table lean.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
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
