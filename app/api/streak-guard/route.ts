import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";
import { alertCronFailure } from "@/lib/cron-alert";
import { localHour } from "@/lib/timezone";
import { streakAtRisk, type ReviewRow } from "@/lib/streak-guard";

/**
 * "Streak at risk" push — retention nudge.
 *
 * The user-facing discipline streak (same definition as the leaderboard) is a
 * run of consecutive calendar days with an average discipline score >= 70. It
 * breaks the moment a day passes with no qualifying session. This cron catches
 * traders who have a live streak but haven't logged TODAY, and pushes them in
 * their local evening so they still have time to act before local midnight.
 *
 * Runs hourly; each user is processed once, during their local 20:00 hour
 * (so the nudge lands in the trader's own timezone — see lib/timezone).
 */

export const dynamic = "force-dynamic";

type Lang = "fr" | "en" | "de" | "es";

const GUARD_HOUR = 20;     // 8pm LOCAL — evening, with time left before midnight
const MIN_STREAK = 2;      // only nudge streaks worth protecting
const LOOKBACK_DAYS = 45;  // enough history to measure the trailing streak

const COPY: Record<Lang, { title: string; body: (n: number) => string }> = {
  fr: {
    title: "Ta série est en danger 🔥",
    body: (n) => `Tu as ${n} jours de discipline d'affilée. Note ta session d'aujourd'hui pour ne pas la perdre.`,
  },
  en: {
    title: "Your streak is at risk 🔥",
    body: (n) => `You're on a ${n}-day discipline streak. Log today's session to keep it alive.`,
  },
  de: {
    title: "Deine Serie ist in Gefahr 🔥",
    body: (n) => `Du hast ${n} Tage Disziplin in Folge. Trag deine heutige Session ein, um sie zu halten.`,
  },
  es: {
    title: "Tu racha está en peligro 🔥",
    body: (n) => `Llevas ${n} días seguidos de disciplina. Registra tu sesión de hoy para no perderla.`,
  },
};

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function handle(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  let supabase;
  try {
    supabase = serviceClient();
  } catch {
    return NextResponse.json({ error: "No Supabase config" }, { status: 500 });
  }

  // 1. Users with at least one push subscription.
  const { data: subs, error: subErr } = await supabase.from("push_subscriptions").select("user_id");
  if (subErr) {
    await alertCronFailure("streak-guard", `push_subscriptions query failed: ${subErr.message}`);
    return NextResponse.json({ error: "subs query failed" }, { status: 500 });
  }
  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
  if (userIds.length === 0) return NextResponse.json({ notified: 0, reason: "no subscribers" });

  // 2. Their language / timezone / alert opt-out.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, language, timezone, push_notif_alerts")
    .in("id", userIds);
  if (profErr) {
    await alertCronFailure("streak-guard", `profiles query failed: ${profErr.message}`);
    return NextResponse.json({ error: "profiles query failed" }, { status: 500 });
  }

  // 3. Keep only users whose LOCAL hour is the guard hour and who haven't opted out.
  const due = (profiles ?? []).filter((p) => {
    if ((p as { push_notif_alerts?: boolean }).push_notif_alerts === false) return false;
    return dryRun || localHour((p.timezone as string) || "UTC") === GUARD_HOUR;
  });
  if (due.length === 0) return NextResponse.json({ notified: 0, reason: "none due this hour" });

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  let notified = 0;
  const preview: { user_id: string; streak: number }[] = [];

  for (const p of due) {
    const tz = (p.timezone as string) || "UTC";
    const { data: reviews } = await supabase
      .from("session_reviews")
      .select("user_id, created_at, discipline_score")
      .eq("user_id", p.id)
      .gte("created_at", sinceIso);

    const { streak, loggedToday } = streakAtRisk((reviews ?? []) as ReviewRow[], tz);
    if (loggedToday || streak < MIN_STREAK) continue;

    if (dryRun) {
      preview.push({ user_id: p.id, streak });
      continue;
    }

    const lang = ((p.language as Lang) in COPY ? (p.language as Lang) : "en");
    const copy = COPY[lang];
    const n = await sendPushToUser(p.id, {
      title: copy.title,
      body: copy.body(streak),
      url: "/dashboard/session",
      tag: "streak-guard",
    });
    if (n > 0) notified += 1;
  }

  return NextResponse.json(
    dryRun ? { dryRun: true, due: due.length, wouldNotify: preview.length, preview } : { notified, due: due.length },
  );
}

// Vercel crons invoke via GET; POST kept for manual testing.
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
