import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

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

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = daysParam === 7 || daysParam === 90 ? daysParam : 30;
  const modeParam = req.nextUrl.searchParams.get("mode") as Mode | null;
  const mode: Mode = modeParam === "sessions" || modeParam === "streak" ? modeParam : "discipline";

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: profiles } = await admin
    .from("profiles").select("id, username").eq("leaderboard_opt_in", true).not("username", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ entries: [], me: null, total: 0, days, mode });
  }

  const ids = profiles.map((p) => p.id);
  const usernameById = new Map(profiles.map((p) => [p.id, p.username as string]));
  const nowMs = Date.now();
  const sinceCur = new Date(nowMs - days * 86400000).toISOString();
  const sincePrev = new Date(nowMs - 2 * days * 86400000).toISOString();

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
      delta: prevRank ? prevRank - rank : null, // >0 = monté, null = nouveau
    };
  });

  const total = ranked.length;
  const meEntry = ranked.find((e) => e.isMe) ?? null;
  const me = meEntry
    ? { ...meEntry, percentile: total > 0 ? Math.max(1, Math.round((meEntry.rank / total) * 100)) : null }
    : null;

  return NextResponse.json({ entries: ranked.slice(0, 50), me, total, days, mode });
}
