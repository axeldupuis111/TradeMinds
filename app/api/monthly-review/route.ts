import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAuth, rateLimitAi } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const LANG_NAMES: Record<string, string> = {
  fr: "français", en: "English", de: "Deutsch", es: "español",
};

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

interface TradeRow { pnl: number; commission: number | null; swap: number | null; open_time: string; pair: string; emotion: string | null; direction: string | null }
interface ReviewRow { discipline_score: number | null; created_at: string }

function statsFor(trades: TradeRow[], reviews: ReviewRow[], fromIso: string, toIso: string) {
  const inRange = (d: string) => d >= fromIso && d < toIso;
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

// Parse "YYYY-MM" → {year, month0}. Défaut = mois courant. Borne au mois courant max.
function resolveMonth(param: string | null): { year: number; month0: number } {
  const now = new Date();
  const cur = { year: now.getFullYear(), month0: now.getMonth() };
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return cur;
  const [y, m] = param.split("-").map(Number);
  const month0 = m - 1;
  if (y > cur.year || (y === cur.year && month0 > cur.month0)) return cur; // pas de futur
  return { year: y, month0 };
}

async function gather(userId: string, monthParam: string | null) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const now = new Date();
  const { year, month0 } = resolveMonth(monthParam);
  const selStart = new Date(year, month0, 1);
  const selEnd = new Date(year, month0 + 1, 1);
  const prevStart = new Date(year, month0 - 1, 1);
  const trendStart = new Date(year, month0 - 5, 1); // 6 mois incl. sélectionné
  const isCurrentMonth = year === now.getFullYear() && month0 === now.getMonth();

  const [{ data: tradesRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, open_time, pair, emotion, direction").eq("user_id", userId).gte("open_time", trendStart.toISOString()),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", userId).gte("created_at", trendStart.toISOString()),
  ]);
  const trades = (tradesRaw ?? []) as TradeRow[];
  const reviews = (reviewsRaw ?? []) as ReviewRow[];

  const stats = statsFor(trades, reviews, selStart.toISOString(), selEnd.toISOString());
  const prev = statsFor(trades, reviews, prevStart.toISOString(), selStart.toISOString());

  const deltas = {
    trades: stats.trades - prev.trades,
    winRate: stats.winRate - prev.winRate,
    sessions: stats.sessions - prev.sessions,
    avgDisciplineScore:
      stats.avgDisciplineScore != null && prev.avgDisciplineScore != null
        ? stats.avgDisciplineScore - prev.avgDisciplineScore : null,
    tradingDays: stats.tradingDays - prev.tradingDays,
  };

  // ── Extras + calendrier du mois sélectionné ──────────────────────────────
  const monthTrades = trades.filter((x) => x.open_time >= selStart.toISOString() && x.open_time < selEnd.toISOString());
  const monthReviews = reviews.filter((x) => x.created_at >= selStart.toISOString() && x.created_at < selEnd.toISOString());

  const pnlByDay = new Map<string, number>();
  for (const t of monthTrades) {
    const d = t.open_time.slice(0, 10);
    pnlByDay.set(d, (pnlByDay.get(d) ?? 0) + netPnl(t));
  }
  const scoreByDay = new Map<string, { sum: number; n: number }>();
  for (const r of monthReviews) {
    if (r.discipline_score == null) continue;
    const d = r.created_at.slice(0, 10);
    const a = scoreByDay.get(d) ?? { sum: 0, n: 0 };
    a.sum += r.discipline_score; a.n += 1; scoreByDay.set(d, a);
  }

  // Courbe d'équité + meilleur/pire jour.
  const sortedDays = Array.from(pnlByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let best: { date: string; pnl: number } | null = null;
  let worst: { date: string; pnl: number } | null = null;
  let cumulative = 0; const equity: number[] = [];
  for (const [date, pnl] of sortedDays) {
    if (!best || pnl > best.pnl) best = { date, pnl: Math.round(pnl * 100) / 100 };
    if (!worst || pnl < worst.pnl) worst = { date, pnl: Math.round(pnl * 100) / 100 };
    cumulative += pnl; equity.push(Math.round(cumulative * 100) / 100);
  }

  const pairCount = new Map<string, number>();
  for (const t of monthTrades) pairCount.set(t.pair, (pairCount.get(t.pair) ?? 0) + 1);
  let topPair: { pair: string; count: number } | null = null;
  for (const [pair, count] of Array.from(pairCount.entries())) if (!topPair || count > topPair.count) topPair = { pair, count };

  const prepRate = stats.tradingDays > 0 ? Math.min(100, Math.round((stats.sessions / stats.tradingDays) * 100)) : null;

  // Calendrier : un point par jour avec activité.
  const dayKeys = new Set([...Array.from(pnlByDay.keys()), ...Array.from(scoreByDay.keys())]);
  const calendar = Array.from(dayKeys).map((date) => {
    const sc = scoreByDay.get(date);
    return {
      day: Number(date.slice(8, 10)),
      score: sc ? Math.round(sc.sum / sc.n) : null,
      pnl: Math.round((pnlByDay.get(date) ?? 0) * 100) / 100,
    };
  });

  const extras = { best, worst, topPair, equity, prepRate };

  // ── Edge émotionnel : P&L réel par état émotionnel du trade ───────────────
  const emoMap = new Map<string, { count: number; pnl: number; wins: number }>();
  for (const t of monthTrades) {
    if (!t.emotion) continue;
    const a = emoMap.get(t.emotion) ?? { count: 0, pnl: 0, wins: 0 };
    const n = netPnl(t);
    a.count += 1; a.pnl += n; if (n > 0) a.wins += 1;
    emoMap.set(t.emotion, a);
  }
  const emotions = Array.from(emoMap.entries())
    .map(([emotion, a]) => ({ emotion, count: a.count, pnl: Math.round(a.pnl * 100) / 100, winRate: Math.round((a.wins / a.count) * 100) }))
    .sort((a, b) => b.pnl - a.pnl);

  // ── Performance par jour de la semaine (lundi = 0) ────────────────────────
  const wdAgg = Array.from({ length: 7 }, () => ({ pnl: 0, count: 0, wins: 0 }));
  for (const t of monthTrades) {
    const idx = (new Date(t.open_time).getDay() + 6) % 7; // lundi = 0
    const n = netPnl(t);
    wdAgg[idx].pnl += n; wdAgg[idx].count += 1; if (n > 0) wdAgg[idx].wins += 1;
  }
  const weekdays = wdAgg.map((w, i) => ({ wd: i, pnl: Math.round(w.pnl * 100) / 100, count: w.count, winRate: w.count ? Math.round((w.wins / w.count) * 100) : 0 }));

  // ── Performance par instrument (paire) ────────────────────────────────────
  const pairAgg = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of monthTrades) {
    const a = pairAgg.get(t.pair) ?? { pnl: 0, count: 0, wins: 0 };
    const n = netPnl(t);
    a.pnl += n; a.count += 1; if (n > 0) a.wins += 1;
    pairAgg.set(t.pair, a);
  }
  const pairs = Array.from(pairAgg.entries())
    .map(([pair, a]) => ({ pair, pnl: Math.round(a.pnl * 100) / 100, count: a.count, winRate: a.count ? Math.round((a.wins / a.count) * 100) : 0 }))
    .sort((a, b) => b.pnl - a.pnl);

  // ── Performance achat vs vente (sens du trade) ────────────────────────────
  const dirAgg: Record<"long" | "short", { pnl: number; count: number; wins: number }> = {
    long: { pnl: 0, count: 0, wins: 0 }, short: { pnl: 0, count: 0, wins: 0 },
  };
  for (const t of monthTrades) {
    const d = (t.direction ?? "").toLowerCase();
    const key = /buy|long|achat/.test(d) ? "long" : /sell|short|vente/.test(d) ? "short" : null;
    if (!key) continue;
    const n = netPnl(t);
    dirAgg[key].pnl += n; dirAgg[key].count += 1; if (n > 0) dirAgg[key].wins += 1;
  }
  const directions = (["long", "short"] as const)
    .map((dir) => ({ dir, pnl: Math.round(dirAgg[dir].pnl * 100) / 100, count: dirAgg[dir].count, winRate: dirAgg[dir].count ? Math.round((dirAgg[dir].wins / dirAgg[dir].count) * 100) : 0 }))
    .filter((d) => d.count > 0);

  // ── Stats de trading (qualité d'exécution) ────────────────────────────────
  // Trades du mois triés chronologiquement pour les séries consécutives.
  const chrono = [...monthTrades].sort((a, b) => a.open_time.localeCompare(b.open_time));
  let grossProfit = 0, grossLoss = 0, winCount = 0, lossCount = 0;
  let bestWinStreak = 0, worstLossStreak = 0, winRun = 0, lossRun = 0;
  for (const t of chrono) {
    const n = netPnl(t);
    if (n > 0) {
      grossProfit += n; winCount += 1;
      winRun += 1; lossRun = 0;
      if (winRun > bestWinStreak) bestWinStreak = winRun;
    } else if (n < 0) {
      grossLoss += n; lossCount += 1;
      lossRun += 1; winRun = 0;
      if (lossRun > worstLossStreak) worstLossStreak = lossRun;
    } else { winRun = 0; lossRun = 0; }
  }
  // Drawdown max sur la courbe d'équité quotidienne (pic → creux).
  let peak = 0, maxDrawdown = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    if (peak - v > maxDrawdown) maxDrawdown = peak - v;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const risk = monthTrades.length > 0 ? {
    profitFactor: grossLoss < 0 ? r2(grossProfit / Math.abs(grossLoss)) : null,
    avgWin: winCount ? r2(grossProfit / winCount) : null,
    avgLoss: lossCount ? r2(grossLoss / lossCount) : null,
    payoff: winCount && lossCount ? r2((grossProfit / winCount) / Math.abs(grossLoss / lossCount)) : null,
    expectancy: r2(stats.totalPnl / monthTrades.length),
    maxDrawdown: r2(maxDrawdown),
    bestWinStreak, worstLossStreak,
  } : null;

  // ── Performance par heure de la journée ──────────────────────────────────
  const hourAgg = new Map<number, { pnl: number; count: number; wins: number }>();
  for (const t of monthTrades) {
    const h = new Date(t.open_time).getHours();
    const a = hourAgg.get(h) ?? { pnl: 0, count: 0, wins: 0 };
    const n = netPnl(t);
    a.pnl += n; a.count += 1; if (n > 0) a.wins += 1;
    hourAgg.set(h, a);
  }
  const hours = Array.from(hourAgg.entries())
    .map(([hour, a]) => ({ hour, pnl: r2(a.pnl), count: a.count, winRate: Math.round((a.wins / a.count) * 100) }))
    .sort((a, b) => a.hour - b.hour);

  // ── Records du mois ──────────────────────────────────────────────────────
  const greenDays = Array.from(pnlByDay.values()).filter((v) => v > 0).length;
  const redDays = Array.from(pnlByDay.values()).filter((v) => v < 0).length;
  const scoreList = Array.from(scoreByDay.entries())
    .map(([date, a]) => ({ date, score: Math.round(a.sum / a.n) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let bestDisciplineDay: { date: string; score: number } | null = null;
  let disciplinedStreak = 0, run = 0;
  for (const x of scoreList) {
    if (!bestDisciplineDay || x.score > bestDisciplineDay.score) bestDisciplineDay = x;
    if (x.score >= 70) { run += 1; if (run > disciplinedStreak) disciplinedStreak = run; } else run = 0;
  }
  const records = { greenDays, redDays, bestDisciplineDay, disciplinedStreak };

  // ── Tendance 6 mois (score de discipline + P&L) ──────────────────────────
  const trend: { label: string; score: number | null; pnl: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ms = new Date(year, month0 - i, 1);
    const me = new Date(year, month0 - i + 1, 1);
    const s = statsFor(trades, reviews, ms.toISOString(), me.toISOString());
    trend.push({ label: `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}`, score: s.avgDisciplineScore, pnl: s.totalPnl });
  }

  const month = { key: `${year}-${String(month0 + 1).padStart(2, "0")}`, year, month0, isCurrentMonth };
  return { month, stats, prev, deltas, extras, calendar, trend, records, emotions, weekdays, pairs, directions, risk, hours };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }
  const monthParam = new URL(req.url).searchParams.get("month");
  const data = await gather(auth.userId, monthParam);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const limited = await rateLimitAi(auth.userId, "monthly-review", 20, auth.timezone);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { language?: string; month?: string };
  const lang = body.language && LANG_NAMES[body.language] ? body.language : "en";

  const { month, stats, prev, deltas, extras, calendar, trend } = await gather(auth.userId, body.month ?? null);

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ month, stats, prev, deltas, extras, calendar, trend, review: null });

  const prompt = `Tu es le coach de discipline de TradeDiscipline. Rédige un bilan RÉTROSPECTIF du mois et réponds STRICTEMENT en JSON (sans texte autour, sans markdown), en ${LANG_NAMES[lang]} :
{"headline": "une phrase d'accroche motivante (max 90 caractères)", "strength": "1 force concrète sur le process/la discipline (1-2 phrases)", "improvement": "1 axe d'amélioration concret (1-2 phrases)", "focus": "LE focus prioritaire pour le mois prochain (1 phrase, impératif)"}
Centre tout sur la DISCIPLINE, la régularité et l'évolution dans le temps, jamais sur des conseils d'investissement. N'utilise aucun astérisque ni markdown.
Mois analysé : trades ${stats.trades}, jours tradés ${stats.tradingDays}, taux de réussite ${stats.winRate}%, sessions ${stats.sessions}, score discipline ${stats.avgDisciplineScore ?? "N/A"}/100, préparation ${extras.prepRate ?? "N/A"}%.
Mois précédent : score ${prev.avgDisciplineScore ?? "N/A"}/100, sessions ${prev.sessions}, taux de réussite ${prev.winRate}%.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 600, messages: [{ role: "user", content: prompt }] });
    const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    let review: { headline: string; strength: string; improvement: string; focus: string } | null = null;
    try { const m = raw.match(/\{[\s\S]*\}/); if (m) review = JSON.parse(m[0]); } catch { review = null; }
    return NextResponse.json({ month, stats, prev, deltas, extras, calendar, trend, review, rawSummary: review ? null : raw });
  } catch (err) {
    console.error("[Monthly review] AI error:", err);
    return NextResponse.json({ month, stats, prev, deltas, extras, calendar, trend, review: null });
  }
}
