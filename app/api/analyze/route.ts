import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";


interface AnalyzeRequest {
  strategy: {
    name: string;
    pairs: string[];
    sessions: string[];
    risk_reward: number | null;
    max_sl_pips: number | null;
    max_daily_loss: number | null;
    max_trades_per_day: number | null;
    max_consecutive_losses: number | null;
    setup_rules: string[];
  };
  trades: {
    open_time: string;
    close_time: string;
    pair: string;
    direction: string;
    lot_size: number;
    entry_price: number;
    exit_price: number;
    sl: number | null;
    tp: number | null;
    pnl: number;
    commission: number | null;
    swap: number | null;
  }[];
}

const SESSION_MAP: Record<string, string> = {
  london: "London (08:00–12:00 UTC)",
  new_york: "New York (13:00–17:00 UTC)",
  asian: "Asian (00:00–06:00 UTC)",
  london_ny_overlap: "London-NY Overlap (13:00–16:00 UTC)",
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    console.log("CLAUDE_API_KEY defined:", apiKey ? apiKey.substring(0, 10) + "…" : "MISSING");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API Anthropic non configurée." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const body: AnalyzeRequest = await request.json();
    const { strategy, trades } = body;

    if (!trades || trades.length === 0) {
      return NextResponse.json(
        { error: "Aucun trade à analyser." },
        { status: 400 }
      );
    }

    // Limite à 80 trades les plus récents pour ne pas dépasser les limites
    // de tokens de l'API Claude (les trades sont déjà triés par date croissante
    // côté client, on prend les 80 derniers = les plus récents)
    // TODO: optimiser avec un système d'analyse par période
    const recentTrades = trades.slice(-80);

    const sessionsText = strategy.sessions
      .map((s) => SESSION_MAP[s] || s)
      .join(", ");

    const rulesText = strategy.setup_rules.length > 0
      ? strategy.setup_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "Aucune règle définie";

    const tradesText = recentTrades
      .map((t) => {
        const net = t.pnl + (t.commission || 0) + (t.swap || 0);
        return `${t.open_time} | ${t.pair} | ${t.direction} | lot=${t.lot_size} | entrée=${t.entry_price} | sortie=${t.exit_price} | SL=${t.sl ?? "N/A"} | TP=${t.tp ?? "N/A"} | P&L net=${net.toFixed(2)}`;
      })
      .join("\n");

    const prompt = `Tu es un coach de trading expert en méthodologie ICT/SMC. Tu analyses les trades d'un trader par rapport à ses propres règles.

STRATÉGIE DU TRADER :
- Nom : ${strategy.name || "Non définie"}
- Paires autorisées : ${strategy.pairs.length > 0 ? strategy.pairs.join(", ") : "Toutes"}
- Sessions autorisées : ${sessionsText || "Toutes"}
- Risk/Reward minimum : ${strategy.risk_reward ?? "Non défini"}
- Stop Loss maximum (pips) : ${strategy.max_sl_pips ?? "Non défini"}
- Perte max journalière (%) : ${strategy.max_daily_loss ?? "Non défini"}
- Nombre max de trades/jour : ${strategy.max_trades_per_day ?? "Non défini"}
- Trades perdants consécutifs avant stop : ${strategy.max_consecutive_losses ?? "Non défini"}
- Règles de setup :
${rulesText}

TRADES À ANALYSER (${recentTrades.length} trades les plus récents sur ${trades.length} au total) :
${tradesText}

Analyse chaque trade et produis :

1. SCORE DE DISCIPLINE (0-100) : pourcentage de trades conformes aux règles
2. VIOLATIONS DÉTECTÉES : pour chaque trade non conforme, explique quelle règle a été violée (trade hors session, paire non autorisée, RR insuffisant, trop de trades dans la journée, perte journalière dépassée, etc.)
3. PATTERNS COMPORTEMENTAUX : détecte le revenge trading (trade pris rapidement après une perte), l'overtrading, l'augmentation du lot après des pertes, le trading hors sessions
4. POINTS FORTS : ce que le trader fait bien
5. RECOMMANDATIONS : 3 conseils concrets et spécifiques basés sur les données

Réponds en français. Sois direct et sans complaisance. Utilise les données, pas des généralités.
Formate ta réponse en JSON avec cette structure exacte (pas de texte avant ou après le JSON) :
{
  "discipline_score": number,
  "total_trades": number,
  "conforming_trades": number,
  "violations": [{"trade_date": "string", "pair": "string", "rule_violated": "string", "explanation": "string"}],
  "patterns": [{"type": "string", "description": "string", "severity": "high" | "medium" | "low"}],
  "strengths": ["string"],
  "recommendations": ["string"]
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Réponse inattendue de l'IA." },
        { status: 500 }
      );
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = textBlock.text.trim();
    // Remove ```json ... ``` wrapper if present
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    // Fallback: extract first { ... } block
    if (!jsonStr.startsWith("{")) {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0].trim();
    }

    // Vérifie que le JSON n'est pas tronqué
    if (!jsonStr.startsWith("{") || !jsonStr.endsWith("}")) {
      console.error("Réponse Claude tronquée — début:", jsonStr.substring(0, 100), "— fin:", jsonStr.substring(jsonStr.length - 100));
      return NextResponse.json(
        { error: "Réponse de l'IA tronquée ou mal formatée. Réessayez." },
        { status: 500 }
      );
    }

    console.log("JSON to parse (first 200 chars):", jsonStr.substring(0, 200));
    const analysis = JSON.parse(jsonStr);
    return NextResponse.json(analysis);
  } catch (err: unknown) {
    console.error("Analyze full error:", err);
    if (err instanceof Error) {
      console.error("Analyze error name:", err.name);
      console.error("Analyze error message:", err.message);
      console.error("Analyze error stack:", err.stack);
    }
    // Log Anthropic API specific error fields
    const apiErr = err as Record<string, unknown>;
    if (apiErr?.status) console.error("Analyze API status:", apiErr.status);
    if (apiErr?.error) console.error("Analyze API error body:", JSON.stringify(apiErr.error));

    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
