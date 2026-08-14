import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildCoachSystemPrompt } from "./coach-system-prompt";
import { renderMethodGlossaries, ALL_METHOD_FAMILIES, MAX_GLOSSARIES } from "./coach-method-glossaries";
import { coachToolsForPlan } from "./coach-tools";
import { webSearchTool } from "./coach-web-search";
import { costEur } from "./ai-cost-log";
import { PLAN_MONTHLY_CEILING } from "./ai-ceilings";

/**
 * GARDE-FOU DE MARGE.
 *
 * Le prompt du coach a gagné plusieurs blocs de règles en une journée. Chacun
 * paraissait négligeable ; personne ne mesurait la somme. C'est ainsi qu'un
 * produit devient déficitaire sans qu'aucune décision ne l'ait décidé.
 *
 * Ce banc compte les tokens du VRAI prompt (via l'API, pas une estimation),
 * simule le pire cas d'un abonné Premium qui épuise son plafond mensuel, et
 * échoue si le coût dépasse l'enveloppe. Ajouter une règle reste possible :
 * il faut juste voir ce qu'elle coûte.
 *
 * Lancé par `npm run eval:coach` (compter des tokens est un appel API).
 */

const CLE = (() => {
  try {
    for (const ligne of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*(CLAUDE_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.+)$/.exec(ligne);
      if (m) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* on retombe sur l'environnement */
  }
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
})();

const MODELE = "claude-haiku-4-5-20251001";

/**
 * Le catalogue TEL QU'IL PART EN PRODUCTION, recherche web comprise. Compter
 * le préfixe sans elle sous-estimerait ce qu'on paie à chaque message, et
 * c'est précisément ce chiffre qui pilote les arbitrages de modèle.
 */
function outilsProduction(): unknown[] {
  return [...coachToolsForPlan("premium"), webSearchTool(MODELE)];
}

/**
 * Enveloppe du coach pour un abonné Premium, en euros par mois.
 *
 * Origine : c'est la part du prix d'abonnement qu'on accepte de dépenser en
 * coach pour un abonné qui va jusqu'à son plafond mensuel, une fois déduits
 * Stripe, l'infrastructure et les autres routes IA. Elle a été posée lors de
 * l'analyse de coût du 2026-08-10, celle qui a écarté Sonnet 5 sur le coach.
 *
 * Ce n'est PAS le coût attendu : c'est le pire cas admissible. Le coût réel
 * observé est très inférieur, parce que personne n'épuise son plafond.
 */
const ENVELOPPE_PREMIUM_EUR = 8.36;

/** Hypothèses du pire cas, explicites pour être discutables. */
const PIRE_CAS = {
  /** Messages par mois : le plafond du disjoncteur, pas une moyenne. */
  messages: PLAN_MONTHLY_CEILING.chat.premium,
  /** Appels modèle par message : 1 + les tours d'outils. */
  roundsParMessage: 1.4,
  /** Conversations distinctes par mois : autant d'écritures de cache. */
  conversations: 40,
  /** Historique moyen envoyé avec chaque appel, en tokens. */
  historique: 3000,
  /** Sortie moyenne par appel modèle, en tokens. */
  sortie: 800,
} as const;

/**
 * Compte les tokens du préfixe réel.
 *
 * ⚠️ `count_tokens` REFUSE les outils serveur (400 : « Server tools are not
 * supported in the count_tokens endpoint »). Or la recherche web en est un, et
 * elle fait partie du préfixe payé à chaque message : la compter à part
 * reviendrait à mesurer un prompt qui n'existe pas. On passe donc par
 * /v1/messages avec `max_tokens: 1`, qui accepte les outils serveur et rend le
 * vrai `input_tokens` de production. Coût : une sortie d'un token par appel.
 */
async function compterTokens(systeme: string, outils: unknown[]): Promise<number> {
  const client = new Anthropic({ apiKey: CLE });
  const r = await client.messages.create({
    model: MODELE,
    max_tokens: 1,
    system: systeme,
    tools: outils as Anthropic.Tool[],
    messages: [{ role: "user", content: "." }],
  });
  return r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0);
}

