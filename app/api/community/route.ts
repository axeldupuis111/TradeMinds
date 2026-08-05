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
  MEMBERS_RANKED_CAP,
  dayKeysBetween,
  getMetricSpec,
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
 * ON N'ENTRE PAS DANS UNE COMMUNAUTÉ DEPUIS CETTE API : l'appartenance se gagne
 * en s'abonnant avec le CODE PROMO du partenaire, et elle est posée par le
 * webhook Stripe (app/api/stripe/webhook). Une seule porte, une seule phrase à
 * dire à son audience (« code NQFX »), et la communauté est exactement la liste
 * des gens que le partenaire a réellement amenés. Reste ici l'ajout manuel par
 * l'animateur, pour ses abonnés d'avant.
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

/** Défis terminés encore affichés (en jours depuis la fin). */
const ENDED_VISIBLE_DAYS = 30;
/** Taille du mini-classement renvoyé par défi. */
const BOARD_SIZE = 20;
/** Fenêtre du signal d'activité affiché à l'animateur dans la liste des membres. */
const ACTIVITY_DAYS = 30;
/** Pagination des lectures en masse (voir fetchAllRows). */
const PAGE_SIZE = 1000;

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

const COMMUNITY_COLS = "id, slug, name, owner_id, active";

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
  updated_at: string | null;
}

const DAY_MS = 86_400_000;

function shiftDay(key: string, delta: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

type Admin = ReturnType<typeof serviceClient>;

/**
 * PostgREST plafonne une réponse à 1000 lignes par défaut. Sur une communauté
 * un peu vivante, les trades de tous les membres dépassent ce plafond : sans
 * pagination le classement se calculerait sur des données tronquées, en
 * silence, et ce sont les derniers membres qui disparaîtraient.
 */
async function fetchAllRows<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }> },
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const { data } = await build().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Une communauté par n'importe laquelle de ses clés. */
async function findCommunity(
  admin: Admin,
  column: "id" | "slug" | "owner_id",
  value: string,
  activeOnly = false,
): Promise<CommunityRow | null> {
  const base = admin.from("communities").select(COMMUNITY_COLS).eq(column, value);
  const { data } = await (activeOnly ? base.eq("active", true) : base).maybeSingle();
  return (data as unknown as CommunityRow | null) ?? null;
}

/** La communauté de l'utilisateur (celle qu'il a rejointe), ou null. */
async function myCommunity(admin: Admin, userId: string): Promise<CommunityRow | null> {
  const { data: member } = await admin
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;
  return findCommunity(admin, "id", member.community_id as string);
}

// ── Cache du classement ──────────────────────────────────────────────────────
//
// Classer une communauté coûte cher : les trades et les séances de tous ses
// membres sur la fenêtre du défi (jusqu'à 180 jours pour « progression du
// score »), puis un calcul de stats par membre et par défi. Quand vingt membres
// ouvrent la page dans la même heure, c'est vingt fois le même travail.
//
// On mémorise donc le classement des AUTRES membres, et on recalcule toujours
// la ligne du demandeur (une requête sur un seul utilisateur) : voir sa propre
// progression bouger juste après avoir noté une séance est le retour immédiat
// qui fait tenir la mécanique, alors qu'une minute de retard sur le rang des
// autres ne se remarque pas.
//
// Simple optimisation de lambda tiède : un cache vide reste parfaitement
// correct, il coûte juste le calcul complet.

interface Entry {
  id: string;
  name: string;
  progress: number;
  rankScore: number;
  completed: boolean;
}

interface CacheSlot {
  at: number;
  byChallenge: Map<string, Entry[]>;
}

const RANKING_TTL_MS = 90_000;
const RANKING_CACHE_MAX = 64;
const rankingCache = new Map<string, CacheSlot>();

/**
 * La clé englobe tout ce qui change un classement sans changer les trades :
 * le jour local, et la définition de chaque défi (une cible corrigée par
 * l'animateur doit invalider immédiatement, pas au bout du TTL).
 */
function rankingKey(communityId: string, today: string, challenges: ChallengeRow[]): string {
  const sig = challenges
    .map((c) => `${c.id}:${c.metric}:${c.target}:${c.starts_on}:${c.ends_on}:${c.updated_at ?? ""}`)
    .join("|");
  return `${communityId}|${today}|${sig}`;
}

