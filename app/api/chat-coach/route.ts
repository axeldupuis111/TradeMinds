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

    const systemPrompt = `Tu es un coach de trading spécialisé dans la méthodologie ICT (Inner Circle Trading) et SMC (Smart Money Concepts). Tu maîtrises parfaitement ces concepts :
- Order Blocks (OB), Fair Value Gaps (FVG), Breaker Blocks, Mitigation Blocks
- Liquidité : Buy Side Liquidity (BSL), Sell Side Liquidity (SSL), Equal Highs/Lows, Liquidity Sweeps
- Structure de marché : Market Structure Shift (MSS), Change of Character (ChoCh), Break of Structure (BOS)
- Modèles d'entrée : Unicorn Model, Judas Swing, Turtle Soup, Silver Bullet, OTE (Optimal Trade Entry)
- Killzones : Asia, London Open, New York AM/PM, London Close
- Premium/Discount zones, Equilibrium, Fibonacci OTE (0.618-0.786)

Quand tu analyses les trades de l'utilisateur, utilise TOUJOURS la terminologie ICT/SMC. Par exemple :
- Au lieu de "tu entres trop tôt", dis "tu entres avant la confirmation FVG — attends le retracement dans l'OB H1"
- Au lieu de "ton timing est mauvais", dis "tu trades hors Killzone — tes meilleurs résultats sont pendant le NY AM"
- Au lieu de "tu prends trop de risque", dis "tu entres en zone Premium sur un trade long — attends le retour en Discount ou à l'Equilibrium"

Si les trades de l'utilisateur contiennent des tags ICT (ict_setup, ict_entry_zone, ict_killzone, etc.), utilise-les pour donner des conseils personnalisés et précis.
Si les trades n'ont pas de tags ICT, encourage l'utilisateur à les tagger pour obtenir de meilleurs insights.

RÈGLE ABSOLUE : Tu tutoies TOUJOURS l'utilisateur. N'utilise jamais "vous" ou "votre" — utilise uniquement "tu" et "ton/ta/tes".

You are an expert trading coach specializing in trading psychology, ICT/SMC methodology, and trade journal analysis. You have access to the trader's trade data and strategy.

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
