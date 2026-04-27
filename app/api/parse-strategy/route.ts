import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("Neither CLAUDE_API_KEY nor ANTHROPIC_API_KEY is defined in environment.");
      return NextResponse.json(
        { error: "Service d'analyse temporairement indisponible. Contactez le support." },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey });
    const { text, language = "fr" } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Texte de stratégie vide." },
        { status: 400 }
      );
    }

    const LANG_NAMES: Record<string, string> = { fr: "français", en: "English", de: "Deutsch", es: "español" };
    const langName = LANG_NAMES[language] ?? "français";

    const prompt = `Tu es un assistant spécialisé en trading. Le trader décrit sa stratégie en langage naturel. Extrais les règles structurées.

LANGUE OBLIGATOIRE : Les valeurs textuelles du JSON (notamment "setup_rules") doivent être rédigées en ${langName}.
EXCEPTION POUR strategy_tags : Les labels dans strategy_tags doivent être fournis dans les 4 langues (label_fr, label_en, label_de, label_es).

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
  "setup_rules": ["règle 1", "règle 2", ...] (liste des conditions d'entrée et règles de trading extraites du texte),
  "strategy_tags": {
    "setups": [
      { "value": "snake_case_id", "label_fr": "...", "label_en": "...", "label_de": "...", "label_es": "..." }
    ],
    "entry_zones": [...],
    "targets": [...],
    "timing": [...],
    "checklist": [
      { "value": "snake_case_id", "label_fr": "...", "label_en": "...", "label_de": "...", "label_es": "..." }
    ]
  }
}

Pour les sessions, utilise ces correspondances :
- London / Londres / session européenne → "london"
- New York / NY / session américaine → "new_york"
- Asian / Asie / Tokyo / session asiatique → "asian"
- Overlap / chevauchement London-NY → "london_ny_overlap"

Pour les paires, normalise en majuscules (XAUUSD, EURUSD, etc.). "Gold" = XAUUSD, "Nas" / "Nasdaq" = NAS100, "Dow" = US30.

Pour setup_rules, extrait chaque condition d'entrée, règle de gestion, ou contrainte mentionnée comme un élément séparé.

IMPORTANT — Si le trader n'a pas mentionné de max_sl_pips ou de max_consecutive_losses, suggère des valeurs raisonnables selon le contexte :
- Pour du scalping sur XAUUSD/Gold : max_sl_pips entre 50 et 100, max_consecutive_losses entre 2 et 3
- Pour du swing trading Forex : max_sl_pips entre 50 et 150, max_consecutive_losses entre 3 et 5
- Pour des indices (NAS100, US30) : max_sl_pips entre 50 et 200, max_consecutive_losses entre 2 et 4
- Si aucun contexte ne permet de deviner : max_sl_pips = 100, max_consecutive_losses = 3
Ne mets null que si tu ne peux vraiment pas estimer.

INSTRUCTIONS POUR strategy_tags — Extrait les concepts clés pour créer des catégories de tagging personnalisées :

1. "setups" : 5 à 12 types de setups/patterns que le trader utilise selon sa méthodologie.
   - ICT/SMC → Unicorn Model, Judas Swing, Silver Bullet, OTE Entry, FVG Entry, OB Rejection
   - Price Action → Pin Bar, Engulfing, Double Top, Head & Shoulders, Inside Bar
   - Indicateurs → Croisement MA, RSI Divergence, Bollinger Squeeze, MACD Cross

2. "entry_zones" : 4 à 8 zones ou niveaux d'entrée adaptés à la stratégie.
   - ICT → Order Block, Fair Value Gap, Breaker, OTE Zone
   - Price Action → Support, Résistance, Trendline, Zone de retracement
   - Fibonacci → 38.2%, 50%, 61.8%

3. "targets" : 3 à 6 objectifs de sortie cohérents avec la méthodologie.
   - ICT → BSL, SSL, Equal Highs/Lows, Old High/Low
   - Price Action → Prochain support/résistance, Extension Fibonacci
   - Range → Haut de range, Bas de range, Milieu de range

4. "timing" : 3 à 6 fenêtres temporelles optimales selon la stratégie.
   - ICT → Asia (00:00-08:00), London Open (08:00-12:00), NY AM (13:00-16:00), NY PM (16:00-20:00)
   - Forex → Session européenne, Session US, Session asiatique
   - Crypto → Pic de volume US, Pic de volume Asie, Ouverture de marché

5. "checklist" : EXACTEMENT 5 à 8 conditions vérifiables avant chaque trade, adaptées à la méthodologie décrite. Chaque item doit être une condition binaire (oui/non) spécifique à cette stratégie.

Pour chaque item, le "value" doit être un identifiant snake_case unique.
Les labels doivent être traduits fidèlement dans les 4 langues.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
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