function readCache(key: string): Map<string, Entry[]> | null {
  const slot = rankingCache.get(key);
  if (!slot) return null;
  if (Date.now() - slot.at > RANKING_TTL_MS) {
    rankingCache.delete(key);
    return null;
  }
  return slot.byChallenge;
}

function writeCache(key: string, byChallenge: Map<string, Entry[]>): void {
  // Le cache ne sert qu'à absorber une rafale : quand il déborde, la plus
  // ancienne entrée part, sans stratégie plus fine.
  if (rankingCache.size >= RANKING_CACHE_MAX) {
    const oldest = rankingCache.keys().next().value;
    if (oldest) rankingCache.delete(oldest);
  }
  rankingCache.set(key, { at: Date.now(), byChallenge });
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = serviceClient();
  const today = localDateKey(auth.timezone);
  const view = new URL(req.url).searchParams.get("view");

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

  if (view === "members") return membersView(admin, community, auth.userId);
  return challengesView(admin, community, auth.userId, today);
}

/**
 * Liste des membres, réservée à l'animateur. Sans elle, il pilotait une
 * communauté dont il ne voyait qu'un compteur : « 40 membres » et les seuls
 * pseudos que le classement d'un défi laissait passer.
 */
async function membersView(admin: Admin, community: CommunityRow, userId: string) {
  if (community.owner_id !== userId) {
    return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });
  }

  const [memberRows, blockRows] = await Promise.all([
    fetchAllRows<{ user_id: string; source: string; joined_at: string }>(() =>
      admin
        .from("community_members")
        .select("user_id, source, joined_at")
        .eq("community_id", community.id)
        .order("joined_at", { ascending: false }),
    ),
    fetchAllRows<{ user_id: string; blocked_at: string }>(() =>
      admin
        .from("community_blocks")
        .select("user_id, blocked_at")
        .eq("community_id", community.id)
        .order("blocked_at", { ascending: false }),
    ).catch(() => [] as { user_id: string; blocked_at: string }[]),
  ]);

  const ids = Array.from(new Set([...memberRows.map((m) => m.user_id), ...blockRows.map((b) => b.user_id)]));
  if (ids.length === 0) {
    return NextResponse.json({ members: [], blocked: [] });
  }

  const since = new Date(Date.now() - ACTIVITY_DAYS * DAY_MS).toISOString();
  const [profs, reviews] = await Promise.all([
    fetchAllRows<{ id: string; username: string | null; timezone: string | null; created_at: string }>(() =>
      admin.from("profiles").select("id, username, timezone, created_at").in("id", ids),
    ),
    fetchAllRows<{ user_id: string; created_at: string }>(() =>
      admin.from("session_reviews").select("user_id, created_at").in("user_id", ids).gte("created_at", since),
    ),
  ]);

  const profById = new Map(profs.map((p) => [p.id, p]));
  // Jours DISTINCTS avec séance, dans le fuseau du membre : « 9 jours actifs
  // sur 30 » dit quelque chose, « 34 séances » ne dit rien sur la régularité.
  const activeDays = new Map<string, Set<string>>();
  const lastSeen = new Map<string, string>();
  for (const r of reviews) {
    const tz = profById.get(r.user_id)?.timezone || "UTC";
    const day = localDateKey(tz, new Date(r.created_at));
    const set = activeDays.get(r.user_id) ?? new Set<string>();
    set.add(day);
    activeDays.set(r.user_id, set);
    const prev = lastSeen.get(r.user_id);
    if (!prev || r.created_at > prev) lastSeen.set(r.user_id, r.created_at);
  }

  const nameOf = (id: string): string | null => {
    const raw = profById.get(id)?.username ?? null;
    return isUsernameDisplayable(raw) ? raw : null;
  };

  return NextResponse.json({
    members: memberRows.map((m) => ({
      id: m.user_id,
      name: nameOf(m.user_id),
      joinedAt: m.joined_at,
      source: m.source,
      isOwner: m.user_id === community.owner_id,
      activeDays: activeDays.get(m.user_id)?.size ?? 0,
      lastSeenAt: lastSeen.get(m.user_id) ?? null,
    })),
    blocked: blockRows.map((b) => ({
      id: b.user_id,
      name: nameOf(b.user_id),
      blockedAt: b.blocked_at,
    })),
    activityDays: ACTIVITY_DAYS,
  });
}

const CHALLENGE_COLS = "id, community_id, title, description, metric, target, starts_on, ends_on, created_at";

