import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { computeDisciplineStreaks } from "@/lib/discipline-streak";
import { localDateKey } from "@/lib/timezone";
import { COMMUNITY_CHALLENGES, getCommunityChallenge, IMPULSIVE_EMOTIONS } from "@/lib/community-challenges";
import { isUsernameDisplayable } from "@/lib/username-moderation";

/**
 * Community challenges: join/leave + a dedicated ranking per challenge.
 *
 * Challenges are code-defined (lib/community-challenges). Progress for the only
 * metric so far ("clean_streak") = current run of consecutive trading days with
 * no impulsive trade, computed in each participant's own timezone. The ranking
 * is an aggregate over participants, so it's read with the service role (only
 * usernames + progress are exposed, and joining is explicit opt-in).
 */

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

interface Row { user_id: string; emotion: string | null; open_time: string | null }

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = serviceClient();

  const { data: parts } = await admin.from("challenge_participations").select("user_id, challenge_key");
  const participations = parts ?? [];
  const allIds = Array.from(new Set(participations.map((p) => p.user_id as string)));

  // Names + timezones for everyone involved (plus the current user, for "me").
  const idsForProfiles = Array.from(new Set([...allIds, auth.userId]));
  const { data: profs } = idsForProfiles.length
    ? await admin.from("profiles").select("id, username, timezone").in("id", idsForProfiles)
    : { data: [] as { id: string; username: string | null; timezone: string | null }[] };
  // Un pseudo bloqué par la modération n'est jamais exposé (fallback "Trader").
  const nameById = new Map((profs ?? []).map((p) => [
    p.id,
    isUsernameDisplayable(p.username as string | null) ? (p.username as string) : null,
  ]));
  const tzById = new Map((profs ?? []).map((p) => [p.id, (p.timezone as string) || "UTC"]));

  // Closed trades (last 120 days) for all participants + the current user.
  const idsForTrades = Array.from(new Set([...allIds, auth.userId]));
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data: trades } = idsForTrades.length
    ? await admin
        .from("trades")
        .select("user_id, emotion, open_time")
        .in("user_id", idsForTrades)
        .eq("status", "closed")
        .gte("open_time", since)
    : { data: [] as Row[] };

  const tradesByUser = new Map<string, Row[]>();
  for (const t of (trades ?? []) as Row[]) {
    const arr = tradesByUser.get(t.user_id) ?? [];
    arr.push(t);
    tradesByUser.set(t.user_id, arr);
  }

  const cleanStreak = (userId: string): number => {
    const uTrades = tradesByUser.get(userId) ?? [];
    const tz = tzById.get(userId) || "UTC";
    const byDay = new Map<string, boolean>();
    for (const t of uTrades) {
      if (!t.open_time) continue;
      const day = localDateKey(tz, new Date(t.open_time));
      const emotional = !!t.emotion && IMPULSIVE_EMOTIONS.has(t.emotion);
      byDay.set(day, (byDay.get(day) ?? false) || emotional);
    }
    const days = Array.from(byDay.entries()).map(([day, emotional]) => ({ day, emotional }));
    return computeDisciplineStreaks(days).current;
  };

  const challenges = COMMUNITY_CHALLENGES.map((c) => {
    const ids = participations.filter((p) => p.challenge_key === c.key).map((p) => p.user_id as string);
    const board = ids
      .map((id) => ({
        name: nameById.get(id) || "Trader",
        progress: cleanStreak(id),
        isMe: id === auth.userId,
      }))
      .sort((a, b) => b.progress - a.progress || (a.isMe ? -1 : 0))
      .slice(0, 10);

    return {
      key: c.key,
      target: c.target,
      joined: ids.includes(auth.userId),
      participantCount: ids.length,
      myProgress: cleanStreak(auth.userId),
      leaderboard: board,
    };
  });

  return NextResponse.json({ challenges });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { challengeKey?: string; action?: "join" | "leave" };
  if (!body.challengeKey || !getCommunityChallenge(body.challengeKey)) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 400 });
  }

  const admin = serviceClient();

  if (body.action === "leave") {
    const { error } = await admin
      .from("challenge_participations")
      .delete()
      .eq("user_id", auth.userId)
      .eq("challenge_key", body.challengeKey);
    if (error) return NextResponse.json({ error: "leave failed" }, { status: 500 });
    return NextResponse.json({ ok: true, joined: false });
  }

  // Default: join (idempotent).
  const { error } = await admin
    .from("challenge_participations")
    .upsert({ user_id: auth.userId, challenge_key: body.challengeKey }, { onConflict: "user_id,challenge_key" });
  if (error) return NextResponse.json({ error: "join failed" }, { status: 500 });
  return NextResponse.json({ ok: true, joined: true });
}
