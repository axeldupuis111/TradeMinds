import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { groupByUser, statsForPeriod, type ReviewRow, type TradeRow } from "@/lib/challenge-stats";
import {
  MIN_PODIUM_PARTICIPANTS,
  challengeCompleted,
  challengeProgress,
  challengeRankScore,
  challengesForWeek,
  competitionRanks,
  getCommunityChallenge,
  isoWeekKey,
  previousWeekKey,
  weekDayKeys,
  weekEndUtc,
  weekStartUtc,
  type CommunityChallenge,
  type WeekStats,
} from "@/lib/community-challenges";
import { isUsernameDisplayable } from "@/lib/username-moderation";

/**
 * Défis communautaires hebdomadaires : tirage de la semaine, join/leave,
 * classement live, et CLÔTURE PARESSEUSE de la semaine précédente.
 *
 * Le tirage est déterministe (lib/community-challenges), donc aucune table de
 * défis ni cron : la première requête qui arrive après le lundi 00:00 UTC
 * constate que la semaine passée n'est pas clôturée, fige les résultats dans
 * challenge_awards (service role, idempotent — contrainte unique + marqueur
 * challenge_week_closures écrit APRÈS les awards), puis sert la réponse.
 *
 * Réussite et classement sont séparés : la réussite est binaire (objectif →
 * +1 gel), le rang se joue sur un score continu (décimales du score moyen de
 * la semaine en départage) — voir lib/community-challenges.
 */

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

