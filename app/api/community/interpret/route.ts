import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth, rateLimitAi } from "@/lib/api-auth";
import { isLowCreditError, alertLowCreditsOnce } from "@/lib/ai-credit-alert";
import {
  COMMUNITY_METRICS,
  DESC_MAX,
  MAX_CHALLENGE_DAYS,
  TITLE_MAX,
  containsGainPromise,
  getMetricSpec,
  validateChallengeDraft,
  type ChallengeDraft,
} from "@/lib/community";
import { localDateKey } from "@/lib/timezone";

/**
 * « Décris ton défi » : le partenaire écrit une phrase, l'IA la transforme en
 * défi complet (titre, mesure, cible, dates), qu'il relit avant publication.
 *
 * Même principe que /api/goals/interpret côté trader, avec une contrainte de
 * plus : ici le texte produit sera lu par les MEMBRES du partenaire, donc il
 * passe exactement les mêmes barrières que la saisie manuelle. L'IA choisit
 * seulement dans le catalogue de métriques que le serveur sait recalculer, et
 * sa sortie repasse par validateChallengeDraft : un modèle qui invente une
 * métrique ou glisse une promesse de gain ne peut rien écrire en base.
 *
 * La route ne crée RIEN : elle renvoie un brouillon. Publier reste un geste
 * explicite de l'animateur, qui engage sa responsabilité vis-à-vis de sa
 * communauté et de la loi influenceurs.
 */

export const dynamic = "force-dynamic";

/** Généreux : le partenaire a le droit de tâtonner, la limite vise le script. */
const DAILY_LIMIT = 30;
const INPUT_MAX = 400;

/**
 * Description des métriques POUR LE MODÈLE. Volontairement séparée des libellés
 * i18n : ceux-ci sont de la copie d'interface, traduite en quatre langues et
 * retouchée pour le style, alors qu'ici on décrit la règle de calcul exacte,
 * en une langue, avec les pièges qui aident le modèle à choisir.
 */
const METRIC_BRIEF: Record<string, string> = {
  clean_days: "jours de trading sans aucun trade marqué revenge/FOMO/cupidité/excès de confiance. Le défi anti-impulsivité par défaut.",
  journal_days: "jours différents où le membre a noté au moins une séance. Pour un défi de régularité du journal.",
  sessions: "nombre total de séances préparées et notées sur la période (plusieurs le même jour comptent).",
  clean_run: "plus longue SUITE de jours de trading consécutifs sans trade impulsif. Pour un défi de série ininterrompue.",
  calm_days: "jours de trading avec 5 trades maximum. Pour un défi anti-surtrading.",
  gold_days: "jours dont le score de discipline moyen atteint 85 sur 100.",
  gold_avg: "moyenne du score de discipline sur toute la période (3 séances minimum pour être classé).",
  early_bird: "séances préparées avant 9 h, heure locale du membre. Pour un défi de routine matinale.",
  weekend_days: "samedis et dimanches avec une séance d'analyse, marchés fermés. Pour un défi de préparation.",
  score_climb: "points de discipline gagnés face à la période précédente de même durée. Pour un défi de progression, équitable entre débutants et confirmés.",
};

interface AiDraft {
  title?: unknown;
  description?: unknown;
  metric?: unknown;
  target?: unknown;
  startsOn?: unknown;
  endsOn?: unknown;
}

const DAY_MS = 86_400_000;

