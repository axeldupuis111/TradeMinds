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

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId, plan } = auth;

  // Réservé aux plans payants (feature IA).
  if (plan !== "plus" && plan !== "premium") {
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const { language } = (await req.json().catch(() => ({}))) as { language?: string };
  const lang = language && LANG_NAMES[language] ? language : "en";

  // On relit les données serveur côté Supabase (auth via cookies dans requireAuth déjà fait).
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  // On récupère mois courant + mois précédent en une fois (depuis le 1er du mois précédent).
  const [{ data: trades }, { data: reviews }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", userId).gte("open_time", prevMonthStart),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", userId).gte("created_at", prevMonthStart),
  ]);

  function computeStats(tradesIn: typeof trades, reviewsIn: typeof reviews, fromIso: string, toIso?: string) {
    const inRange = (d: string) => d >= fromIso && (!toIso || d < toIso);
    const t = (tradesIn ?? []).filter((x) => inRange(x.open_time));
    const r = (reviewsIn ?? []).filter((x) => inRange(x.created_at));
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

  const stats = computeStats(trades, reviews, monthStart);
  const prev = computeStats(trades, reviews, prevMonthStart, monthStart);

  // Deltas mois/mois (null si pas de base le mois précédent).
  const deltas = {
    trades: stats.trades - prev.trades,
    winRate: stats.winRate - prev.winRate,
    sessions: stats.sessions - prev.sessions,
    avgDisciplineScore:
      stats.avgDisciplineScore != null && prev.avgDisciplineScore != null
        ? stats.avgDisciplineScore - prev.avgDisciplineScore
        : null,
    tradingDays: stats.tradingDays - prev.tradingDays,
  };

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ stats, prev, deltas, review: null });
  }

  // Bilan IA STRUCTURÉ (JSON) : titre + force + axe + focus. Centré discipline,
  // jamais conseil d'investissement. Texte simple (pas de markdown).
  const prompt = `Tu es le coach de discipline de TradeDiscipline. Analyse le mois en cours d'un trader et réponds STRICTEMENT en JSON (sans texte autour, sans markdown) avec ces clés, en ${LANG_NAMES[lang]} :
{"headline": "une phrase d'accroche motivante (max 90 caractères)", "strength": "1 force concrète sur le process/la discipline (1-2 phrases)", "improvement": "1 axe d'amélioration concret et actionnable (1-2 phrases)", "focus": "LE focus prioritaire pour le mois prochain (1 phrase, impératif)"}
Centre tout sur la DISCIPLINE et la régularité, jamais sur des conseils d'investissement ou de marché. N'utilise aucun astérisque ni markdown.
Données — mois en cours : trades ${stats.trades}, jours tradés ${stats.tradingDays}, taux de réussite ${stats.winRate}%, sessions pré-trade ${stats.sessions}, score de discipline moyen ${stats.avgDisciplineScore ?? "N/A"}/100.
Mois précédent (pour le contexte d'évolution) : sessions ${prev.sessions}, score moyen ${prev.avgDisciplineScore ?? "N/A"}/100, taux de réussite ${prev.winRate}%.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let review: { headline: string; strength: string; improvement: string; focus: string } | null = null;
    try {
      // Le modèle peut entourer le JSON de texte : on isole le 1er objet { ... }.
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) review = JSON.parse(match[0]);
    } catch {
      review = null;
    }

    return NextResponse.json({ stats, prev, deltas, review, rawSummary: review ? null : raw });
  } catch (err) {
    console.error("[Monthly review] AI error:", err);
    return NextResponse.json({ stats, prev, deltas, review: null });
  }
}
