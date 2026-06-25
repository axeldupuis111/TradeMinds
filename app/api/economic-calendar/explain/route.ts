import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  indicatorId,
  lookupGlossary,
  normalizeIndicator,
  type GlossaryLang,
} from "@/lib/economic-glossary";

export const dynamic = "force-dynamic";

/**
 * Explain a macro indicator that isn't in the curated static glossary.
 *
 * Resolution order (cheapest first):
 *   1. static glossary  → return immediately, no AI, source "glossary"
 *   2. global cache     → economic_indicator_explanations, source "ai"
 *   3. generate once    → Anthropic (Haiku), then upsert into the cache
 *
 * The cache is global and keyed by (indicator id, language): a given indicator
 * is generated ONCE and then served to every user for free. We only ever
 * explain the ROLE of an indicator — never a forecast number. Anti-abuse: we
 * refuse to generate for a title that isn't actually in the calendar.
 *
 * Defensive: missing table / missing API key / parse failure all degrade to
 * { available: false } rather than erroring.
 */

const LANGS: GlossaryLang[] = ["fr", "en", "de", "es"];

interface Explanation {
  whatItIs: string;
  whyItMoves: string;
  beginnerNote: string;
}

const PROMPT_LANG: Record<GlossaryLang, string> = {
  fr: "français",
  en: "English",
  de: "Deutsch",
  es: "español",
};

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    currency?: string;
    lang?: string;
  };
  const title = (body.title || "").trim();
  const currency = (body.currency || "").trim();
  const lang: GlossaryLang = LANGS.includes(body.lang as GlossaryLang)
    ? (body.lang as GlossaryLang)
    : "en";

  const norm = normalizeIndicator(title);
  if (!norm) return NextResponse.json({ available: false });

  // 1. Static glossary — instant, trustworthy, no AI.
  const curated = lookupGlossary(title, lang);
  if (curated) {
    return NextResponse.json({ available: true, source: "glossary", ...curated });
  }

  const key = indicatorId(title) ?? norm;

  let supabase;
  try {
    supabase = serviceClient();
  } catch {
    return NextResponse.json({ available: false });
  }

  // 2. Global cache.
  try {
    const { data: cached } = await supabase
      .from("economic_indicator_explanations")
      .select("what_it_is, why_it_moves, beginner_note")
      .eq("indicator_key", key)
      .eq("lang", lang)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        available: true,
        source: "ai",
        whatItIs: cached.what_it_is,
        whyItMoves: cached.why_it_moves,
        beginnerNote: cached.beginner_note,
      });
    }
  } catch {
    // Table not migrated yet → fall through; generation also writes to it and
    // will simply no-op the cache step.
  }

  // Anti-abuse: only generate for a title that's actually in the calendar.
  try {
    const { data: known } = await supabase
      .from("economic_events")
      .select("id")
      .ilike("title", title)
      .limit(1);
    if (!known || known.length === 0) {
      return NextResponse.json({ available: false });
    }
  } catch {
    return NextResponse.json({ available: false });
  }

  // 3. Generate once with the model.
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ available: false });

  const prompt = `Tu es un pédagogue des marchés financiers. Explique l'indicateur économique suivant pour un trader.

Indicateur : "${title.replace(/"/g, "'")}"${currency ? `\nDevise / pays concerné : ${currency}` : ""}

Réponds en ${PROMPT_LANG[lang]}, STRICTEMENT en JSON sans markdown ni texte autour :
{"whatItIs": "...", "whyItMoves": "...", "beginnerNote": "..."}
- whatItIs : en une phrase, ce que mesure l'indicateur.
- whyItMoves : en une phrase, pourquoi il fait bouger le marché et comment.
- beginnerNote : en une phrase simple, le point à retenir pour un débutant.
N'invente JAMAIS de chiffre, de prévision ou de valeur. Décris seulement le rôle de l'indicateur. Reste concis.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ available: false });

    const parsed = JSON.parse(match[0]) as Partial<Explanation>;
    if (!parsed.whatItIs || !parsed.whyItMoves || !parsed.beginnerNote) {
      return NextResponse.json({ available: false });
    }

    // Cache for everyone. Best-effort: a failed write (e.g. table missing)
    // still returns the freshly-generated explanation to this user.
    try {
      await supabase.from("economic_indicator_explanations").upsert(
        {
          indicator_key: key,
          lang,
          what_it_is: parsed.whatItIs,
          why_it_moves: parsed.whyItMoves,
          beginner_note: parsed.beginnerNote,
          source_title: title,
        },
        { onConflict: "indicator_key,lang" },
      );
    } catch {
      // ignore — explanation is still returned below
    }

    return NextResponse.json({
      available: true,
      source: "ai",
      whatItIs: parsed.whatItIs,
      whyItMoves: parsed.whyItMoves,
      beginnerNote: parsed.beginnerNote,
    });
  } catch (err) {
    console.error("[Economic explain] generation failed:", err);
    return NextResponse.json({ available: false });
  }
}
