import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { groupByUser, statsForPeriod, type ReviewRow, type TradeRow } from "@/lib/challenge-stats";
import {
  challengeCompleted,
  challengeProgress,
  challengeRankScore,
  competitionRanks,
  type ChallengeMetric,
  type WeekStats,
} from "@/lib/community-challenges";
import {
  MAX_OPEN_CHALLENGES,
  dayKeysBetween,
  getMetricSpec,
  normalizeSlug,
  phaseOf,
  previousDayKeys,
  validateChallengeDraft,
  type ChallengeDraft,
} from "@/lib/community";
import { localDateKey } from "@/lib/timezone";
import { isUsernameDisplayable } from "@/lib/username-moderation";

/**
 * Communautés partenaires : appartenance, défis privés et classement interne.
 *
 * Le partenaire crée ses défis, seuls SES membres les voient. Tout membre est
 * classé d'office (pas de bouton « rejoindre » : sur 20 personnes, un tableau
 * vide tuerait la mécanique), et les scores sont recalculés ici à partir des
 * trades et des séances — jamais postés par le client.
 *
 * Contrairement aux défis hebdo publics, les résultats ne sont PAS figés dans
 * une table d'awards : ces défis ne donnent ni gel de série ni certificat (le
 * créateur du défi n'est pas neutre, il pourrait fabriquer un objectif trivial
 * et distribuer des récompenses à l'infini). Classement honorifique, donc
 * recalcul à la volée, ce qui évite toute clôture à orchestrer.
 */

export const dynamic = "force-dynamic";

/** Au-delà, on ne classe plus tout le monde à chaque requête (coût de calcul). */
const MEMBERS_RANKED_CAP = 300;
/** Défis terminés encore affichés (en jours depuis la fin). */
const ENDED_VISIBLE_DAYS = 30;
/** Taille du mini-classement renvoyé par défi. */
const BOARD_SIZE = 20;

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

interface CommunityRow {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  active: boolean;
}

interface ChallengeRow {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  starts_on: string;
  ends_on: string;
  created_at: string;
}

const DAY_MS = 86_400_000;

