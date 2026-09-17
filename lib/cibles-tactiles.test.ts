import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE CIBLE TACTILE SE TOUCHE AVEC UN POUCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE BOUTON DE MENU FAISAIT VINGT PIXELS SUR VINGT, ET C'EST LA SEULE
 * NAVIGATION SUR TÉLÉPHONE. Mesuré le 2026-09-17 en rendant le produit dans un
 * cadre de 390 px : le bouton n'avait aucune marge intérieure, donc sa zone
 * tactile valait exactement son icône. Le minimum de la WCAG 2.5.8 est de
 * 24 px, celui des recommandations d'Apple de 44. Rater ce bouton-là, c'est ne
 * plus pouvoir changer de page.
 *
 * ⚠️ MÊME CHOSE POUR LA CROIX du bandeau de séance (16 px, présente sur toutes
 * les pages) et pour les CASES À COCHER de la liste des trades (16 px, une par
 * ligne), qui servent à sélectionner puis supprimer en lot.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On agrandit la ZONE, pas le dessin : `p-2 -m-2` ajoute seize pixels de marge
 * intérieure et rend l'espace avec une marge négative, donc rien ne bouge à
 * l'écran. C'est la correction la moins risquée pour une mise en page déjà
 * réglée.
 *
 * ⚠️ CE TEST NE REMPLACE PAS LA MESURE. La vraie vérification se fait dans le
 * navigateur, sur le DOM rendu à 390 px ; ce qui suit épingle les trois
 * corrections pour qu'elles ne repartent pas, et rien de plus.
 */

const RACINE = process.cwd();

/** L'attribut `className` du premier élément qui suit ce marqueur. */
function classeApres(src: string, marqueur: string): string {
  const i = src.indexOf(marqueur);
  if (i === -1) return "";
  const j = src.indexOf("className=", i);
  if (j === -1) return "";
  const debut = src.indexOf('"', j) + 1;
  return src.slice(debut, src.indexOf('"', debut));
}

describe("les cibles tactiles", () => {
  it("le bouton de menu a une zone plus large que son icône", () => {
    const src = readFileSync(join(RACINE, "components/Header.tsx"), "utf8");
    const i = src.indexOf('aria-label="Menu"');
    expect(i, "le bouton de menu a changé de nom").toBeGreaterThan(0);
    // La classe précède l'aria-label sur ce bouton : on remonte au <button>.
    const debut = src.lastIndexOf("<button", i);
    const balise = src.slice(debut, i);
    expect(
      balise,
      "le bouton de menu n'a plus de marge intérieure : sa zone tactile " +
        "retombe à la taille de son icône, vingt pixels",
    ).toMatch(/\bp-2(\.5)?\b/);
    expect(balise, "la marge n'est pas compensée : la mise en page va bouger").toMatch(/-m-2(\.5)?\b/);
  });

  it("la croix du bandeau de séance aussi", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/layout.tsx"), "utf8");
    const classe = classeApres(src, "onClick={dismiss}");
    expect(classe, "la croix du bandeau a perdu sa zone tactile").toMatch(/\bp-2\b/);
    expect(classe).toMatch(/-m-2\b/);
  });

  /**
   * ⚠️ `box-content` EST INDISPENSABLE ICI : sans lui, Tailwind met
   * `box-sizing: border-box` et la marge intérieure MANGE les seize pixels de
   * la case au lieu de s'y ajouter. La cible resterait à seize.
   */
  it("les cases à cocher de la liste des trades", () => {
    const src = readFileSync(join(RACINE, "components/trades/TradeList.tsx"), "utf8");
    const cases = Array.from(src.matchAll(/className="accent-accent w-4 h-4 cursor-pointer([^"]*)"/g));
    expect(cases.length, "les cases à cocher ont disparu : le garde est cassé").toBe(2);
    const fautes = cases
      .map((m) => m[1])
      .filter((suffixe) => !/p-2/.test(suffixe) || !/-m-2/.test(suffixe) || !/box-content/.test(suffixe));
    expect(
      fautes,
      "cases à cocher revenues à seize pixels : sur un téléphone, la " +
        "sélection en lot devient un jeu d'adresse",
    ).toEqual([]);
  });
});
