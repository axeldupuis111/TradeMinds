import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, rateLimitAi } from "@/lib/api-auth";

/**
 * "Plan for the week" — a forward-looking AI coach card. Complements the
 * retrospective WeeklyRecap: from the last 14 days of trades + session reviews
 * it produces 3 concrete, discipline-focused goals for the coming week.
 *
 * Premium/Plus only (returns { locked: true } for free, so the UI upsells).
 * Rate-limited (10/day) like the other secondary AI routes. Discipline only —
 * never investment advice.
 */

export const dynamic = "force-dynamic";

const LANG_NAMES: Record<string, string> = { fr: "français", en: "English", de: "Deutsch", es: "español" };

interface TradeRow { pnl: number; commission: number | null; swap: number | null; emotion: string | null; open_time: string | null; pair: string | null }
interface ReviewRow { discipline_score: number | null; created_at: string }

function net(t: TradeRow): number { return t.pnl + (t.commission || 0) + (t.swap || 0); }

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ locked: true });
  }
  const limited = await rateLimitAi(auth.userId, "weekly-plan", 10, auth.timezone);
  if (limited) return limited;

  const lang = await req.json().then((b) => (b?.language && LANG_NAMES[b.language] ? b.language : "en")).catch(() => "en");

  const supabase = createClient();
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: trades }, { data: reviews }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, emotion, open_time, pair").eq("user_id", auth.userId).eq("status", "closed").gte("open_time", since),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", auth.userId).gte("created_at", since),
  ]);

  const tr = (trades ?? []) as TradeRow[];
  const rv = (reviews ?? []) as ReviewRow[];

  // Not enough signal to plan → tell the UI to show the empty state.
  if (tr.length < 3 && rv.length < 2) {
    return NextResponse.json({ plan: null, reason: "not_enough_data" });
  }

  const nets = tr.map(net);
  const wins = nets.filter((n) => n > 0).length;
  const winRate = tr.length ? Math.round((wins / tr.length) * 100) : 0;
  const scores = rv.map((r) => r.discipline_score).filter((s): s is number => s != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Emotion that most often precedes losses.
  const lossByEmotion = new Map<string, number>();
  for (const t of tr) if (net(t) < 0 && t.emotion) lossByEmotion.set(t.emotion, (lossByEmotion.get(t.emotion) ?? 0) + 1);
  const topLossEmotion = Array.from(lossByEmotion.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Worst pair by net P&L.
  const netByPair = new Map<string, number>();
  for (const t of tr) if (t.pair) netByPair.set(t.pair, (netByPair.get(t.pair) ?? 0) + net(t));
  const worstPair = Array.from(netByPair.entries()).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ plan: null, reason: "no_api_key" });

  const prompt = `Tu es le coach de discipline de TradeDiscipline. À partir des 14 derniers jours, rédige un PLAN pour la SEMAINE À VENIR : 3 objectifs CONCRETS, actionnables, centrés sur la DISCIPLINE et le process (jamais de conseil d'investissement, jamais "achète/vends").

Données (14 jours) : ${tr.length} trades, taux de réussite ${winRate}%, score discipline moyen ${avgScore ?? "N/A"}/100, ${rv.length} sessions journalisées.${topLossEmotion ? ` Émotion la plus liée aux pertes : ${topLossEmotion}.` : ""}${worstPair ? ` Instrument le plus déficitaire : ${worstPair}.` : ""}

Réponds STRICTEMENT en JSON (sans markdown, sans texte autour), en ${LANG_NAMES[lang]} :
{"headline": "une phrase d'accroche motivante (max 80 caractères)", "focuses": ["objectif 1 (impératif, concret, max 90 car.)", "objectif 2", "objectif 3"]}
Base les objectifs sur les données ci-dessus quand c'est pertinent (ex. réduire les trades sur l'émotion la plus coûteuse, ou éviter l'instrument le plus déficitaire). N'utilise aucun astérisque.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: prompt }] });
    const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ plan: null, reason: "parse_failed" });
    const parsed = JSON.parse(match[0]) as { headline?: string; focuses?: unknown };
    const focuses = Array.isArray(parsed.focuses) ? parsed.focuses.filter((f): f is string => typeof f === "string").slice(0, 3) : [];
    if (!parsed.headline || focuses.length === 0) return NextResponse.json({ plan: null, reason: "parse_failed" });
    return NextResponse.json({ plan: { headline: String(parsed.headline), focuses } });
  } catch (err) {
    console.error("[weekly-plan] generation failed:", err);
    return NextResponse.json({ plan: null, reason: "error" });
  }
}