/** Prompt du pire cas : deux glossaires, fiche, statistiques, mémoire. */
function promptMaximal(): string {
  return buildCoachSystemPrompt({
    langName: "français",
    methodGlossaries: renderMethodGlossaries(
      // Les deux glossaires les plus lourds : c'est ce qu'un trader peut
      // réellement déclencher, MAX_GLOSSARIES en bornant le nombre.
      [...ALL_METHOD_FAMILIES]
        .sort((a, b) => renderMethodGlossaries([b]).length - renderMethodGlossaries([a]).length)
        .slice(0, MAX_GLOSSARIES),
    ),
    strategyBlock: "S".repeat(2500),
    statsBlock: "T".repeat(1500),
    memoryBlock: "M".repeat(800),
    statsTradeLimit: 300,
    todayKey: "2026-08-13",
    yesterdayKey: "2026-08-12",
    todayLabel: "jeudi 13 août 2026",
    timezone: "Europe/Paris",
  });
}

describe("marge du coach au pire cas", () => {
  it("le préfixe système reste sous son plafond de taille", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    const prefixe = await compterTokens(promptMaximal(), outilsProduction());
    console.log(`\n  Préfixe système + outils (pire cas) : ${prefixe} tokens`);
    // Mesuré 19 820 le 2026-08-13, puis 22 731 le 2026-08-14 après l'ajout de
    // la recherche web. Le seuil est passé de 22 000 à 24 000, ET C'EST UN
    // ARBITRAGE ASSUMÉ, pas un plafond qu'on repousse quand il gêne :
    //  - l'outil serveur pèse ~1 600 tokens à lui seul, parce que l'API
    //    injecte ses propres instructions d'usage avec lui. Ce n'est pas de la
    //    dérive de prose, c'est le prix d'une capacité ;
    //  - surtout, ce test n'est plus le vrai garde-fou. Il mesurait la taille
    //    comme PROXY du coût, faute de mieux. Depuis le 2026-08-14 la marge du
    //    produit entier est tenue par `product-margin.test.ts`, qui échoue si
    //    un abonné au plafond coûte plus qu'il ne rapporte. Ce seuil-ci ne sert
    //    plus qu'à rendre une dérive VISIBLE, pas à décider.
    // Le franchir reste un arbitrage à faire les yeux ouverts, chiffre en main.
    expect(prefixe, "le préfixe a dépassé son plafond : arbitrer avant d'ajouter").toBeLessThan(24_000);
  });

  it("un abonné Premium au plafond reste dans l'enveloppe", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    const prefixe = await compterTokens(promptMaximal(), outilsProduction());
    const appels = PIRE_CAS.messages * PIRE_CAS.roundsParMessage;

    // Écritures de cache : une par conversation. TTL 1 h => 2x le tarif d'entrée.
    // costEur applique 1,25x (TTL 5 min), on corrige donc le facteur.
    const ecritures = PIRE_CAS.conversations * prefixe;
    const coutEcritures = costEur(MODELE, { cache_creation_input_tokens: ecritures }) * (2 / 1.25);
    // Lectures de cache : tous les autres appels.
    const coutLectures = costEur(MODELE, {
      cache_read_input_tokens: Math.max(0, appels - PIRE_CAS.conversations) * prefixe,
    });
    // Historique et sorties : jamais mis en cache au-delà du dernier point.
    const coutHistorique = costEur(MODELE, { input_tokens: appels * PIRE_CAS.historique });
    const coutSorties = costEur(MODELE, { output_tokens: appels * PIRE_CAS.sortie });

    const total = coutEcritures + coutLectures + coutHistorique + coutSorties;
    console.log(
      `\n  Pire cas Premium (${PIRE_CAS.messages} messages, ${Math.round(appels)} appels) :\n` +
        `    écritures de cache : ${coutEcritures.toFixed(2)} EUR\n` +
        `    lectures de cache  : ${coutLectures.toFixed(2)} EUR\n` +
        `    historique         : ${coutHistorique.toFixed(2)} EUR\n` +
        `    sorties            : ${coutSorties.toFixed(2)} EUR\n` +
        `    TOTAL              : ${total.toFixed(2)} EUR sur ${ENVELOPPE_PREMIUM_EUR} EUR d'enveloppe\n` +
        `    marge restante     : ${(ENVELOPPE_PREMIUM_EUR - total).toFixed(2)} EUR\n`,
    );

    expect(
      total,
      `pire cas ${total.toFixed(2)} EUR contre ${ENVELOPPE_PREMIUM_EUR} EUR d'enveloppe. ` +
        `Le prompt a grossi, ou une hypothèse a changé : trancher avant de livrer.`,
    ).toBeLessThan(ENVELOPPE_PREMIUM_EUR);
  });

  it("dit lequel de l'entrée ou de la sortie domine, pour savoir où couper", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    const prefixe = await compterTokens(promptMaximal(), outilsProduction());
    const appels = PIRE_CAS.messages * PIRE_CAS.roundsParMessage;
    const sorties = costEur(MODELE, { output_tokens: appels * PIRE_CAS.sortie });
    const entrees = costEur(MODELE, {
      cache_read_input_tokens: appels * prefixe,
      input_tokens: appels * PIRE_CAS.historique,
    });
    console.log(`\n  entrée ${entrees.toFixed(2)} EUR contre sortie ${sorties.toFixed(2)} EUR\n`);

    // ⚠️ CE TEST A CHANGÉ DE SENS LE 2026-08-13, ET C'EST LE POINT INTÉRESSANT.
    // L'analyse qui avait écarté Sonnet 5 concluait que la SORTIE faisait le
    // coût, donc que tailler dans le prompt ne rapportait rien. Avec un préfixe
    // passé à ~20 000 tokens (dont environ la moitié en catalogue d'outils),
    // ce n'est plus vrai : l'entrée est devenue le poste dominant.
    //
    // Conséquence pratique : raccourcir le prompt ET le catalogue d'outils
    // rapporte désormais plus que raccourcir les réponses. Si un jour ce test
    // se remet à échouer, c'est que la sortie est repassée devant, et le levier
    // aura changé de côté : relire ce commentaire avant de conclure.
    expect(entrees).toBeGreaterThan(sorties);
  });
});

