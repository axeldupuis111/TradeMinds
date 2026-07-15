import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";
import {
  currenciesForPairs,
  impactEmoji,
  minutesUntil,
  type EconomicEvent,
  type Impact,
} from "@/lib/economic-calendar";

/**
 * Economic-news pre-alert — Vercel cron every 10 min.
 *
 * For each push-subscribed, opted-in user, finds high/medium-impact events
 * on THEIR currencies starting within the next look-ahead window, and sends
 * a colour-coded push: "🟠 Flash PMI (USD) in 15 min — stay careful."
 * Never blocks trading — it's a heads-up, not a stop.
 *
 * Dedup via economic_event_notifications (one push per user/event). Defensive:
 * missing tables/columns degrade to no-op.
 *
 * `?dryRun=1` : compute candidates and report without sending/writing.
 */

// Notify for events starting within this many minutes (must exceed the cron
// interval so no event slips between runs).
const LOOKAHEAD_MINUTES = 20;

// Low-impact prints are too frequent to push — only orange/red get a pre-alert.
const PUSH_IMPACTS: Impact[] = ["high", "medium"];

type Lang = "fr" | "en" | "de" | "es";

const COPY: Record<Lang, { title: string; body: (emoji: string, name: string, cur: string, mins: number) => string }> = {
  fr: {
    title: "Annonce économique",
    body: (e, name, cur, m) => `${e} ${name} (${cur}) dans ${m} min : reste prudent, volatilité possible.`,
  },
  en: {
    title: "Economic announcement",
    body: (e, name, cur, m) => `${e} ${name} (${cur}) in ${m} min: stay careful, volatility ahead.`,
  },
  de: {
    title: "Wirtschaftstermin",
    body: (e, name, cur, m) => `${e} ${name} (${cur}) in ${m} Min.: bleib vorsichtig, Volatilität möglich.`,
  },
  es: {
    title: "Anuncio económico",
    body: (e, name, cur, m) => `${e} ${name} (${cur}) en ${m} min: mantén la prudencia, posible volatilidad.`,
  },
};

const DEFAULT_CURRENCIES = ["USD", "EUR", "GBP", "JPY"];

async function handle(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 1. Upcoming events in the look-ahead window (orange/red only).
  const now = new Date();
  const end = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60_000);
  const { data: rawEvents, error: evErr } = await supabase
    .from("economic_events")
    .select("id, event_time, currency, title, impact")
    .gte("event_time", now.toISOString())
    .lte("event_time", end.toISOString())
    .in("impact", PUSH_IMPACTS)
    .order("event_time", { ascending: true });

  if (evErr) return NextResponse.json({ error: "events query failed", detail: evErr.message }, { status: 500 });
  const events = (rawEvents ?? []) as (EconomicEvent & { id: string })[];
  if (events.length === 0) return NextResponse.json({ notified: 0, reason: "no upcoming events" });

  // 2. Users who have at least one push subscription.
  const { data: subRows } = await supabase.from("push_subscriptions").select("user_id");
  const subscribedIds = Array.from(new Set((subRows ?? []).map((r) => (r as { user_id: string }).user_id)));
  if (subscribedIds.length === 0) return NextResponse.json({ notified: 0, reason: "no subscribers" });

  // 3. Their language + opt-out preference.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, language, push_notif_news")
    .in("id", subscribedIds);
  const optedUsers = (profiles ?? []).filter((p) => (p as { push_notif_news?: boolean }).push_notif_news !== false);
  if (optedUsers.length === 0) return NextResponse.json({ notified: 0, reason: "no opted-in users" });

  // 4. Build (user, event) candidates filtered by each user's currencies.
  const since = new Date();
  since.setDate(since.getDate() - 120);
  const candidates: { userId: string; lang: Lang; event: EconomicEvent & { id: string } }[] = [];

  for (const user of optedUsers) {
    const userId = (user as { id: string }).id;
    const lang: Lang = ((user as { language?: string }).language as Lang) in COPY
      ? ((user as { language?: string }).language as Lang)
      : "en";

    const { data: trades } = await supabase
      .from("trades")
      .select("pair")
      .eq("user_id", userId)
      .gte("open_time", since.toISOString())
      .limit(500);
    const pairs = Array.from(new Set((trades ?? []).map((t) => (t as { pair: string }).pair).filter(Boolean)));
    const currencies = pairs.length > 0 ? currenciesForPairs(pairs) : [];
    const wanted = new Set((currencies.length > 0 ? currencies : DEFAULT_CURRENCIES).map((c) => c.toUpperCase()));

    for (const ev of events) {
      if (wanted.has(ev.currency.toUpperCase())) candidates.push({ userId, lang, event: ev });
    }
  }

  if (candidates.length === 0) return NextResponse.json({ notified: 0, reason: "no currency match" });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      upcoming: events.length,
      candidates: candidates.map((c) => ({ userId: c.userId, event: c.event.title, currency: c.event.currency })),
    });
  }

  // 5. Atomic dedup: insert-ignore-duplicates, push only for newly inserted rows.
  const { data: inserted, error: insErr } = await supabase
    .from("economic_event_notifications")
    .upsert(
      candidates.map((c) => ({ user_id: c.userId, event_id: c.event.id })),
      { onConflict: "user_id,event_id", ignoreDuplicates: true },
    )
    .select("user_id, event_id");

  if (insErr) return NextResponse.json({ error: "dedup insert failed", detail: insErr.message }, { status: 500 });
  const fresh = new Set((inserted ?? []).map((r) => `${(r as { user_id: string }).user_id}:${(r as { event_id: string }).event_id}`));

  let notified = 0;
  for (const c of candidates) {
    if (!fresh.has(`${c.userId}:${c.event.id}`)) continue;
    const mins = Math.max(0, minutesUntil(c.event.event_time, now));
    const copy = COPY[c.lang];
    const sent = await sendPushToUser(c.userId, {
      title: copy.title,
      body: copy.body(impactEmoji(c.event.impact), c.event.title, c.event.currency, mins),
      url: "/dashboard/session",
      tag: `econ-${c.event.id}`,
    });
    if (sent > 0) notified++;
  }

  return NextResponse.json({ notified, candidates: candidates.length, freshlyLogged: fresh.size });
}

// Vercel crons invoke via GET; POST kept for manual testing.
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
