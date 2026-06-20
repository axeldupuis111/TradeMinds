import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const LANG_NAMES: Record<string, string> = {
  fr: "français", en: "English", de: "Deutsch", es: "español",
};

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

interface TradeRow { pnl: number; commission: number | null; swap: number | null; open_time: string; pair: string }
interface ReviewRow { discipline_score: number | null; created_at: string }

function statsFor(trades: TradeRow[], reviews: ReviewRow[], fromIso: string, toIso?: string) {
  const inRange = (d: string) => d >= fromIso && (!toIso || d < toIso);
  const t = trades.filter((x) => inRange(x.open_time));
  const r = reviews.filter((x) => inRange(x.created_at));
  const totalPnl = t.reduce((s, x) => s + netPnl(x), 0);
  const wins = t.filter((x) => netPnl(x) > 0).length;
  return {
    trades: t.length,
    winRate: t.length ? Math.round((wins / t.length) * 100) : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    sessions: r.length,
    avgDisciplineScore: r.length ? Math.round(r.reduce((s, x) => s + (x.discipline_score ?? 0), 0) / r.length) : null,
    tradingDays: new Set(t.map((x) => x.open_time.slice(0, 10))).size,
  };
}

async function gather(userId: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [{ data: tradesRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, open_time, pair").eq("user_id", userId).gte("open_time", prevMonthStart),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", userId).gte("created_at", prevMonthStart),
  ]);

  const trades = (tradesRaw ?? []) as TradeRow[];
  const reviews = (reviewsRaw ?? []) as ReviewRow[];

  const stats = statsFor(trades, reviews, monthStart);
  const prev = statsFor(trades, reviews, prevMonthStart, monthStart);

  const deltas = {
    trades: stats.trades - prev.trades,
    winRate: stats.winRate - prev.winRate,
    sessions: stats.sessions - prev.sessions,
    avgDisciplineScore:
      stats.avgDisciplineScore != null && prev.avgDisciplineScore != null
        ? stats.avgDisciplineScore - prev.avgDisciplineScore : null,
    tradingDays: stats.tradingDays - prev.tradingDays,
  };

  // ── Extras (mois en cours) ───────────────────────────────────────────────
  const monthTrades = trades.filter((x) => x.open_time >= monthStart);

  // P&L net par jour + meilleur/pire jour + courbe d'équité cumulée.
  const byDay = new Map<string, number>();
  for (const t of monthTrades) {
    const day = t.open_time.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + netPnl(t));
  }
  const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let best: { date: string; pnl: number } | null = null;
  let worst: { date: string; pnl: number } | null = null;
  let cumulative = 0;
  const equity: number[] = [];
  for (const [date, pnl] of days) {
    if (!best || pnl > best.pnl) best = { date, pnl: Math.round(pnl * 100) / 100 };
    if (!worst || pnl < worst.pnl) worst = { date, pnl: Math.round(pnl * 100) / 100 };
    cumulative += pnl;
    equity.push(Math.round(cumulative * 100) / 100);
  }

  // Paire la plus tradée.
  const pairCount = new Map<string, number>();
  for (const t of monthTrades) pairCount.set(t.pair, (pairCount.get(t.pair) ?? 0) + 1);
  let topPair: { pair: string; count: number } | null = null;
  for (const [pair, count] of Array.from(pairCount.entries())) {
    if (!topPair || count > topPair.count) topPair = { pair, count };
  }

  // Taux de préparation : sessions / jours tradés (capé à 100%).
  const prepRate = stats.tradingDays > 0 ? Math.min(100, Math.round((stats.sessions / stats.tradingDays) * 100)) : null;

  const extras = { best, worst, topPair, equity, prepRate };
  return { stats, prev, deltas, extras };
}

// Stats du mois (sans IA) — chargé à l'arrivée sur la page.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }
  const data = await gather(auth.userId);
  return NextResponse.json(data);
}

// Bilan IA structuré (force / axe / focus) — à la demande.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const { language } = (await req.json().catch(() => ({}))) as { language?: string };
  const lang = language && LANG_NAMES[language] ? language : "en";

  const { stats, prev, deltas, extras } = await gather(auth.userId);

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ stats, prev, deltas, extras, review: null });

  const prompt = `Tu es le coach de discipline de TradeDiscipline. Analyse le mois en cours d'un trader et réponds STRICTEMENT en JSON (sans texte autour, sans markdown) avec ces clés, en ${LANG_NAMES[lang]} :
{"headline": "une phrase d'accroche motivante (max 90 caractères)", "strength": "1 force concrète sur le process/la discipline (1-2 phrases)", "improvement": "1 axe d'amélioration concret et actionnable (1-2 phrases)", "focus": "LE focus prioritaire pour le mois prochain (1 phrase, impératif)"}
Centre tout sur la DISCIPLINE et la régularité, jamais sur des conseils d'investissement ou de marché. N'utilise aucun astérisque ni markdown.
Données — mois en cours : trades ${stats.trades}, jours tradés ${stats.tradingDays}, taux de réussite ${stats.winRate}%, sessions pré-trade ${stats.sessions}, score de discipline moyen ${stats.avgDisciplineScore ?? "N/A"}/100, taux de préparation ${extras.prepRate ?? "N/A"}%.
Mois précédent : sessions ${prev.sessions}, score moyen ${prev.avgDisciplineScore ?? "N/A"}/100, taux de réussite ${prev.winRate}%.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text).join("\n").trim();

    let review: { headline: string; strength: string; improvement: string; focus: string } | null = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) review = JSON.parse(match[0]);
    } catch { review = null; }

    return NextResponse.json({ stats, prev, deltas, extras, review, rawSummary: review ? null : raw });
  } catch (err) {
    console.error("[Monthly review] AI error:", err);
    return NextResponse.json({ stats, prev, deltas, extras, review: null });
  }
}
