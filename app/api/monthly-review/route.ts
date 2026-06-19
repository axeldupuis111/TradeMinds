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

  const [{ data: trades }, { data: reviews }] = await Promise.all([
    supabase.from("trades").select("pnl, commission, swap, open_time, pair, direction").eq("user_id", userId).gte("open_time", monthStart),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", userId).gte("created_at", monthStart),
  ]);

  const t = trades ?? [];
  const r = reviews ?? [];
  const totalPnl = t.reduce((s, x) => s + netPnl(x), 0);
  const wins = t.filter((x) => netPnl(x) > 0).length;
  const winRate = t.length ? Math.round((wins / t.length) * 100) : 0;
  const avgScore = r.length ? Math.round(r.reduce((s, x) => s + (x.discipline_score ?? 0), 0) / r.length) : null;
  const tradingDays = new Set(t.map((x) => x.open_time.slice(0, 10))).size;

  const stats = {
    trades: t.length,
    winRate,
    totalPnl: Math.round(totalPnl * 100) / 100,
    sessions: r.length,
    avgDisciplineScore: avgScore,
    tradingDays,
  };

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ stats, summary: null });
  }

  // Résumé IA court, axé discipline (pas un conseil financier).
  const prompt = `Tu es le coach de discipline de TradeDiscipline. Rédige un bilan mensuel court (3-4 phrases max) en ${LANG_NAMES[lang]}, motivant et factuel, centré sur la DISCIPLINE et la régularité, jamais sur des conseils d'investissement. Données du mois en cours :
- Trades: ${stats.trades}
- Jours tradés: ${stats.tradingDays}
- Taux de réussite: ${stats.winRate}%
- Sessions pré-trade complétées: ${stats.sessions}
- Score de discipline moyen: ${stats.avgDisciplineScore ?? "N/A"}/100
Mets en avant 1 force et 1 axe d'amélioration concret sur le process. Réponds uniquement par le texte du bilan.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const summary = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ stats, summary });
  } catch (err) {
    console.error("[Monthly review] AI error:", err);
    return NextResponse.json({ stats, summary: null });
  }
}
