import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, rateLimitAi } from "@/lib/api-auth";
import { isLowCreditError, alertLowCreditsOnce } from "@/lib/ai-credit-alert";
import { logAiCost } from "@/lib/ai-cost-log";

/**
 * LE VERDICT RÉDIGÉ DE LA PROJECTION.
 *
 * La page `/dashboard/projection` calcule tout elle-même, dans le navigateur, et
 * n'a besoin d'aucune IA pour fonctionner. Cette route ne sert qu'à une chose :
 * mettre en phrases ce que les chiffres disent déjà, et pointer ce qu'il y a à
 * corriger. C'est la moitié de la demande d'origine (« l'IA peut nous aider à
 * rendre la stratégie rentable »), l'autre moitié étant le calcul lui-même.
 *
 * ⚠️ HAIKU, ET C'EST UN CHOIX, PAS UNE ÉCONOMIE DE BOUT DE CHANDELLE. Le travail
 * demandé ici n'est pas du raisonnement de marché : l'espérance, l'intervalle,
 * le risque de ruine et le segment déficitaire sont calculés par NOTRE code et
 * arrivent tout faits dans le prompt. Le modèle ne fait que les ordonner en
 * français. C'est le profil de tâche où Haiku n'a jamais été pris en défaut, et
 * une route Sonnet dédiée cassait le garde-fou de marge (`product-margin.test.ts`)
 * pour un gain de qualité nul sur ce type de sortie.
 *
 * ⚠️ LE MODÈLE NE CALCULE RIEN, ET LE PROMPT LE LUI INTERDIT EXPLICITEMENT. Tous
 * les nombres qu'il peut citer sont dans les données qu'on lui passe. Un modèle
 * qui recalcule une espérance ou arrondit un risque de ruine produirait un
 * chiffre différent de celui affiché juste au-dessus, dans la même page. C'est
 * la façon la plus sûre de détruire la confiance dans les deux.
 *
 * ⚠️ ET IL N'A PAS LE DROIT D'ÊTRE PLUS AFFIRMATIF QUE LE VERDICT. Quand la
 * projection dit « indéterminé », le texte doit dire « on ne sait pas encore »,
 * jamais « ça a l'air prometteur ». Toute la valeur de cette fonctionnalité tient
 * à ce qu'elle ne rassure pas les perdants.
 */

export const dynamic = "force-dynamic";

const LANG_NAMES: Record<string, string> = {
  fr: "français",
  en: "English",
  de: "Deutsch",
  es: "español",
};

/**
 * Ce que la page envoie : le résultat DÉJÀ calculé, jamais les trades bruts.
 *
 * ⚠️ LES MONTANTS ARRIVENT EN CHAÎNES DÉJÀ FORMATÉES, PAS EN NOMBRES.
 *
 * La première version recevait des nombres bruts et les passait tels quels. Le
 * coach a alors écrit « -79.26 USD » et « -13785.08 USD » pendant que la page
 * affichait « -79$ » et « -13 785$ », à trois centimètres l'un de l'autre. Le
 * modèle était fidèle à ce qu'on lui donnait : c'est nous qui lui donnions autre
 * chose que ce que le trader lit.
 *
 * En recevant les chaînes d'affichage, la divergence devient structurellement
 * impossible. Le modèle ne peut citer que ce qui est à l'écran, ce qui était la
 * règle depuis le début mais n'était pas outillée.
 */
interface CorpsRequete {
  language?: string;
  verdict?: string;
  trades?: number;
  /** Montants formatés, tels qu'affichés au trader. */
  esperance?: string;
  intervalle?: string;
  median?: string;
  drawdownMedian?: string;
  drawdownPire?: string;
  /** Pourcentages entiers, arrondis comme la page les arrondit. */
  risqueDeRuine?: number;
  partGagnante?: number;
  tradesParAn?: number;
  annees?: number;
  /** Nom de la stratégie projetée, ou null pour tout le journal. */
  strategie?: string | null;
}

