import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_ROUTES } from "../product-margin";
import { FEATURE_MONTHLY_CEILING } from "../ai-ceilings";

/**
 * LE PRÉFIXE DE COMPILATION DOIT RESTER INVARIANT, ET SON COÛT MESURÉ.
 *
 * ── CE QUI SE CASSE EN SILENCE ──────────────────────────────────────────────
 *
 * Un point de cache ne se déclenche que sur un préfixe IDENTIQUE AU CARACTÈRE
 * PRÈS. Le jour où quelqu'un glisse l'instrument, l'heure ou le nom du trader
 * dans le bloc système, le cache manque à tous les coups : rien ne plante, rien
 * ne change à l'écran, et chaque traduction coûte 25 % de plus qu'avant qu'on
 * ait posé le cache. C'est exactement le genre de dégradation qu'on ne découvre
 * qu'en lisant une facture, six mois trop tard.
 *
 * ── ET CE QUI A DÉJÀ ÉTÉ FAUX ───────────────────────────────────────────────
 *
 * ⚠️⚠️ Le modèle de marge chiffrait cette route « par majorant » : 3 000 tokens
 * d'entrée et 1 500 de sortie, devinés. Comptés le 2026-09-03 : 4 986 en entrée
 * et 950 à 1 000 en sortie sur les appels réellement facturés. L'entrée était
 * sous-estimée de 66 %. Un majorant qui sous-estime n'est pas un majorant, et
 * celui-là a survécu jusqu'au jour où on a voulu toucher au plafond.
 */

const ROUTE = readFileSync(join(process.cwd(), "app/api/compiler-strategie/route.ts"), "utf8");

/** Le corps du gabarit `SYSTEME`, tel qu'il part vraiment au modèle. */
function corpsDuSysteme(): string {
  const i = ROUTE.indexOf("const SYSTEME = `");
  expect(i, "le bloc SYSTEME a disparu").toBeGreaterThan(-1);
  const debut = i + "const SYSTEME = `".length;
  const fin = ROUTE.indexOf("`;", debut);
  expect(fin).toBeGreaterThan(debut);
  return ROUTE.slice(debut, fin);
}

describe("le préfixe mis en cache", () => {
  /**
   * ⚠️⚠️ LA SEULE INTERPOLATION TOLÉRÉE EST LE CATALOGUE, qui est lui-même une
   * constante de module. Toute autre rendrait le préfixe différent d'un appel à
   * l'autre, donc jamais réutilisable.
   */
  it("ne contient aucune valeur variable", () => {
    const interpolations = Array.from(corpsDuSysteme().matchAll(/\$\{([^}]*)\}/g), (m) => m[1].trim());
    expect(interpolations, "une valeur variable s'est glissée dans le préfixe").toEqual([
      "CATALOGUE",
    ]);
  });

  it("le catalogue qu'il interpole est bien une constante figée", () => {
    expect(ROUTE.includes("const CATALOGUE = `")).toBe(true);
    const debut = ROUTE.indexOf("const CATALOGUE = `") + "const CATALOGUE = `".length;
    const catalogue = ROUTE.slice(debut, ROUTE.indexOf("`;", debut));
    expect(/\$\{/.test(catalogue), "le catalogue contient une interpolation").toBe(false);
  });

  /**
   * ⚠️ UN PRÉFIXE NE SE CACHE QUE S'IL EST AU DÉBUT. La fiche du trader était
   * en tête du prompt : aucun cache n'était possible, quoi qu'on fasse.
   */
  it("part en bloc système, la fiche du trader arrive après", () => {
    const appel = ROUTE.slice(ROUTE.indexOf("messages.create({"));
    expect(appel.includes("system: [{ type: \"text\", text: SYSTEME")).toBe(true);
    expect(appel.includes("cache_control: { type: \"ephemeral\" }")).toBe(true);
    expect(appel.includes("content: message")).toBe(true);
  });

  /**
   * ⚠️ CINQ MINUTES, PAS UNE HEURE, et c'est un calcul. Écrire coûte 1,25× en
   * cinq minutes contre 2× en une heure ; le seuil de rentabilité passe de 22 %
   * de relectures à 53 %. Avec une douzaine d'abonnés, une fenêtre d'une heure
   * se paierait le double pour un cache que personne ne relit.
   */
  it("ne demande pas la fenêtre longue", () => {
    expect(ROUTE.includes('"ephemeral"')).toBe(true);
    expect(ROUTE.includes('ttl: "1h"')).toBe(false);
  });

  /**
   * ⚠️ LE PROMPT N'A RIEN PERDU EN CHANGEANT D'ORDRE. Chaque section doit
   * exister une fois et une seule : en coupant le gabarit en deux, il aurait
   * suffi d'un mauvais index pour perdre la moitié des règles sans que rien ne
   * plante.
   */
  it.each([
    "CATALOGUE FERME",
    "REGLES ABSOLUES",
    "Reponds STRICTEMENT en JSON",
    "FICHE DU TRADER",
    "ECHELLE DE CET INSTRUMENT",
  ])("« %s » est présent une fois et une seule", (section) => {
    expect(ROUTE.split(section)).toHaveLength(2);
  });

  /**
   * ⚠️ LA RÈGLE 5b RENVOIE À L'ÉCHELLE DE L'INSTRUMENT, qui est passée dans le
   * message et non plus dans le préfixe. Elle disait « plus haut » : après le
   * découpage, ce qui était plus haut est maintenant plus bas.
   */
  it("ne renvoie plus à un « plus haut » qui n'existe plus", () => {
    const systeme = corpsDuSysteme();
    expect(systeme.includes("t'est donne plus haut")).toBe(false);
    expect(systeme.includes("t'est donne AVEC LA FICHE")).toBe(true);
  });
});

describe("ce que la compilation coûte, et ce qu'elle autorise", () => {
  const route = AI_ROUTES.find((r) => r.nom.includes("compilation"))!;

  it("est chiffrée sur une mesure, pas sur un majorant", () => {
    expect(route.source).toBe("mesurée");
  });

  /**
   * ⚠️ LE PIRE CAS DU CACHE COÛTE PLUS CHER QUE PAS DE CACHE. Écrire un point
   * coûte 1,25× l'entrée : un mois sans aucune relecture coûte 25 % de plus
   * qu'avant. C'est ce mois-là qu'on modélise, sinon on serait optimiste en se
   * croyant prudent.
   */
  it("modélise le mois où aucun point de cache n'est relu", () => {
    const PREFIXE = 4649;
    const VARIABLE = 5500 - PREFIXE;
    expect(route.inputTokens).toBe(Math.round(PREFIXE * 1.25 + VARIABLE));
  });

  it("ne sur-estime plus la sortie de moitié", () => {
    // Observé sur les appels facturés : 950 et 1 000.
    expect(route.outputTokens).toBeLessThanOrEqual(1000);
    expect(route.outputTokens).toBeGreaterThanOrEqual(950);
  });

  /**
   * ⚠️ LE PLAFOND EST CELUI QUE LE GARDE-FOU DE MARGE AUTORISE, pas celui qu'on
   * aurait aimé. 60 laissait -0,09 € à 50 abonnés, 45 seulement +0,07 €, soit
   * la finesse qui avait déjà fait refuser la hausse du coach.
   */
  it("laisse cinq séances de travail, pas deux", () => {
    expect(FEATURE_MONTHLY_CEILING["compiler-strategie"]).toBe(40);
  });
});
