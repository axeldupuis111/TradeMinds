import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { isUsernameDisplayable } from "@/lib/username-moderation";
import { computeAllTimeStats } from "@/lib/leaderboard-extras";
import { getCommunityChallenge } from "@/lib/community-challenges";

export const dynamic = "force-dynamic";

type Mode = "discipline" | "sessions" | "streak";
const MIN_SESSIONS = 3; // éligibilité : au moins 3 sessions sur la période

interface ReviewRow { user_id: string; discipline_score: number | null; created_at: string }

interface UserMetrics { avgScore: number; sessions: number; streak: number }

// Calcule les métriques d'un utilisateur sur un sous-ensemble de reviews.
function computeMetrics(reviews: ReviewRow[]): UserMetrics {
  const scored = reviews.filter((r) => r.discipline_score != null);
  const sessions = scored.length;
  const avgScore = sessions ? Math.round(scored.reduce((s, r) => s + (r.discipline_score as number), 0) / sessions) : 0;

  // Série : plus longue suite de jours calendaires consécutifs avec score moyen >= 70.
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const r of scored) {
    const d = r.created_at.slice(0, 10);
    const a = byDay.get(d) ?? { sum: 0, n: 0 };
    a.sum += r.discipline_score as number; a.n += 1; byDay.set(d, a);
  }
  const days = Array.from(byDay.entries())
    .map(([d, a]) => ({ d, ok: a.sum / a.n >= 70 }))
    .sort((x, y) => x.d.localeCompare(y.d));
  let streak = 0, run = 0; let prev: string | null = null;
  for (const { d, ok } of days) {
    if (!ok) { run = 0; prev = d; continue; }
    const consecutive = prev && (new Date(d).getTime() - new Date(prev).getTime() === 86400000);
    run = consecutive ? run + 1 : 1;
    if (run > streak) streak = run;
    prev = d;
  }
  return { avgScore, sessions, streak };
}

function valueFor(m: UserMetrics, mode: Mode): number {
  return mode === "sessions" ? m.sessions : mode === "streak" ? m.streak : m.avgScore;
}