/** Reprend une chaîne d'affichage sans lui faire confiance sur la longueur. */
function texte(v: unknown, defaut = "n/a"): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : defaut;
}

const VERDICTS = new Set(["rentable", "perdante", "indetermine"]);

/**
 * Limite journalière. Volontairement basse : une projection ne change qu'avec
 * les trades, donc la relancer trois fois dans la même journée ne peut rien
 * apprendre de plus. C'est le plafond MENSUEL (`FEATURE_MONTHLY_CEILING`) qui
 * porte réellement le coût.
 */
const LIMITE_JOUR = 3;

/** Arrondi défensif : ce qui part au modèle doit être lisible et borné. */
function nombre(v: unknown, defaut = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : defaut;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Premium seulement, comme la page. Le `locked` laisse l'interface proposer
  // la montée en gamme au lieu d'afficher une erreur.
  if (auth.plan !== "premium") return NextResponse.json({ locked: true });

  const corps = (await req.json().catch(() => ({}))) as CorpsRequete;
  const lang = corps.language && LANG_NAMES[corps.language] ? corps.language : "en";

  // ⚠️ ON REFUSE DE RÉDIGER UN VERDICT QUI N'EN EST PAS UN. Si la page envoie
  // « insuffisant » (ou n'importe quoi d'autre), il n'y a rien à commenter : le
  // trader doit lire « il te manque N trades », pas un texte d'IA qui broderait
  // autour d'un échantillon trop court. On ne dépense pas un appel pour ça.
  if (!corps.verdict || !VERDICTS.has(corps.verdict)) {
    return NextResponse.json({ verdict: null, reason: "not_enough_data" });
  }

  const limited = await rateLimitAi(auth.userId, "projection-verdict", LIMITE_JOUR, auth.timezone);
  if (limited) return limited;

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ verdict: null, reason: "no_api_key" });

  const pct = (v: unknown) => `${Math.round(nombre(v))} %`;

  // Chaque ligne porte UN intitulé et UNE valeur, telle qu'affichée. Le format
  // « intitulé exact affiché à l'écran = valeur » n'est pas décoratif : sans
  // lui, le modèle a rattaché le résultat médian au libellé « creux médian »,
  // c'est-à-dire le bon nombre sous le mauvais nom.
  const donnees = [
    `Périmètre : ${corps.strategie ? `stratégie « ${String(corps.strategie).slice(0, 80)} »` : "tout le journal"}`,
    `Horizon projeté : ${nombre(corps.annees, 2)} ans`,
    `Trades utilisés : ${Math.round(nombre(corps.trades))}`,
    `Rythme : ${Math.round(nombre(corps.tradesParAn))} trades par an`,
    `Verdict calculé : ${corps.verdict}`,
    `« Espérance par trade » = ${texte(corps.esperance)}`,
    `Intervalle à 95 % de cette espérance = ${texte(corps.intervalle)}`,
    `« Risque de ruine » = ${pct(corps.risqueDeRuine)}`,
    `« Résultat médian » à l'horizon = ${texte(corps.median)}`,
    `« Creux typique » = ${texte(corps.drawdownMedian)}`,
    `« Creux des pires scénarios » = ${texte(corps.drawdownPire)}`,
    `« Scénarios gagnants » = ${pct(corps.partGagnante)}`,
  ].join("\n");

  const prompt = `Tu es le coach de TradeDiscipline. Un trader vient de faire tourner une PROJECTION de sa stratégie : on rééchantillonne ses trades réels pour simuler des milliers d'avenirs. Les chiffres ci-dessous sont DÉJÀ CALCULÉS et affichés à l'écran, juste au-dessus de ton texte.

${donnees}

Rédige son verdict en ${LANG_NAMES[lang]}, en tutoyant.

RÈGLES ABSOLUES :
- NE RECALCULE RIEN et n'invente aucun nombre. Recopie les valeurs ci-dessus EXACTEMENT comme elles sont écrites, symbole de devise et séparateurs compris. N'ajoute aucune décimale, n'en retire aucune, ne convertis rien. Elles sont affichées à l'écran juste au-dessus de ton texte : un chiffre de toi qui en diffère détruit la confiance dans les deux.
- CHAQUE NOMBRE RESTE ATTACHÉ À SON INTITULÉ. Le « résultat médian » n'est pas le « creux typique », et le « creux des pires scénarios » n'est pas un « scénario extrême » du résultat. Reprends les intitulés entre guillemets tels quels : donner le bon nombre sous le mauvais nom est aussi faux que donner le mauvais nombre.
- N'ANNONCE AUCUNE PERFORMANCE FUTURE. Ce sont des scénarios, pas des prévisions. Jamais « tu gagneras », jamais « cette stratégie rapporte ».
- NE SOIS PAS PLUS AFFIRMATIF QUE LE VERDICT. Si le verdict est "indetermine", dis clairement qu'on ne peut pas encore trancher et pourquoi (l'intervalle contient zéro). Ne le présente pas comme encourageant.
- Si le verdict est "perdante", dis-le franchement : ce n'est pas de la malchance, et le volume de trades supplémentaires n'y changera rien. C'est le service qu'il paie.
- LE RISQUE DE RUINE PRIME SUR L'ESPÉRANCE. Une espérance positive avec un risque de ruine élevé veut dire que la taille de position est trop grosse pour la volatilité de sa méthode. Dis-le quand c'est le cas, c'est le diagnostic le plus utile que tu puisses poser ici.
- Aucun conseil d'investissement, aucun instrument à acheter ou vendre. Tu parles de méthode, de risque par trade et de discipline.
- N'utilise jamais le tiret long. Pas d'astérisques, pas de markdown.

Réponds STRICTEMENT en JSON, sans texte autour :
{"titre": "une phrase qui résume la situation (max 70 caractères)", "lecture": "2 à 4 phrases qui expliquent ce que les chiffres disent, sans en inventer", "leviers": ["action concrète 1 (max 110 caractères)", "action concrète 2", "action concrète 3"]}
Les leviers portent sur ce qu'il contrôle : taille de position, nombre de trades, respect de sa checklist, segment à abandonner. Jamais sur ce que fera le marché.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    // Coût réel de l'appel. ⚠️ C'est ce qui fera passer cette route de
    // « majorant » à « mesurée » dans `product-margin.ts`, et chaque route qui
    // fait ce chemin rend du quota au trader.
    logAiCost(createClient(), auth.userId, {
      route: "projection-verdict",
      model: "claude-haiku-4-5-20251001",
      plan: auth.plan,
      usage: msg.usage,
      extra: { verdict: corps.verdict, trades: Math.round(nombre(corps.trades)) },
    });

    const brut = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const trouve = brut.match(/\{[\s\S]*\}/);
    if (!trouve) return NextResponse.json({ verdict: null, reason: "parse_failed" });

    const parse = JSON.parse(trouve[0]) as { titre?: unknown; lecture?: unknown; leviers?: unknown };
    // ⚠️ NORMALISER CHAQUE CHAMP, sans supposer que le modèle a respecté le
    // schéma. C'est l'incident du 2026-08-03 sur /analyze : une liste absente
    // faisait un 500 et coûtait un crédit au trader.
    const leviers = Array.isArray(parse.leviers)
      ? parse.leviers.filter((x): x is string => typeof x === "string").slice(0, 3)
      : [];
    const titre = typeof parse.titre === "string" ? parse.titre : "";
    const lecture = typeof parse.lecture === "string" ? parse.lecture : "";
    if (!titre || !lecture) return NextResponse.json({ verdict: null, reason: "parse_failed" });

    return NextResponse.json({ verdict: { titre, lecture, leviers } });
  } catch (err) {
    if (isLowCreditError(err)) await alertLowCreditsOnce();
    console.error("[projection-verdict] generation failed:", err);
    return NextResponse.json({ verdict: null, reason: "error" });
  }
}
