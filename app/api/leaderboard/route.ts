import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Classement basé UNIQUEMENT sur la discipline (jamais le P&L), sur une fenêtre
// glissante (30 ou 90 jours), limité aux utilisateurs ayant activé l'opt-in.
export async function GET(req: NextRequest) {
  // 1. Auth : seul un utilisateur connecté voit le classement.
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = daysParam === 90 ? 90 : 30;

  // 2. Lecture cross-users via service role (RLS limite sinon à ses propres lignes).
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username")
    .eq("leaderboard_opt_in", true)
    .not("username", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ entries: [], me: null, total: 0, days });
  }

  const ids = profiles.map((p) => p.id);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: reviews } = await admin
    .from("session_reviews")
    .select("user_id, discipline_score, created_at")
    .in("user_id", ids)
    .gte("created_at", since);

  // 3. Moyenne du score de discipline + nombre de sessions sur 30 jours.
  const agg = new Map<string, { sum: number; count: number }>();
  for (const r of reviews ?? []) {
    if (r.discipline_score == null) continue;
    const a = agg.get(r.user_id) ?? { sum: 0, count: 0 };
    a.sum += r.discipline_score;
    a.count += 1;
    agg.set(r.user_id, a);
  }

  const entries = profiles
    .map((p) => {
      const a = agg.get(p.id);
      if (!a || a.count === 0) return null;
      return {
        username: p.username as string,
        score: Math.round(a.sum / a.count),
        sessions: a.count,
        isMe: p.id === user.id,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    // Tri : score décroissant, puis nb de sessions (régularité) en départage.
    .sort((a, b) => b.score - a.score || b.sessions - a.sessions);

  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const me = ranked.find((e) => e.isMe) ?? null;

  return NextResponse.json({ entries: ranked.slice(0, 50), me, total: ranked.length, days });
}
