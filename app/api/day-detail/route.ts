import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface TradeRow { pnl: number; commission: number | null; swap: number | null; open_time: string; pair: string; direction: string | null }
function net(t: TradeRow): number { return t.pnl + (t.commission || 0) + (t.swap || 0); }

// Détail d'une journée de trading — alimente le tiroir du Bilan mensuel quand on
// clique un jour du calendrier. Réservé aux plans payants (comme le bilan).
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // Fenêtre UTC [jour, jour+1) — cohérent avec le découpage du calendrier (slice 0,10).
  const start = `${date}T00:00:00.000Z`;
  const nextDay = new Date(start);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const end = nextDay.toISOString();

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const [{ data: tradesRaw }, { data: reviewsRaw }, { data: sessionsRaw }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, open_time, pair, direction")
      .eq("user_id", auth.userId).gte("open_time", start).lt("open_time", end).order("open_time", { ascending: true }),
    supabase.from("session_reviews").select("discipline_score, created_at")
      .eq("user_id", auth.userId).gte("created_at", start).lt("created_at", end),
    supabase.from("sessions").select("emotion_before, checklist_completed, created_at")
      .eq("user_id", auth.userId).gte("created_at", start).lt("created_at", end).order("created_at", { ascending: true }),
  ]);

  const trades = (tradesRaw ?? []) as TradeRow[];
  const reviews = (reviewsRaw ?? []) as { discipline_score: number | null; created_at: string }[];
  const sessions = (sessionsRaw ?? []) as { emotion_before: string | null; checklist_completed: boolean | null; created_at: string }[];

  const pnl = Math.round(trades.reduce((s, x) => s + net(x), 0) * 100) / 100;
  const wins = trades.filter((x) => net(x) > 0).length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const scores = reviews.map((r) => r.discipline_score).filter((s): s is number => s != null);
  const disciplineScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return NextResponse.json({
    date,
    pnl,
    trades: trades.length,
    winRate,
    disciplineScore,
    tradeList: trades.map((x) => ({ pair: x.pair, direction: x.direction, pnl: Math.round(net(x) * 100) / 100, time: x.open_time })),
    sessions: sessions.map((s) => ({ emotion: s.emotion_before, checklistCompleted: s.checklist_completed, time: s.created_at })),
  });
}