// Classe une liste {username, metrics} selon le mode ; renvoie un map username->rank.
function rankMap(rows: { username: string; m: UserMetrics }[], mode: Mode): Map<string, number> {
  const sorted = [...rows].sort((a, b) =>
    valueFor(b.m, mode) - valueFor(a.m, mode) || b.m.sessions - a.m.sessions || b.m.avgScore - a.m.avgScore);
  const map = new Map<string, number>();
  sorted.forEach((r, i) => map.set(r.username, i + 1));
  return map;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const daysRaw = req.nextUrl.searchParams.get("days");
  // "season" = mois calendaire en cours (UTC) — le classement devient une
  // saison mensuelle qui repart de zéro le 1er.
  const season = daysRaw === "season";
  const daysParam = Number(daysRaw);
  const days = daysParam === 7 || daysParam === 90 ? daysParam : 30;
  const modeParam = req.nextUrl.searchParams.get("mode") as Mode | null;
  const mode: Mode = modeParam === "sessions" || modeParam === "streak" ? modeParam : "discipline";

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const nowMs = Date.now();
  const now = new Date(nowMs);
  // Saison : fenêtre courante = mois en cours, précédente = mois d'avant
  // (le mouvement de rang compare à la saison passée).
  const sinceCur = season
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    : new Date(nowMs - days * 86400000).toISOString();
  const sincePrev = season
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
    : new Date(nowMs - 2 * days * 86400000).toISOString();

  // ── Métriques personnelles (TOUJOURS calculées, même non opt-in / non classé) ──
  const { data: selfProfile } = await admin
    .from("profiles").select("leaderboard_opt_in, username, timezone").eq("id", user.id).single();
  const { data: selfReviews } = await admin
    .from("session_reviews").select("user_id, discipline_score, created_at").eq("user_id", user.id).gte("created_at", sinceCur);
  const selfM = computeMetrics((selfReviews ?? []) as ReviewRow[]);

  // Stats tous-temps pour le mur de badges (plafonnées : les badges saturent
  // bien avant 2000 sessions).
  const { data: allReviews } = await admin
    .from("session_reviews").select("discipline_score, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(2000);
  const allTime = computeAllTimeStats(allReviews ?? [], selfProfile?.timezone as string | null);

  const { data: profiles } = await admin
    .from("profiles").select("id, username, plan").eq("leaderboard_opt_in", true).not("username", "is", null);

  // Base "self" renvoyée dans tous les cas (alimente la carte stats + badges).
  function buildSelf(rank: number | null, percentile: number | null) {
    return {
      score: selfM.avgScore, sessions: selfM.sessions, streak: selfM.streak,
      optedIn: !!selfProfile?.leaderboard_opt_in, hasUsername: !!selfProfile?.username,
      ranked: rank != null, rank, percentile,
      allTime,
    };
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ entries: [], me: null, total: 0, days: season ? "season" : days, mode, self: buildSelf(null, null), feed: [] });
  }

  const ids = profiles.map((p) => p.id);
  // Un pseudo bloqué par la modération n'est jamais exposé : remplacé par un
  // alias neutre en attendant le traitement admin (onglet Pseudos).
  const usernameById = new Map(profiles.map((p) => [
    p.id,
    isUsernameDisplayable(p.username as string) ? (p.username as string) : `trader_${(p.id as string).slice(0, 4)}`,
  ]));
  // Badge Premium affiché sur le classement (avantage de statut du plan).
  const premiumById = new Map(profiles.map((p) => [p.id, p.plan === "premium"]));

  // Reviews des 2 fenêtres (courante + précédente) pour le calcul du mouvement.
  const { data: reviews } = await admin
    .from("session_reviews").select("user_id, discipline_score, created_at")
    .in("user_id", ids).gte("created_at", sincePrev);

  const curByUser = new Map<string, ReviewRow[]>();
  const prevByUser = new Map<string, ReviewRow[]>();
  for (const r of (reviews ?? []) as ReviewRow[]) {
    const bucket = r.created_at >= sinceCur ? curByUser : prevByUser;
    const arr = bucket.get(r.user_id) ?? []; arr.push(r); bucket.set(r.user_id, arr);
  }

  // Éligibles = au moins MIN_SESSIONS sessions sur la période courante.
  const curRows: { id: string; username: string; m: UserMetrics }[] = [];
  for (const id of ids) {
    const rv = curByUser.get(id) ?? [];
    const m = computeMetrics(rv);
    if (m.sessions >= MIN_SESSIONS) curRows.push({ id, username: usernameById.get(id)!, m });
  }

  // Classement période précédente (pour le mouvement de rang).
  const prevRows = ids
    .map((id) => ({ username: usernameById.get(id)!, m: computeMetrics(prevByUser.get(id) ?? []) }))
    .filter((r) => r.m.sessions >= MIN_SESSIONS);
  const prevRanks = rankMap(prevRows, mode);

  const sorted = [...curRows].sort((a, b) =>
    valueFor(b.m, mode) - valueFor(a.m, mode) || b.m.sessions - a.m.sessions || b.m.avgScore - a.m.avgScore);

  const ranked = sorted.map((r, i) => {
    const rank = i + 1;
    const prevRank = prevRanks.get(r.username);
    return {
      rank,
      username: r.username,
      score: r.m.avgScore,
      sessions: r.m.sessions,
      streak: r.m.streak,
      value: valueFor(r.m, mode),
      isMe: r.id === user.id,
      premium: premiumById.get(r.id) ?? false,
      delta: prevRank ? prevRank - rank : null, // >0 = monté, null = nouveau
    };
  });

  const total = ranked.length;
  const meIdx = ranked.findIndex((e) => e.isMe);
  const meEntry = meIdx >= 0 ? ranked[meIdx] : null;
  const me = meEntry
    ? { ...meEntry, percentile: total > 0 ? Math.max(1, Math.round((meEntry.rank / total) * 100)) : null }
    : null;

  // Voisins de rang (celui juste devant + moi + celui juste derrière) : permet
  // d'afficher « ta position » avec du contexte même hors du top 50 affiché.
  const around = meIdx >= 0 ? ranked.slice(Math.max(0, meIdx - 1), meIdx + 2) : [];

  // ── Fil d'activité : de quoi rendre la page vivante même à peu d'inscrits ──
  type FeedItem =
    | { type: "day_record"; user: string; score: number }
    | { type: "streak"; user: string; days: number }
    | { type: "join"; user: string; challengeKey: string; at: string };
  const feed: FeedItem[] = [];

  // Meilleur score d'hier (jour UTC) parmi les inscrits.
  const yesterdayKey = new Date(nowMs - 86400000).toISOString().slice(0, 10);
  let best: { user: string; score: number } | null = null;
  for (const [id, rv] of Array.from(curByUser.entries())) {
    const dayScores = rv.filter((r) => r.created_at.slice(0, 10) === yesterdayKey && r.discipline_score != null);
    if (dayScores.length === 0) continue;
    const avg = Math.round(dayScores.reduce((s, r) => s + (r.discipline_score as number), 0) / dayScores.length);
    if (!best || avg > best.score) best = { user: usernameById.get(id)!, score: avg };
  }
  if (best) feed.push({ type: "day_record", ...best });

  // Série active la plus longue du moment (hors moi : la mienne est déjà affichée).
  const topStreak = [...curRows].filter((r) => r.id !== user.id && r.m.streak >= 3)
    .sort((a, b) => b.m.streak - a.m.streak)[0];
  if (topStreak) feed.push({ type: "streak", user: topStreak.username, days: topStreak.m.streak });

  // Dernières arrivées dans les défis communautaires (14 jours).
  const { data: joins } = await admin
    .from("challenge_participations").select("user_id, challenge_key, joined_at")
    .gte("joined_at", new Date(nowMs - 14 * 86400000).toISOString())
    .order("joined_at", { ascending: false }).limit(8);
  const joinerIds = Array.from(new Set((joins ?? []).map((j) => j.user_id as string)))
    .filter((id) => !usernameById.has(id));
  const { data: joinerProfs } = joinerIds.length
    ? await admin.from("profiles").select("id, username").in("id", joinerIds)
    : { data: [] as { id: string; username: string | null }[] };
  const joinerNameById = new Map((joinerProfs ?? []).map((p) => [
    p.id,
    isUsernameDisplayable(p.username as string | null) ? (p.username as string) : null,
  ]));
  for (const j of joins ?? []) {
    if (feed.length >= 5) break;
    if (!getCommunityChallenge(j.challenge_key as string)) continue;
    const name = usernameById.get(j.user_id as string) ?? joinerNameById.get(j.user_id as string);
    if (!name) continue; // sans pseudo affichable, l'item n'apporte rien
    feed.push({ type: "join", user: name, challengeKey: j.challenge_key as string, at: j.joined_at as string });
  }

  return NextResponse.json({
    entries: ranked.slice(0, 50), around, me, total, days: season ? "season" : days, mode,
    self: buildSelf(me?.rank ?? null, me?.percentile ?? null),
    feed,
  });
}