function shiftDay(key: string, delta: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function buildPrompt(text: string, today: string): string {
  const catalog = COMMUNITY_METRICS.map(
    (m) => `- ${m.metric} : ${METRIC_BRIEF[m.metric]} Cible entre ${m.min} et ${m.max} (unité : ${m.unit}).`,
  ).join("\n");

  return `Tu aides un coach en trading à transformer une intention écrite en langage libre en un DÉFI DE DISCIPLINE proposé à sa communauté.

Date du jour (fuseau du coach) : ${today}

Métriques disponibles, les seules que la plateforme sait recalculer :
${catalog}

RÈGLES ABSOLUES :
1. Un défi ne porte JAMAIS sur l'argent, la performance, les gains, un pourcentage de rendement, des pips ou un montant. C'est interdit par la loi française sur les influenceurs. Si l'intention du coach porte sur le gain, réponds {"ok": false, "reason": "gain"}.
2. La métrique est OBLIGATOIREMENT une clé de la liste ci-dessus. Si aucune ne correspond à l'intention, réponds {"ok": false, "reason": "no_metric"}.
3. Le titre et la description ne doivent contenir ni pourcentage signé, ni symbole monétaire, ni les mots gain, profit, rendement, pips, ROI, doubler.
4. Durée maximale ${MAX_CHALLENGE_DAYS} jours. Le début ne peut pas précéder ${shiftDay(today, -7)} ni dépasser ${shiftDay(today, 90)}.
5. Écris le titre et la description DANS LA LANGUE du coach (celle de son texte ci-dessous).

Intention du coach : "${text.replace(/"/g, "'")}"

Réponds STRICTEMENT en JSON, sans texte ni markdown autour :
{"ok": true, "title": "<titre motivant, ${TITLE_MAX} caractères maximum, sans guillemets>", "description": "<une phrase qui dit ce qu'il faut faire concrètement, ${DESC_MAX} caractères maximum>", "metric": "<une clé de la liste>", "target": <entier dans les bornes de la métrique>, "startsOn": "AAAA-MM-JJ", "endsOn": "AAAA-MM-JJ"}
ou {"ok": false, "reason": "gain"} ou {"ok": false, "reason": "no_metric"}

Si le coach ne précise pas de dates, propose une semaine qui commence aujourd'hui. Si le coach ne précise pas de cible, choisis une valeur exigeante mais atteignable au vu de la durée : sur 7 jours, viser 7 jours propres ne laisse aucune marge d'erreur et décourage.`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Réservé à l'animateur d'une communauté active : c'est lui seul qui pourra
  // publier le brouillon, inutile d'ouvrir l'appel au reste des comptes.
  const admin = serviceClient();
  const { data: owned } = await admin
    .from("communities")
    .select("id")
    .eq("owner_id", auth.userId)
    .eq("active", true)
    .maybeSingle();
  if (!owned) return NextResponse.json({ ok: false, reason: "not_owner" }, { status: 403 });

  const limited = await rateLimitAi(auth.userId, "community-interpret", DAILY_LIMIT, auth.timezone);
  if (limited) return limited;

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const input = (text ?? "").trim().slice(0, INPUT_MAX);
  if (input.length < 3) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });

  // Court-circuit : si l'intention elle-même promet un gain, le dire tout de
  // suite est plus utile (et gratuit) qu'un aller-retour dont on rejettera la
  // sortie. Le partenaire apprend la règle au moment où elle le concerne.
  if (containsGainPromise(input)) {
    return NextResponse.json({ ok: false, reason: "gain" });
  }

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });

  const today = localDateKey(auth.timezone);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(input, today) }],
    });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ ok: false, reason: "no_metric" });

    const parsed = JSON.parse(match[0]) as AiDraft & { ok?: unknown; reason?: unknown };
    if (parsed.ok !== true) {
      const reason = parsed.reason === "gain" ? "gain" : "no_metric";
      return NextResponse.json({ ok: false, reason });
    }

    const draft = repair(parsed, today);
    if (!draft) return NextResponse.json({ ok: false, reason: "no_metric" });

    // Dernier filet : la sortie du modèle passe exactement la validation de la
    // saisie manuelle. Rien de ce que l'IA propose n'échappe aux garde-fous.
    const invalid = validateChallengeDraft(draft, today);
    if (invalid) {
      console.error("[community/interpret] draft rejected by validation:", invalid);
      return NextResponse.json({ ok: false, reason: invalid === "cc_err_gain" ? "gain" : "no_metric" });
    }

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    if (isLowCreditError(err)) await alertLowCreditsOnce();
    console.error("[community/interpret] error:", err);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
  }
}

/**
 * Remet la sortie du modèle dans les clous sur ce qui se rattrape sans trahir
 * l'intention (une cible hors bornes, une durée trop longue, une date absente).
 * Ce qui touche au SENS — métrique inconnue, titre qui promet un gain — n'est
 * jamais réparé ici : c'est validateChallengeDraft qui tranchera.
 */
function repair(parsed: AiDraft, today: string): ChallengeDraft | null {
  const metric = typeof parsed.metric === "string" ? parsed.metric : "";
  const spec = getMetricSpec(metric);
  if (!spec) return null;

  const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, TITLE_MAX) : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, DESC_MAX) : "";

  const rawTarget = Math.round(Number(parsed.target));
  const target = Number.isFinite(rawTarget)
    ? Math.min(spec.max, Math.max(spec.min, rawTarget))
    : spec.defaultTarget;

  let startsOn = isDayKey(parsed.startsOn) ? parsed.startsOn : today;
  let endsOn = isDayKey(parsed.endsOn) ? parsed.endsOn : shiftDay(startsOn, 6);

  // Bornes de démarrage, puis durée : l'ordre compte, décaler le début après
  // avoir coupé la durée rallongerait le défi.
  if (daysBetween(today, startsOn) < -7) startsOn = today;
  if (daysBetween(today, startsOn) > 90) startsOn = shiftDay(today, 90);
  if (endsOn < startsOn) endsOn = shiftDay(startsOn, 6);
  if (daysBetween(startsOn, endsOn) + 1 > MAX_CHALLENGE_DAYS) {
    endsOn = shiftDay(startsOn, MAX_CHALLENGE_DAYS - 1);
  }

  return { title, description, metric, target, startsOn, endsOn };
}