/**
 * `updated_at` arrive avec 20260803_community_management. Tant que la migration
 * n'est pas passée, le demander ferait échouer TOUTE la requête et la page
 * afficherait « aucun défi » au lieu des défis qui existent : on retombe donc
 * sur les colonnes d'origine, comme consumeQuota le fait pour son RPC.
 */
async function loadChallenges(admin: Admin, communityId: string, since: string): Promise<ChallengeRow[]> {
  const query = (cols: string) =>
    admin
      .from("community_challenges")
      .select(cols)
      .eq("community_id", communityId)
      .gte("ends_on", since)
      .order("starts_on", { ascending: false });

  const { data, error } = await query(`${CHALLENGE_COLS}, updated_at`);
  if (!error) return (data ?? []) as unknown as ChallengeRow[];

  console.error("[community] updated_at unavailable, falling back:", error.message);
  const { data: legacy } = await query(CHALLENGE_COLS);
  return ((legacy ?? []) as unknown as Omit<ChallengeRow, "updated_at">[]).map((c) => ({ ...c, updated_at: null }));
}

async function challengesView(admin: Admin, community: CommunityRow, userId: string, today: string) {
  const isOwner = community.owner_id === userId;

  const [{ count: memberCount }, challengeRows] = await Promise.all([
    admin.from("community_members").select("user_id", { count: "exact", head: true }).eq("community_id", community.id),
    loadChallenges(admin, community.id, shiftDay(today, -ENDED_VISIBLE_DAYS)),
  ]);

  // Métrique inconnue = ligne écrite avant un retrait du catalogue : on l'ignore
  // plutôt que de la mesurer avec la mauvaise règle.
  const challenges = challengeRows.filter((c) => getMetricSpec(c.metric));
  const header = {
    slug: community.slug,
    name: community.name,
    memberCount: memberCount ?? 0,
    isOwner,
    // Le code promo Stripe du partenaire est le majuscule de son slug
    // (lib/founding.ts) : c'est LUI qu'il diffuse, et c'est la seule porte
    // d'entrée. On le renvoie à l'animateur pour qu'il l'ait sous les yeux.
    promoCode: isOwner ? community.slug.toUpperCase() : null,
    // Au-delà du plafond, le classement porte sur les premiers arrivés : mieux
    // vaut le dire à l'animateur que de le lui laisser découvrir.
    rankedCap: (memberCount ?? 0) > MEMBERS_RANKED_CAP ? MEMBERS_RANKED_CAP : null,
  };

  if (challenges.length === 0) {
    return NextResponse.json({ community: header, today, challenges: [] });
  }

  const key = rankingKey(community.id, today, challenges);
  let byChallenge = readCache(key);
  if (!byChallenge) {
    byChallenge = await rankMembers(admin, community, challenges, today);
    writeCache(key, byChallenge);
  }

  // La ligne du demandeur est toujours fraîche, même sur un cache tiède.
  const mine = await rankOne(admin, userId, challenges, today);

  const payload = challenges.map((c) => {
    const others = (byChallenge!.get(c.id) ?? []).filter((e) => e.id !== userId);
    const me = mine.get(c.id);
    const entries = me ? [...others, me] : others;

    // Seuls ceux qui ont commencé apparaissent au classement ; le demandeur voit
    // toujours sa propre ligne dans `myProgress`, même à zéro.
    const active = entries.filter((e) => e.progress > 0);
    const ranks = competitionRanks(active.map((e) => e.rankScore));
    const board = active
      .map((e, i) => ({ ...e, rank: ranks[i] ?? active.length, isMe: e.id === userId }))
      .sort((a, b) => a.rank - b.rank || (a.isMe ? -1 : 0))
      .slice(0, BOARD_SIZE)
      .map((e) => ({ name: e.name, progress: e.progress, rank: e.rank, isMe: e.isMe }));

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      metric: c.metric,
      target: c.target,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      updatedAt: c.updated_at,
      phase: phaseOf(c.starts_on, c.ends_on, today),
      participants: active.length,
      finishers: entries.filter((e) => e.completed).length,
      myProgress: me?.progress ?? 0,
      completed: me?.completed ?? false,
      leaderboard: board,
    };
  });

  return NextResponse.json({ community: header, today, challenges: payload });
}

