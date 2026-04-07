import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API Anthropic non configurée." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Texte de stratégie vide." },
        { status: 400 }
      );
    }

    const prompt = `Tu es un assistant spécialisé en trading. Le trader décrit sa stratégie en langage naturel. Extrais les règles structurées.

TEXTE DU TRADER :
"""
${text}
"""

Extrais toutes les informations suivantes. Si une information n'est pas mentionnée, mets null.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
{
  "pairs": ["XAUUSD", "EURUSD", ...] ou [],
  "sessions": ["london", "new_york", "asian", "london_ny_overlap"] (uniquement les IDs correspondants),
  "risk_reward": number ou null,
  "max_sl_pips": number ou null,
  "max_daily_loss": number ou null (en % du capital),
  "max_trades_per_day": number ou null,
  "max_consecutive_losses": number ou null,
  "setup_rules": ["règle 1", "règle 2", ...] (liste des conditions d'entrée et règles de trading extraites du texte)
}

Pour les sessions, utilise ces correspondances :
- London / Londres / session européenne → "london"
- New York / NY / session américaine → "new_york"
- Asian / Asie / Tokyo / session asiatique → "asian"
- Overlap / chevauchement London-NY → "london_ny_overlap"

Pour les paires, normalise en majuscules (XAUUSD, EURUSD, etc.). "Gold" = XAUUSD, "Nas" / "Nasdaq" = NAS100, "Dow" = US30.

Pour setup_rules, extrait chaque condition d'entrée, règle de gestion, ou contrainte mentionnée comme un élément séparé.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Réponse inattendue de l'IA." },
        { status: 500 }
      );
    }

    let jsonStr = textBlock.text.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    if (!jsonStr.startsWith("{")) {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0].trim();
    }

    if (!jsonStr.startsWith("{") || !jsonStr.endsWith("}")) {
      console.error("Parse strategy: réponse tronquée");
      return NextResponse.json(
        { error: "Réponse de l'IA mal formatée. Réessayez." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Parse strategy error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
