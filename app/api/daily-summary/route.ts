import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

interface SummaryTrade {
  open_time: string;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

interface SummaryRequest {
  trades: SummaryTrade[];
  strategyName: string | null;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service IA indisponible." }, { status: 503 });
    }

    const LANG_NAMES: Record<string, string> = { fr: "français", en: "English", de: "Deutsch", es: "español" };
    const client = new Anthropic({ apiKey });
    const body: SummaryRequest & { language?: string } = await request.json();
    const { trades, strategyName, language = "fr" } = body;
    const langName = LANG_NAMES[language] ?? "français";

    if (!trades || trades.length === 0) {
      return NextResponse.json({ error: "Aucun trade." }, { status: 400 });
    }

    const tradesText = trades.map((t) => {
      const net = t.pnl + (t.commission || 0) + (t.swap || 0);
      return `${t.open_time} | ${t.pair} | ${t.direction} | P&L net: ${net.toFixed(2)}`;
    }).join("\n");

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl + (t.commission || 0) + (t.swap || 0), 0);
    const wins = trades.filter((t) => t.pnl + (t.commission || 0) + (t.swap || 0) > 0).length;

    const prompt = `Tu es un coach de trading. Génère un résumé court (3-4 phrases max) de cette session de trading. Sois direct, encourageant si la session est positive, constructif sinon. Mentionne les chiffres clés.

LANGUE OBLIGATOIRE : Réponds TOUJOURS en ${langName}. Ne réponds JAMAIS dans une autre langue.

Stratégie : ${strategyName || "Non définie"}
Nombre de trades : ${trades.length}
Gagnants : ${wins}/${trades.length}
P&L total : ${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}€

Détail :
${tradesText}

Réponds UNIQUEMENT avec le résumé, sans titre ni formatage.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Réponse vide." }, { status: 500 });
    }

    return NextResponse.json({ summary: textBlock.text.trim() });
  } catch (err: unknown) {
    console.error("Daily summary error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
