import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Métriques réellement calculables à partir des données utilisateur.
const METRICS = ["discipline_score", "sessions", "win_rate", "trades_per_day", "max_consecutive_losses"] as const;
type Metric = (typeof METRICS)[number];

// Tente de convertir un objectif écrit en libre en objectif MESURABLE. Si l'objectif
// n'est pas calculable depuis nos métriques, renvoie { trackable: false } → l'app le
// garde en objectif à cocher manuellement.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  // L'auto-suivi IA est réservé aux plans payants ; sinon objectif manuel.
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ trackable: false });
  }

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ trackable: false });

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ trackable: false });

  const prompt = `Tu convertis un objectif de trading écrit en langage libre en un objectif MESURABLE, si possible, à partir UNIQUEMENT de ces métriques disponibles :
- discipline_score : note moyenne de respect du plan (0-100), comparateur "gte"
- sessions : nombre de sessions pré-trade complétées, comparateur "gte"
- win_rate : pourcentage de trades gagnants (0-100), comparateur "gte"
- trades_per_day : moyenne de trades par jour, comparateur "lte"
- max_consecutive_losses : plus longue série de pertes d'affilée, comparateur "lte"

Objectif de l'utilisateur : "${text.replace(/"/g, "'")}"

Réponds STRICTEMENT en JSON, sans texte ni markdown :
- Si l'objectif correspond clairement à une de ces métriques : {"trackable": true, "metric": "<une des clés>", "comparator": "gte"|"lte", "target": <nombre>}
- Sinon (ex. "méditer avant la séance", "journaliser chaque trade") : {"trackable": false}
Choisis une cible (target) raisonnable si l'utilisateur n'en donne pas. Utilise le comparateur naturel de la métrique.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ trackable: false });

    const parsed = JSON.parse(match[0]) as { trackable?: boolean; metric?: string; comparator?: string; target?: number };
    if (!parsed.trackable) return NextResponse.json({ trackable: false });

    // Validation stricte de la sortie IA.
    if (!METRICS.includes(parsed.metric as Metric)) return NextResponse.json({ trackable: false });
    const comparator = parsed.comparator === "lte" ? "lte" : "gte";
    const target = Number(parsed.target);
    if (!isFinite(target) || target <= 0) return NextResponse.json({ trackable: false });

    return NextResponse.json({ trackable: true, metric: parsed.metric, comparator, target });
  } catch (err) {
    console.error("[Goals interpret] error:", err);
    return NextResponse.json({ trackable: false });
  }
}