/** Fenêtre de données à charger pour un lot de défis, marge d'un jour pour les fuseaux. */
function windowStart(challenges: ChallengeRow[], today: string): string {
  let earliest = today;
  for (const c of challenges) {
    // « Progression du score » compare à la période précédente : il faut la charger aussi.
    const prev = previousDayKeys(c.starts_on, c.ends_on);
    const from = prev[0] ?? c.starts_on;
    if (from < earliest) earliest = from;
  }
  return new Date(Date.parse(`${earliest}T00:00:00Z`) - DAY_MS).toISOString();
}

function entriesFor(
  ids: string[],
  challenges: ChallengeRow[],
  tzById: Map<string, string>,
  nameById: Map<string, string | null>,
  tradesByUser: Map<string, TradeRow[]>,
  reviewsByUser: Map<string, ReviewRow[]>,
): Map<string, Entry[]> {
  const statsCache = new Map<string, WeekStats>();
  const out = new Map<string, Entry[]>();

  for (const c of challenges) {
    const spec = getMetricSpec(c.metric)!;
    const days = dayKeysBetween(c.starts_on, c.ends_on);
    const prevDays = previousDayKeys(c.starts_on, c.ends_on);
    // Adaptateur vers les fonctions de score du pool public : mêmes règles de
    // mesure, seuls le libellé et la cible viennent de la base.
    const pseudo = { key: c.id, metric: spec.metric as ChallengeMetric, target: c.target, titleKey: "", descKey: "" };

    out.set(
      c.id,
      ids.map((id) => {
        const cacheKey = `${id}:${c.id}`;
        let s = statsCache.get(cacheKey);
        if (!s) {
          s = statsForPeriod(
            tzById.get(id) || "UTC",
            days,
            prevDays,
            tradesByUser.get(id) ?? [],
            reviewsByUser.get(id) ?? [],
          );
          statsCache.set(cacheKey, s);
        }
        return {
          id,
          name: nameById.get(id) || "Trader",
          progress: challengeProgress(pseudo, s),
          rankScore: challengeRankScore(pseudo, s),
          completed: challengeCompleted(pseudo, s),
        };
      }),
    );
  }
  return out;
}

async function rankMembers(
  admin: Admin,
  community: CommunityRow,
  challenges: ChallengeRow[],
  today: string,
): Promise<Map<string, Entry[]>> {
  const { data: memberRows } = await admin
    .from("community_members")
    .select("user_id")
    .eq("community_id", community.id)
    .order("joined_at", { ascending: true })
    .limit(MEMBERS_RANKED_CAP);
  const ids = Array.from(new Set((memberRows ?? []).map((m) => m.user_id as string)));
  if (ids.length === 0) return new Map();

  const since = windowStart(challenges, today);
  const [profs, trades, reviews] = await Promise.all([
    fetchAllRows<{ id: string; username: string | null; timezone: string | null }>(() =>
      admin.from("profiles").select("id, username, timezone").in("id", ids),
    ),
    fetchAllRows<TradeRow>(() =>
      admin
        .from("trades")
        .select("user_id, emotion, open_time")
        .in("user_id", ids)
        .eq("status", "closed")
        .gte("open_time", since),
    ),
    fetchAllRows<ReviewRow>(() =>
      admin.from("session_reviews").select("user_id, discipline_score, created_at").in("user_id", ids).gte("created_at", since),
    ),
  ]);

  return entriesFor(
    ids,
    challenges,
    new Map(profs.map((p) => [p.id, p.timezone || "UTC"])),
    new Map(profs.map((p) => [p.id, isUsernameDisplayable(p.username) ? p.username : null])),
    groupByUser(trades),
    groupByUser(reviews),
  );
}

/** Le classement du seul demandeur, recalculé à chaque appel (voir le cache). */
async function rankOne(
  admin: Admin,
  userId: string,
  challenges: ChallengeRow[],
  today: string,
): Promise<Map<string, Entry>> {
  const since = windowStart(challenges, today);
  const [{ data: prof }, trades, reviews] = await Promise.all([
    admin.from("profiles").select("id, username, timezone").eq("id", userId).maybeSingle(),
    fetchAllRows<TradeRow>(() =>
      admin
        .from("trades")
        .select("user_id, emotion, open_time")
        .eq("user_id", userId)
        .eq("status", "closed")
        .gte("open_time", since),
    ),
    fetchAllRows<ReviewRow>(() =>
      admin.from("session_reviews").select("user_id, discipline_score, created_at").eq("user_id", userId).gte("created_at", since),
    ),
  ]);

  const username = (prof?.username as string | null) ?? null;
  const byChallenge = entriesFor(
    [userId],
    challenges,
    new Map([[userId, (prof?.timezone as string) || "UTC"]]),
    new Map([[userId, isUsernameDisplayable(username) ? username : null]]),
    groupByUser(trades),
    groupByUser(reviews),
  );

  const out = new Map<string, Entry>();
  byChallenge.forEach((list, challengeId) => {
    if (list[0]) out.set(challengeId, list[0]);
  });
  return out;
}

