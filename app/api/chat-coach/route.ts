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
  language?: string;
}

const LANG_NAMES: Record<string, string> = {
  fr: "français",
  en: "English",
  de: "Deutsch",
  es: "español",
};

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
    const { messages, tradesContext, strategyContext, language = "fr" } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Aucun message." }, { status: 400 });
    }

    const langName = LANG_NAMES[language] ?? "français";

    const systemPrompt = `You are an expert trading coach specializing in trading psychology, ICT/SMC methodology, and trade journal analysis. You have access to the trader's trade data and strategy.

SCOPE — STRICTLY TRADING ONLY:
- You ONLY answer questions related to: trading performance, trade psychology, market analysis, trading strategy, risk management, prop firm challenges, trade patterns, and the trader's personal data.
- If a question is NOT related to trading, markets, or trading psychology, politely decline and redirect: say you are specialized in trading only and cannot help with other topics.
- Never answer questions about cooking, politics, coding, general knowledge, relationships, or anything unrelated to trading.

TRADER STRATEGY:
${strategyContext}

RECENT TRADE DATA:
${tradesContext}

RULES:
- MANDATORY LANGUAGE: You MUST ALWAYS reply in ${langName}. Never use any other language regardless of the language of the data or previous messages.
- Be concise (3-5 sentences max per response)
- Use the data above to personalize your responses
- Analyze data, do not repeat it raw
- If you cannot answer with the available data, say so`;

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