function shiftDay(key: string, delta: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

type Admin = ReturnType<typeof serviceClient>;

/** La communauté de l'utilisateur (celle qu'il a rejointe), ou null. */
async function myCommunity(admin: Admin, userId: string): Promise<CommunityRow | null> {
  const { data: member } = await admin
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;
  const { data } = await admin
    .from("communities")
    .select("id, slug, name, owner_id, active")
    .eq("id", member.community_id as string)
    .maybeSingle();
  return (data as CommunityRow | null) ?? null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = serviceClient();
  const today = localDateKey(auth.timezone);

  let community: CommunityRow | null = null;
  try {
    community = await myCommunity(admin, auth.userId);
  } catch {
    // Migration pas encore appliquée : la page affiche l'état « pas de communauté ».
    return NextResponse.json({ community: null, today, challenges: [] });
  }

  if (!community || !community.active) {
    return NextResponse.json({ community: null, today, challenges: [] });
  }

  const isOwner = community.owner_id === auth.userId;

  const [{ count: memberCount }, { data: challengeRows }] = await Promise.all([
    admin.from("community_members").select("user_id", { count: "exact", head: true }).eq("community_id", community.id),
    admin
      .from("community_challenges")
      .select("id, community_id, title, description, metric, target, starts_on, ends_on, created_at")
      .eq("community_id", community.id)
      .gte("ends_on", shiftDay(today, -ENDED_VISIBLE_DAYS))
      .order("starts_on", { ascending: false }),
  ]);

  // Métrique inconnue = ligne écrite avant un retrait du catalogue : on l'ignore
  // plutôt que de la mesurer avec la mauvaise règle.
  const challenges = ((challengeRows ?? []) as ChallengeRow[]).filter((c) => getMetricSpec(c.metric));
  const header = {
    slug: community.slug,
    name: community.name,
    memberCount: memberCount ?? 0,
    isOwner,
  };

  if (challenges.length === 0) {
    return NextResponse.json({ community: header, today, challenges: [] });
  }

  // ── Membres classés ────────────────────────────────────────────────────────
  const { data: memberRows } = await admin
    .from("community_members")
    .select("user_id")
    .eq("community_id", community.id)
    .order("joined_at", { ascending: true })
    .limit(MEMBERS_RANKED_CAP);
  const memberIds = Array.from(new Set([...(memberRows ?? []).map((m) => m.user_id as string), auth.userId]));

  // Fenêtre de données à charger : du début de la période de RÉFÉRENCE du plus
  // ancien défi (score_climb regarde la période précédente) à aujourd'hui.
  // Marge d'un jour de chaque côté pour les fuseaux.
  let earliest = today;
  for (const c of challenges) {
    const prev = previousDayKeys(c.starts_on, c.ends_on);
    const from = prev[0] ?? c.starts_on;
    if (from < earliest) earliest = from;
  }
  const since = new Date(Date.parse(`${earliest}T00:00:00Z`) - DAY_MS).toISOString();

  const [{ data: profs }, { data: trades }, { data: reviews }] = await Promise.all([
    admin.from("profiles").select("id, username, timezone").in("id", memberIds),
    admin
      .from("trades")
      .select("user_id, emotion, open_time")
      .in("user_id", memberIds)
      .eq("status", "closed")
      .gte("open_time", since),
    admin
      .from("session_reviews")
      .select("user_id, discipline_score, created_at")
      .in("user_id", memberIds)
      .gte("created_at", since),
  ]);

  const nameById = new Map(
    (profs ?? []).map((p) => [
      p.id as string,
      isUsernameDisplayable(p.username as string | null) ? (p.username as string) : null,
    ]),
  );
  const tzById = new Map((profs ?? []).map((p) => [p.id as string, (p.timezone as string) || "UTC"]));
  const tradesByUser = groupByUser((trades ?? []) as TradeRow[]);
  const reviewsByUser = groupByUser((reviews ?? []) as ReviewRow[]);

  const statsCache = new Map<string, WeekStats>();
  const statsOf = (userId: string, challengeId: string, days: string[], prevDays: string[]): WeekStats => {
    const cacheKey = `${userId}:${challengeId}`;
    const hit = statsCache.get(cacheKey);
    if (hit) return hit;
    const s = statsForPeriod(
      tzById.get(userId) || "UTC",
      days,
      prevDays,
      tradesByUser.get(userId) ?? [],
      reviewsByUser.get(userId) ?? [],
    );
    statsCache.set(cacheKey, s);
    return s;
  };

  const payload = challenges.map((c) => {
    const spec = getMetricSpec(c.metric);
    const days = dayKeysBetween(c.starts_on, c.ends_on);
    const prevDays = previousDayKeys(c.starts_on, c.ends_on);
    const phase = phaseOf(c.starts_on, c.ends_on, today);
    // Adaptateur vers les fonctions de score du pool public : mêmes règles de
    // mesure, seuls le libellé et la cible viennent de la base.
    const pseudo = { key: c.id, metric: spec!.metric as ChallengeMetric, target: c.target, titleKey: "", descKey: "" };

    const entries = memberIds.map((id) => {
      const s = statsOf(id, c.id, days, prevDays);
      return {
        id,
        name: nameById.get(id) || "Trader",
        progress: challengeProgress(pseudo, s),
        rankScore: challengeRankScore(pseudo, s),
        completed: challengeCompleted(pseudo, s),
        isMe: id === auth.userId,
      };
    });

    // Seuls ceux qui ont commencé apparaissent au classement ; le demandeur voit
    // toujours sa propre ligne dans `me`, même à zéro.
    const active = entries.filter((e) => e.progress > 0);
    const ranks = competitionRanks(active.map((e) => e.rankScore));
    const board = active
      .map((e, i) => ({ ...e, rank: ranks[i] ?? active.length }))
      .sort((a, b) => a.rank - b.rank || (a.isMe ? -1 : 0))
      .slice(0, BOARD_SIZE)
      .map((e) => ({ name: e.name, progress: e.progress, rank: e.rank, isMe: e.isMe }));

    const me = entries.find((e) => e.isMe);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      metric: c.metric,
      target: c.target,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      phase,
      participants: active.length,
      finishers: entries.filter((e) => e.completed).length,
      myProgress: me?.progress ?? 0,
      completed: me?.completed ?? false,
      leaderboard: board,
    };
  });

  return NextResponse.json({ community: header, today, challenges: payload });
}

