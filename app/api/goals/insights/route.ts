import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDisciplineStreaks } from "@/lib/discipline-streak";

export const dynamic = "force-dynamic";

// Émotions clairement impulsives vs clairement posées. Les autres (hésitant,
// anxieux, sans tag) restent dans un milieu neutre exclu du contraste pour que
// la comparaison "discipline vs impulsivité" reste nette et défendable.
const IMPULSIVE = new Set(["revenge", "fomo", "greedy", "cupide", "frustrated", "overconfident"]);
const COMPOSED = new Set(["calm", "confident", "neutral"]);

interface TradeRow { pnl: number; commission: number | null; swap: number | null; emotion: string | null; open_time: string | null }
interface ReviewRow { discipline_score: number | null; created_at: string }

function netPnl(t: TradeRow): number { return t.pnl + (t.commission || 0) + (t.swap || 0); }
function monthStartISO(offset = 0): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, 1).toISOString();
}

interface EdgeSide { count: number; winRate: number; avgNet: number }
function aggregate(trades: TradeRow[]): EdgeSide {
  const count = trades.length;
  if (count === 0) return { count: 0, winRate: 0, avgNet: 0 };
  const wins = trades.filter((t) => netPnl(t) > 0).length;
  const total = trades.reduce((s, t) => s + netPnl(t), 0);
  return { count, winRate: Math.round((wins / count) * 100), avgNet: total / count };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: tradesRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, emotion, open_time").eq("user_id", user.id).order("open_time", { ascending: true }),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400),
  ]);
  const trades = (tradesRaw ?? []) as TradeRow[];
  const reviews = ((reviewsRaw ?? []) as ReviewRow[]).filter((r) => r.discipline_score != null);

  // ── Série de discipline (jour émotionnel = revenge/FOMO), cohérente avec le dashboard.
  const dayEmotional = new Map<string, boolean>();
  for (const t of trades) {
    if (!t.open_time) continue;
    const day = t.open_time.split("T")[0];
    const bad = t.emotion === "revenge" || t.emotion === "fomo";
    dayEmotional.set(day, (dayEmotional.get(day) ?? false) || bad);
  }
  const streak = computeDisciplineStreaks(Array.from(dayEmotional.entries()).map(([day, emotional]) => ({ day, emotional })));

  // ── Edge de discipline : trades posés vs impulsifs (win rate + résultat moyen).
  const composed = aggregate(trades.filter((t) => t.emotion != null && COMPOSED.has(t.emotion)));
  const impulsive = aggregate(trades.filter((t) => t.emotion != null && IMPULSIVE.has(t.emotion)));
  const edge = composed.count >= 3 && impulsive.count >= 2 ? { composed, impulsive } : null;

  // ── Tableau de bord du mois : métriques clés mois en cours vs mois précédent.
  const thisM = monthStartISO(0);
  const lastM = monthStartISO(-1);
  function metricsFor(startISO: string, endISO: string | null) {
    const rv = reviews.filter((r) => r.created_at >= startISO && (endISO == null || r.created_at < endISO));
    const tr = trades.filter((t) => t.open_time != null && t.open_time >= startISO && (endISO == null || t.open_time < endISO));
    const discipline = rv.length ? Math.round(rv.reduce((s, r) => s + (r.discipline_score as number), 0) / rv.length) : null;
    const winRate = tr.length ? Math.round((tr.filter((t) => netPnl(t) > 0).length / tr.length) * 100) : null;
    const days = new Set(tr.map((t) => (t.open_time as string).slice(0, 10)));
    const perDay = days.size ? Math.round((tr.length / days.size) * 10) / 10 : null;
    let max = 0, run = 0;
    for (const t of tr) { if (netPnl(t) < 0) { run += 1; if (run > max) max = run; } else run = 0; }
    return { discipline, sessions: rv.length, winRate, perDay, maxLosses: tr.length ? max : null };
  }
  const cur = metricsFor(thisM, null);
  const prev = metricsFor(lastM, thisM);
  const scorecard = [
    { metric: "discipline_score", value: cur.discipline, prev: prev.discipline, betterWhen: "gte" },
    { metric: "sessions", value: cur.sessions || null, prev: prev.sessions || null, betterWhen: "gte" },
    { metric: "win_rate", value: cur.winRate, prev: prev.winRate, betterWhen: "gte" },
    { metric: "trades_per_day", value: cur.perDay, prev: prev.perDay, betterWhen: "lte" },
    { metric: "max_consecutive_losses", value: cur.maxLosses, prev: prev.maxLosses, betterWhen: "lte" },
  ];

  // ── Mini-tendance : scores de discipline des 14 dernières sessions (chrono).
  const trend = reviews
    .slice(0, 14)
    .map((r) => r.discipline_score as number)
    .reverse();

  return NextResponse.json({
    streak,
    edge,
    scorecard,
    trend,
    hasTrades: trades.length > 0,
    hasReviews: reviews.length > 0,
  });
}