// ── Actions ──────────────────────────────────────────────────────────────────

interface PostBody {
  action?:
    | "leave"
    | "create_challenge"
    | "update_challenge"
    | "delete_challenge"
    | "add_member"
    | "remove_member"
    | "unblock_member";
  id?: string;
  userId?: string;
  /** Pseudo saisi par l'animateur pour ajouter un membre à la main. */
  username?: string;
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
      case "leave":
        return await leave(admin, auth.userId);
      case "create_challenge":
        return await createChallenge(admin, auth.userId, body, today);
      case "update_challenge":
        return await updateChallenge(admin, auth.userId, body, today);
      case "delete_challenge":
        return await deleteChallenge(admin, auth.userId, body.id);
      case "add_member":
        return await addMember(admin, auth.userId, body.username);
      case "remove_member":
        return await removeMember(admin, auth.userId, body.userId);
      case "unblock_member":
        return await unblockMember(admin, auth.userId, body.userId);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[community] action failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * Ajout manuel d'un membre par l'animateur.
 *
 * Rattraper les abonnés d'AVANT : le code promo n'ouvre la communauté qu'au
 * moment du paiement, donc un fidèle déjà client au lancement de l'espace
 * n'aurait aucun moyen d'y entrer. Plutôt que de rouvrir une porte publique
 * (un code qui circule finit toujours par sortir de l'audience), c'est
 * l'animateur qui ajoute, un par un, en connaissance de cause.
 *
 * On ajoute par PSEUDO, jamais par email : l'email permettrait de tester
 * l'existence d'un compte à partir d'une adresse, le pseudo est déjà public sur
 * le classement. Et l'ajouté peut toujours quitter la communauté.
 */
async function addMember(admin: Admin, userId: string, rawName?: string) {
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  const name = (rawName ?? "").trim().replace(/^@/, "").slice(0, 40);
  if (!name) return NextResponse.json({ error: "cc_err_member_not_found" }, { status: 400 });

  // Insensible à la casse : l'animateur recopie le pseudo tel qu'il l'a lu.
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", name)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "cc_err_member_not_found" }, { status: 404 });

  const targetId = target.id as string;
  if (targetId === userId) return NextResponse.json({ error: "cc_err_already_member" }, { status: 409 });

  // First-touch : on ne débauche pas le membre d'une autre communauté. À lui de
  // quitter la première s'il veut changer.
  const { data: existing } = await admin
    .from("community_members")
    .select("community_id")
    .eq("user_id", targetId)
    .maybeSingle();
  if (existing) {
    const code = existing.community_id === community.id ? "cc_err_already_here" : "cc_err_already_member";
    return NextResponse.json({ error: code }, { status: 409 });
  }

  // Ajouter quelqu'un qu'on avait retiré vaut levée du blocage : c'est un geste
  // délibéré de l'animateur, le refuser sans rien dire serait incompréhensible.
  await admin.from("community_blocks").delete().eq("community_id", community.id).eq("user_id", targetId);

  const { error } = await admin
    .from("community_members")
    .insert({ user_id: targetId, community_id: community.id, source: "added" });
  if (error) {
    console.error("[community] add member failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function leave(admin: Admin, userId: string) {
  // L'animateur qui quitte sa propre communauté ne verrait plus les défis qu'il
  // continue pourtant de pouvoir créer. Le bouton lui est déjà caché côté page ;
  // la règle se tient aussi ici, l'API étant appelable directement.
  const community = await myCommunity(admin, userId);
  if (community && community.owner_id === userId) {
    return NextResponse.json({ error: "cc_err_owner_cannot_leave" }, { status: 400 });
  }
  await admin.from("community_members").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true, community: null });
}

async function ownedCommunity(admin: Admin, userId: string): Promise<CommunityRow | null> {
  return findCommunity(admin, "owner_id", userId, true);
}

function draftFrom(body: PostBody): ChallengeDraft {
  return {
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    metric: String(body.metric ?? ""),
    target: Number(body.target),
    startsOn: String(body.startsOn ?? ""),
    endsOn: String(body.endsOn ?? ""),
  };
}

async function createChallenge(admin: Admin, userId: string, body: PostBody, today: string) {
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  const draft = draftFrom(body);
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

/**
 * Corriger un défi plutôt que le supprimer et le recréer, ce qui effaçait le
 * classement en cours.
 *
 * Ce qui reste modifiable dépend de la phase, parce qu'un classement déjà
 * commencé se fausse vite : une fois le défi lancé, changer la mesure ou la
 * cible réécrirait après coup la règle sous les pieds des participants. Restent
 * alors le texte (une faute de frappe se corrige toujours) et la date de fin,
 * qu'on peut repousser mais pas ramener avant aujourd'hui.
 */
async function updateChallenge(admin: Admin, userId: string, body: PostBody, today: string) {
  if (!body.id) return NextResponse.json({ error: "cc_err_not_found" }, { status: 400 });
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  const { data: existing } = await admin
    .from("community_challenges")
    .select("id, metric, target, starts_on, ends_on")
    .eq("id", body.id)
    .eq("community_id", community.id) // un partenaire ne modifie que chez lui
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "cc_err_not_found" }, { status: 404 });

  const phase = phaseOf(existing.starts_on as string, existing.ends_on as string, today);
  if (phase === "ended") return NextResponse.json({ error: "cc_err_locked_ended" }, { status: 400 });

  const draft = draftFrom(body);
  if (phase === "live") {
    // Les champs figés sont repris de la base plutôt que refusés : le client
    // peut renvoyer le formulaire entier sans avoir à deviner la règle.
    draft.metric = existing.metric as string;
    draft.target = existing.target as number;
    draft.startsOn = existing.starts_on as string;
    if (draft.endsOn < today) return NextResponse.json({ error: "cc_err_shorten" }, { status: 400 });
  }

  // Un défi déjà commencé démarre forcément dans le passé : on valide les
  // bornes depuis SA date de début, sinon la règle anti-rétroactivité de la
  // création rejetterait toute correction de titre.
  const invalid = validateChallengeDraft(draft, phase === "live" ? draft.startsOn : today);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { error } = await admin
    .from("community_challenges")
    .update({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      metric: draft.metric,
      target: draft.target,
      starts_on: draft.startsOn,
      ends_on: draft.endsOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("community_id", community.id);
  if (error) {
    console.error("[community] update challenge failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
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

/**
 * Retrait d'un membre par l'animateur. Le retrait pose aussi un blocage, sinon
 * il ne tiendrait pas jusqu'au prochain paiement de la personne (voir le
 * rattachement dans le webhook Stripe). L'animateur peut le lever.
 */
async function removeMember(admin: Admin, userId: string, targetId?: string) {
  if (!targetId) return NextResponse.json({ error: "cc_err_member_not_found" }, { status: 400 });
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });
  if (targetId === userId) return NextResponse.json({ error: "cc_err_remove_self" }, { status: 400 });

  const { data: member } = await admin
    .from("community_members")
    .select("user_id")
    .eq("user_id", targetId)
    .eq("community_id", community.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "cc_err_member_not_found" }, { status: 404 });

  const { error } = await admin
    .from("community_blocks")
    .upsert({ community_id: community.id, user_id: targetId, blocked_by: userId }, { onConflict: "community_id,user_id" });
  if (error) {
    console.error("[community] block failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  await admin.from("community_members").delete().eq("user_id", targetId).eq("community_id", community.id);
  return NextResponse.json({ ok: true });
}

async function unblockMember(admin: Admin, userId: string, targetId?: string) {
  if (!targetId) return NextResponse.json({ error: "cc_err_member_not_found" }, { status: 400 });
  const community = await ownedCommunity(admin, userId);
  if (!community) return NextResponse.json({ error: "cc_err_not_owner" }, { status: 403 });

  // Lever le blocage ne rattache PAS : la personne redevient éligible, à
  // l'animateur de l'ajouter s'il la veut de nouveau dans sa communauté.
  const { error } = await admin
    .from("community_blocks")
    .delete()
    .eq("community_id", community.id)
    .eq("user_id", targetId);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