// ── Actions ──────────────────────────────────────────────────────────────────

interface PostBody {
  action?: "join" | "leave" | "create_challenge" | "delete_challenge";
  slug?: string;
  source?: string;
  id?: string;
  title?: string;
  description?: string;
  metric?: string;
  target?: number;
  startsOn?: string;
  endsOn?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const admin = serviceClient();
  const today = localDateKey(auth.timezone);

  try {
    switch (body.action) {
      case "join":
        return await join(admin, auth.userId, body);
      case "leave": {
        await admin.from("community_members").delete().eq("user_id", auth.userId);
        return NextResponse.json({ ok: true, community: null });
      }
      case "create_challenge":
        return await createChallenge(admin, auth.userId, body, today);
      case "delete_challenge":
        return await deleteChallenge(admin, auth.userId, body.id);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[community] action failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function join(admin: Admin, userId: string, body: PostBody) {
  const slug = normalizeSlug(body.slug || "");
  if (!slug) return NextResponse.json({ error: "cc_err_unknown_code" }, { status: 400 });

  const { data: found } = await admin
    .from("communities")
    .select("id, slug, name, owner_id, active")
    .eq("slug", slug)
    .maybeSingle();
  const community = found as CommunityRow | null;
  if (!community || !community.active) {
    return NextResponse.json({ error: "cc_err_unknown_code" }, { status: 404 });
  }

  // First-touch : une appartenance déjà posée n'est pas écrasée par un second
  // lien (même règle que l'attribution marketing). Le membre doit quitter la
  // première communauté pour en rejoindre une autre.
  const { data: existing } = await admin
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing && existing.community_id !== community.id) {
    return NextResponse.json({ error: "cc_err_already_member" }, { status: 409 });
  }

  const source = body.source === "referral" ? "referral" : community.owner_id === userId ? "owner" : "code";
  const { error } = await admin
    .from("community_members")
    .upsert({ user_id: userId, community_id: community.id, source }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({ ok: true, community: { slug: community.slug, name: community.name } });
}

async function ownedCommunity(admin: Admin, userId: string): Promise<CommunityRow | null> {
  const { data } = await admin
    .from("communities")
    .select("id, slug, name, owner_id, active")
    .eq("owner_id", userId)
    .eq("active", true)
    .maybeSingle();
  return (data as CommunityRow | null) ?? null;
}

async function createChallenge(admin: Admin, userId: string, body: PostBody, today: string) {
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  const draft: ChallengeDraft = {
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    metric: String(body.metric ?? ""),
    target: Number(body.target),
    startsOn: String(body.startsOn ?? ""),
    endsOn: String(body.endsOn ?? ""),
  };
  const invalid = validateChallengeDraft(draft, today);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Plafond sur les défis en cours ou à venir (les terminés ne comptent pas).
  const { count } = await admin
    .from("community_challenges")
    .select("id", { count: "exact", head: true })
    .eq("community_id", community.id)
    .gte("ends_on", today);
  if ((count ?? 0) >= MAX_OPEN_CHALLENGES) {
    return NextResponse.json({ error: "cc_err_too_many" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("community_challenges")
    .insert({
      community_id: community.id,
      created_by: userId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      metric: draft.metric,
      target: draft.target,
      starts_on: draft.startsOn,
      ends_on: draft.endsOn,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[community] insert challenge failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}

async function deleteChallenge(admin: Admin, userId: string, id?: string) {
  if (!id) return NextResponse.json({ error: "cc_err_not_found" }, { status: 400 });
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  const { error } = await admin
    .from("community_challenges")
    .delete()
    .eq("id", id)
    .eq("community_id", community.id); // un partenaire ne supprime que chez lui
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