/**
 * Où partent les tokens du préfixe. Sans cette ventilation, « le prompt est
 * trop gros » ne dit pas quoi couper : le texte des règles et le catalogue
 * d'outils sont deux postes très différents, et le second est le plus lourd
 * alors qu'il est le moins visible.
 */
describe("ventilation du préfixe", () => {
  it("dit ce que pèsent les règles, les glossaires et les outils", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    const outils = coachToolsForPlan("premium");
    const sansOutils = await compterTokens(promptMaximal(), []);
    const avecOutils = await compterTokens(promptMaximal(), outils);
    const nu = await compterTokens(
      buildCoachSystemPrompt({
        langName: "français",
        methodGlossaries: "",
        strategyBlock: "",
        statsBlock: "",
        memoryBlock: "",
        statsTradeLimit: 300,
        todayKey: "2026-08-13",
        yesterdayKey: "2026-08-12",
        todayLabel: "jeudi 13 août 2026",
        timezone: "Europe/Paris",
      }),
      [],
    );
    console.log(
      `\n  Ventilation du préfixe (pire cas) :\n` +
        `    règles seules      : ${nu} tokens\n` +
        `    + fiche/stats/gloss : ${sansOutils - nu} tokens\n` +
        `    + catalogue d'outils: ${avecOutils - sansOutils} tokens (${outils.length} outils, ` +
        `${Math.round((avecOutils - sansOutils) / outils.length)} tok/outil)\n` +
        `    TOTAL               : ${avecOutils} tokens\n`,
    );
    expect(avecOutils).toBeGreaterThan(nu);
  });
});
