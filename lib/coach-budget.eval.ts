import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildCoachSystemPrompt } from "./coach-system-prompt";
import { renderMethodGlossaries, ALL_METHOD_FAMILIES, MAX_GLOSSARIES } from "./coach-method-glossaries";
import { coachToolsForPlan } from "./coach-tools";
import { differerCatalogue } from "./coach-tool-search";
import { COACH_DEFAULT } from "./product-margin";

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

const MODELES = { premium: "claude-sonnet-5", plus: "claude-haiku-4-5-20251001" } as const;

/**
 * Le catalogue TEL QU'IL PART EN PRODUCTION : 39 outils en `defer_loading`
 * derrière l'outil de recherche, et plus de recherche web depuis le
 * 2026-08-14. Mesurer autre chose ici, c'est piloter les arbitrages de modèle
 * sur un préfixe qui n'existe pas.
 */
function outilsProduction(plan: "premium" | "plus"): unknown[] {
  // Premium seul a le catalogue différé : sur Haiku le report ne finance rien
  // et fait perdre `create_strategy` au débutant (mesuré au banc le 2026-08-14).
  return plan === "premium"
    ? differerCatalogue(coachToolsForPlan("premium"))
    : coachToolsForPlan("plus");
}

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
async function compterTokens(systeme: string, outils: unknown[], modele: string): Promise<number> {
  const client = new Anthropic({ apiKey: CLE });
  const r = await client.messages.create({
    model: modele,
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

describe("le préfixe réel et le modèle économique disent la même chose", () => {
  it("mesure le préfixe de production et le confronte au modèle", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    // ⚠️ C'EST LE SEUL TEST QUI RELIE LE MODÈLE ÉCONOMIQUE À LA RÉALITÉ, et il
    // mesure LES DEUX MODÈLES : le même prompt ne compte pas le même nombre de
    // tokens sur Haiku et sur Sonnet (+45 %). Avoir mesuré un seul des deux a
    // failli faire livrer une configuration déficitaire le 2026-08-14.
    for (const plan of ["premium", "plus"] as const) {
      const prefixe = await compterTokens(promptMaximal(), outilsProduction(plan), MODELES[plan]);
      const attendu = COACH_DEFAULT.prefixeParModele[plan];
      console.log(`
  Préfixe ${plan} (${MODELES[plan]}) : ${prefixe} tokens, modèle ${attendu}`);
      expect(
        Math.abs(prefixe - attendu) / attendu,
        `préfixe ${plan} mesuré ${prefixe} contre ${attendu} dans product-margin.ts. ` +
          `Mettre COACH_DEFAULT.prefixeParModele.${plan} à jour ET revérifier la marge.`,
      ).toBeLessThan(0.08);
    }
  });

  it("le préfixe reste sous le plafond qui rend une dérive visible", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
    const prefixe = await compterTokens(promptMaximal(), outilsProduction("premium"), MODELES.premium);
    // Mesuré sur le modèle le plus cher, seul pire cas qui compte. Le plafond
    // n'est plus le garde-fou de coût (`product-margin.test.ts` l'est, en
    // euros) : il rend une dérive VISIBLE avant qu'elle ne coûte.
    expect(prefixe, "le préfixe a dépassé son plafond : arbitrer avant d'ajouter").toBeLessThan(23_000);
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
    const outils = outilsProduction("premium");
    const sansOutils = await compterTokens(promptMaximal(), [], MODELES.premium);
    const avecOutils = await compterTokens(promptMaximal(), outils as unknown[], MODELES.premium);
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
      MODELES.premium,
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
