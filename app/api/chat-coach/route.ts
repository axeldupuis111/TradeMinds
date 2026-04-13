import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  tradesContext: string;
  strategyContext: string;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service IA temporairement indisponible." },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey });
    const body: ChatRequest = await request.json();
    const { messages, tradesContext, strategyContext } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Aucun message." }, { status: 400 });
    }

    const systemPrompt = `Tu es un coach de trading expert, spécialisé en psychologie du trading et méthodologie ICT/SMC. Tu as accès aux données de trading et à la stratégie du trader. Réponds de manière concise, directe et basée sur les données. Utilise des chiffres précis quand possible.

Sois encourageant mais honnête. Si le trader fait des erreurs récurrentes, dis-le clairement. Propose des actions concrètes.

STRATÉGIE DU TRADER :
${strategyContext}

DONNÉES DE TRADING (derniers trades) :
${tradesContext}

Règles :
- Réponds en français par défaut, sauf si le trader écrit dans une autre langue
- Sois concis (3-5 phrases max par réponse)
- Utilise les données ci-dessus pour personnaliser tes réponses
- Ne répète pas les données brutes, analyse-les
- Si tu ne peux pas répondre avec les données disponibles, dis-le`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Réponse vide de l'IA." }, { status: 500 });
    }

    return NextResponse.json({ reply: textBlock.text });
  } catch (err: unknown) {
    console.error("Chat coach error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