interface PartRow { user_id: string; challenge_key: string }

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = serviceClient();

  const weekKey = isoWeekKey();
  const prevKey = previousWeekKey(weekKey);
  const prevPrevKey = previousWeekKey(prevKey);
  const days = weekDayKeys(weekKey);
  const prevDays = weekDayKeys(prevKey);
  const prevPrevDays = weekDayKeys(prevPrevKey);
  const challenges = challengesForWeek(weekKey);
  const prevChallenges = challengesForWeek(prevKey);

  const [{ data: partsCur }, { data: partsPrev }] = await Promise.all([
    admin.from("challenge_participations").select("user_id, challenge_key").eq("week_key", weekKey),
    admin.from("challenge_participations").select("user_id, challenge_key").eq("week_key", prevKey),
  ]);
  const cur = (partsCur ?? []) as PartRow[];
  const prev = (partsPrev ?? []) as PartRow[];

  const allIds = Array.from(new Set([...cur.map((p) => p.user_id), ...prev.map((p) => p.user_id), auth.userId]));

  // Profils (pseudo modéré + fuseau) et données brutes des 3 dernières semaines
  // (la semaine d'avant-avant sert de base au défi score-climb de la semaine
  // passée lors de la clôture). Marge d'1 jour de chaque côté pour les fuseaux.
  const sinceTrades = new Date(weekStartUtc(prevKey).getTime() - 86_400_000).toISOString();
  const sinceReviews = new Date(weekStartUtc(prevPrevKey).getTime() - 86_400_000).toISOString();
  const [{ data: profs }, { data: trades }, { data: reviews }] = await Promise.all([
    admin.from("profiles").select("id, username, timezone").in("id", allIds),
    admin.from("trades").select("user_id, emotion, open_time").in("user_id", allIds).eq("status", "closed").gte("open_time", sinceTrades),
    admin.from("session_reviews").select("user_id, discipline_score, created_at").in("user_id", allIds).gte("created_at", sinceReviews),
  ]);

  const nameById = new Map((profs ?? []).map((p) => [
    p.id,
    isUsernameDisplayable(p.username as string | null) ? (p.username as string) : null,
  ]));
  const tzById = new Map((profs ?? []).map((p) => [p.id, (p.timezone as string) || "UTC"]));

  const tradesByUser = groupByUser((trades ?? []) as TradeRow[]);
  const reviewsByUser = groupByUser((reviews ?? []) as ReviewRow[]);

  const statsCache = new Map<string, WeekStats>();
  const weekStatsOf = (userId: string, d: string[], pd: string[]): WeekStats => {
    const cacheKey = `${userId}:${d[0]}`;
    const hit = statsCache.get(cacheKey);
    if (hit) return hit;
    const s = statsForPeriod(tzById.get(userId) || "UTC", d, pd, tradesByUser.get(userId) ?? [], reviewsByUser.get(userId) ?? []);
    statsCache.set(cacheKey, s);
    return s;
  };

  // ── Clôture paresseuse de la semaine précédente ────────────────────────────
  try {
    const { data: closure } = await admin
      .from("challenge_week_closures").select("week_key").eq("week_key", prevKey).maybeSingle();
    if (!closure) {
      const rows: {
        user_id: string; week_key: string; challenge_key: string;
        completed: boolean; rank: number | null; progress: number; score: number;
      }[] = [];
      for (const c of prevChallenges) {
        const ids = prev.filter((p) => p.challenge_key === c.key).map((p) => p.user_id);
        const entries = ids.map((id) => {
          const s = weekStatsOf(id, prevDays, prevPrevDays);
          return { id, progress: challengeProgress(c, s), completed: challengeCompleted(c, s), score: challengeRankScore(c, s) };
        });
        const active = entries.filter((e) => e.progress > 0 || e.completed);
        // Podium seulement s'il y a une vraie compétition ; sinon les rangs
        // restent nuls (les finishers gardent leur gel).
        const ranks = active.length >= MIN_PODIUM_PARTICIPANTS
          ? competitionRanks(active.map((e) => e.score))
          : active.map(() => null);
        active.forEach((e, i) => {
          rows.push({
            user_id: e.id, week_key: prevKey, challenge_key: c.key,
            completed: e.completed, rank: ranks[i], progress: e.progress,
            score: Math.round(e.score * 1000) / 1000,
          });
        });
      }
      if (rows.length > 0) {
        await admin.from("challenge_awards").upsert(rows, {
          onConflict: "user_id,week_key,challenge_key",
          ignoreDuplicates: true,
        });
      }
      // Marqueur écrit APRÈS les awards : un crash entre les deux rejoue la
      // clôture (déterministe + contrainte unique → aucune perte, aucun doublon).
      await admin.from("challenge_week_closures").upsert({ week_key: prevKey }, { onConflict: "week_key", ignoreDuplicates: true });
    }
  } catch { /* migration absente — les défis restent servis sans clôture */ }

  // ── Défis de la semaine courante ───────────────────────────────────────────
  const payload = challenges.map((c: CommunityChallenge) => {
    const ids = cur.filter((p) => p.challenge_key === c.key).map((p) => p.user_id);
    const board = ids
      .map((id) => {
        const s = weekStatsOf(id, days, prevDays);
        return {
          name: nameById.get(id) || "Trader",
          progress: challengeProgress(c, s),
          rankScore: challengeRankScore(c, s),
          isMe: id === auth.userId,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore || (a.isMe ? -1 : 0))
      .slice(0, 10)
      .map((e) => ({ name: e.name, progress: e.progress, isMe: e.isMe })); // le score exact reste côté serveur

    const myStats = weekStatsOf(auth.userId, days, prevDays);
    return {
      key: c.key,
      target: c.target,
      joined: ids.includes(auth.userId),
      participantCount: ids.length,
      myProgress: challengeProgress(c, myStats),
      completed: challengeCompleted(c, myStats),
      leaderboard: board,
    };
  });

  // ── Résultats de la semaine dernière (podium + mon bilan) ──────────────────
  type AwardRow = { user_id: string; challenge_key: string; completed: boolean; rank: number | null; progress: number; awarded_at: string };
  let lastWeek: {
    weekKey: string;
    results: {
      key: string;
      podium: { name: string; rank: number; isMe: boolean }[];
      finishers: number;
      me: { completed: boolean; rank: number | null; progress: number; awardedAt: string } | null;
    }[];
  } | null = null;
  try {
    const { data: awardRows } = await admin
      .from("challenge_awards")
      .select("user_id, challenge_key, completed, rank, progress, awarded_at")
      .eq("week_key", prevKey);
    const awards = (awardRows ?? []) as AwardRow[];
    if (awards.length > 0) {
      // Pseudos des médaillés qui ne sont pas déjà chargés.
      const podiumIds = awards.filter((a) => a.rank != null && a.rank <= 3).map((a) => a.user_id);
      const missing = podiumIds.filter((id) => !nameById.has(id));
      if (missing.length > 0) {
        const { data: extra } = await admin.from("profiles").select("id, username").in("id", missing);
        for (const p of extra ?? []) {
          nameById.set(p.id, isUsernameDisplayable(p.username as string | null) ? (p.username as string) : null);
        }
      }
      lastWeek = {
        weekKey: prevKey,
        results: prevChallenges.map((c) => {
          const forChallenge = awards.filter((a) => a.challenge_key === c.key);
          const mine = forChallenge.find((a) => a.user_id === auth.userId) ?? null;
          return {
            key: c.key,
            podium: forChallenge
              .filter((a) => a.rank != null && a.rank <= 3)
              .sort((a, b) => (a.rank as number) - (b.rank as number))
              .slice(0, 3)
              .map((a) => ({ name: nameById.get(a.user_id) || "Trader", rank: a.rank as number, isMe: a.user_id === auth.userId })),
            finishers: forChallenge.filter((a) => a.completed).length,
            me: mine
              ? { completed: mine.completed, rank: mine.rank, progress: mine.progress, awardedAt: mine.awarded_at }
              : null,
          };
        }).filter((r) => r.podium.length > 0 || r.finishers > 0 || r.me),
      };
      if (lastWeek.results.length === 0) lastWeek = null;
    }
  } catch { /* migration absente — pas de rétrospective */ }

  return NextResponse.json({
    weekKey,
    endsAt: weekEndUtc(weekKey).toISOString(),
    challenges: payload,
    lastWeek,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { challengeKey?: string; action?: "join" | "leave" };
  const weekKey = isoWeekKey();
  // On ne peut rejoindre que les défis DU TIRAGE de la semaine en cours.
  const inDraw = challengesForWeek(weekKey).some((c) => c.key === body.challengeKey);
  if (!body.challengeKey || !getCommunityChallenge(body.challengeKey) || !inDraw) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 400 });
  }

  const admin = serviceClient();

  if (body.action === "leave") {
    const { error } = await admin
      .from("challenge_participations")
      .delete()
      .eq("user_id", auth.userId)
      .eq("challenge_key", body.challengeKey)
      .eq("week_key", weekKey);
    if (error) return NextResponse.json({ error: "leave failed" }, { status: 500 });
    return NextResponse.json({ ok: true, joined: false });
  }

  // Default: join (idempotent).
  const { error } = await admin
    .from("challenge_participations")
    .upsert(
      { user_id: auth.userId, challenge_key: body.challengeKey, week_key: weekKey },
      { onConflict: "user_id,challenge_key,week_key" },
    );
  if (error) return NextResponse.json({ error: "join failed" }, { status: 500 });
  return NextResponse.json({ ok: true, joined: true });
}
