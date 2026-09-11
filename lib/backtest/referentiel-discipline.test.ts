import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { METHODES } from "./methodes";
import { CODES_QUESTIONS } from "./completude";

/**
 * LES RÈGLES QUE CE CHANTIER S'EST DONNÉES, TENUES PAR DES TESTS.
 *
 * ── POURQUOI DES TESTS QUI LISENT LA SOURCE ─────────────────────────────────
 *
 * Chacune de ces règles a été violée au moins une fois pendant la construction,
 * et aucune ne se voit à l'exécution : un code technique affiché à l'écran, une
 * note de complétude, un classement de méthodes, un conseil d'investissement
 * glissé dans une aide au remplissage. Elles ne cassent rien, elles dégradent, et
 * personne ne s'en aperçoit avant que le produit ait menti à quelqu'un.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

/**
 * La source débarrassée de ses commentaires.
 *
 * ⚠️⚠️ SANS ÇA, CES TESTS CRIENT À TORT. Le premier jet interdisait le caractère
 * « % » dans l'écran de complétude, et échouait sur le commentaire qui EXPLIQUE
 * pourquoi on ne veut pas de pourcentage. Un test qui punit la documentation
 * d'une règle finit par faire supprimer la documentation, jamais la faute. La
 * même erreur avait déjà été commise trois fois sur ce chantier.
 */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * ⚠️⚠️ AUCUNE MÉTHODE N'EST DÉCLARÉE MEILLEURE QU'UNE AUTRE. Un référentiel qui
 * classerait les méthodes deviendrait une recommandation d'investissement, ce
 * que cette application n'a ni le métier ni le droit de faire. La liste se range
 * par famille, jamais par mérite.
 */
describe("aucun classement des méthodes", () => {
  it("le référentiel ne porte ni note, ni rang, ni recommandation", () => {
    for (const m of METHODES) {
      const champs = Object.keys(m);
      for (const interdit of ["note", "score", "rang", "recommande", "meilleur", "etoiles"]) {
        expect(champs, `${m.code} porte « ${interdit} »`).not.toContain(interdit);
      }
    }
  });

  it("la source ne trie pas les méthodes sur autre chose que leur famille", () => {
    expect(sansCommentaires(lire("components/backtest/Methode.tsx")).includes(".sort(")).toBe(false);
  });
});

/**
 * ⚠️ DES CODES, JAMAIS DES PHRASES. La rédaction vit dans les traductions. Un
 * référentiel qui porterait ses propres textes serait intraduisible, et le
 * trader lirait du français dans une interface allemande.
 */
describe("le référentiel ne contient aucune rédaction", () => {
  const estUnCode = (v: string) => /^[a-z0-9_]+$/.test(v);

  it("les codes de méthode, de tueur et de partie non reproduite sont des codes", () => {
    for (const m of METHODES) {
      expect(estUnCode(m.code), m.code).toBe(true);
      for (const t of m.tueurs) expect(estUnCode(t), `${m.code} / ${t}`).toBe(true);
      for (const n of m.squelette?.nonReproduit ?? []) {
        expect(estUnCode(n), `${m.code} / ${n}`).toBe(true);
      }
      for (const b of m.besoins) expect(estUnCode(b), `${m.code} / ${b}`).toBe(true);
    }
  });

  it("les treize questions sont des codes", () => {
    for (const c of CODES_QUESTIONS) expect(estUnCode(c), c).toBe(true);
  });
});

/**
 * ⚠️⚠️ AUCUNE NOTE DE COMPLÉTUDE, ET UN TEST POUR L'INTERDIRE. Une note se
 * capture en photo, se compare entre traders, et transforme « il me manque
 * l'invalidation » en « je suis à 78 % ». On compte les lignes, on ne les
 * moyenne jamais.
 */
describe("aucune note de complétude", () => {
  it("le module ne calcule aucun pourcentage ni aucune moyenne", () => {
    const source = sansCommentaires(lire("lib/backtest/completude.ts"));
    const corps = source.slice(source.indexOf("export function evaluerCompletude"));
    for (const mot of ["/ 13", "* 100", "score", "note"]) {
      expect(corps.includes(mot), mot).toBe(false);
    }
  });

  it("l'écran affiche trois comptes, jamais un rapport", () => {
    const code = sansCommentaires(lire("components/backtest/Completude.tsx"));
    expect(code.includes("%")).toBe(false);
  });
});

/**
 * ⚠️⚠️ AUCUNE LIGNE DE `condamnation.ts` N'EST UNE PRÉVISION. Ce sont cinq
 * divisions et multiplications que le trader peut refaire sur un coin de table.
 * Un module qui glisserait « ta stratégie va perdre » sortirait du seul terrain
 * où cette page a le droit d'être affirmative.
 */
describe("rien qui prédise", () => {
  it("le module de condamnation ne rend que de l'arithmétique", () => {
    const source = sansCommentaires(lire("lib/backtest/condamnation.ts"));
    const corps = source.slice(source.indexOf("export function verifierCondamnation"));
    // Aucune fonction aléatoire, aucune simulation : que des opérateurs.
    expect(corps.includes("Math.random")).toBe(false);
    expect(corps.includes("simul")).toBe(false);
  });

  /**
   * ⚠️ ON REND L'ÉCART, LE TRADER TRANCHE. « Trade l'or » serait un conseil
   * d'investissement ; « 78 % de tes trades sont sur l'or » est un comptage.
   */
  it("le module de profil ne donne aucun conseil", () => {
    const source = sansCommentaires(lire("lib/backtest/profil.ts"));
    const corps = source.slice(source.indexOf("export function confronterAuProfil"));
    for (const mot of ["conseil", "recommand", "tu devrais", "il faut que"]) {
      expect(corps.toLowerCase().includes(mot), mot).toBe(false);
    }
  });
});

/**
 * ⚠️⚠️ LE DIAGNOSTIC DOIT TOURNER SANS COÛTER UN CENTIME. Il s'affiche à chaque
 * rendu de la page : un appel au modèle le rendrait payant à chaque frappe, et
 * la marge du produit se joue sur exactement ce genre de détail.
 */
describe("aucun appel au modèle dans le diagnostic", () => {
  it.each([
    "lib/backtest/completude.ts",
    "lib/backtest/condamnation.ts",
    "lib/backtest/profil.ts",
    "lib/backtest/methodes.ts",
  ])("« %s » n'appelle ni fetch ni modèle", (chemin) => {
    const source = sansCommentaires(lire(chemin));
    expect(source.includes("fetch(")).toBe(false);
    expect(source.includes("anthropic")).toBe(false);
    expect(source.includes("/api/")).toBe(false);
  });
});
