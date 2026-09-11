import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE THÈME EST DÉJÀ LE BON SUR LA PREMIÈRE IMAGE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN ABONNÉ EN THÈME CLAIR VOYAIT D'ABORD LE THÈME SOMBRE. Deux mécaniques
 * cohabitent, et une seule des deux arrivait à temps :
 *
 *   - les COULEURS viennent de variables CSS, basculées par une classe que pose
 *     un script en ligne dans `app/layout.tsx`, avant la peinture : correct ;
 *   - mais les composants qui lisent le thème en JAVASCRIPT (les halos
 *     d'ambiance du tableau de bord, les couleurs des courbes) le lisent dans
 *     un contexte dont l'état initial vaut « sombre », corrigé par un
 *     `useEffect`, c'est-à-dire APRÈS la première peinture.
 *
 * La première image contenait donc les halos sombres sur un fond clair. Une
 * frame sur une machine rapide ; bien plus sur un téléphone.
 *
 * ⚠️ ET « INITIALISER L'ÉTAT DEPUIS LE DOM » N'EST PAS LA RÉPONSE : le serveur
 * a rendu la version sombre, un premier rendu client différent est une
 * incohérence d'hydratation. Ce qu'il faut, c'est corriger ENTRE le rendu et la
 * peinture, ce que `useLayoutEffect` fait et `useEffect` ne fait pas.
 */
describe("le thème", () => {
  const source = readFileSync(join(process.cwd(), "lib/ThemeContext.tsx"), "utf8");

  it("s'applique avant la peinture, pas après", () => {
    expect(source, "la correction du thème est repassée en useEffect").toMatch(
      /useEffetAvantPeinture\(\(\) => \{/,
    );
    expect(source).toMatch(/typeof window === "undefined" \? useEffect : useLayoutEffect/);
  });

  /**
   * ⚠️ ET LE PREMIER RENDU RESTE CELUI DU SERVEUR : un état initial lu dans le
   * navigateur (localStorage, classe du document, media query) ferait diverger
   * l'hydratation, ce qui produit un autre défaut à la place du premier.
   */
  it("ne lit pas le navigateur pour son état initial", () => {
    const initial = /useState<Theme>\(([^)]*)\)/.exec(source);
    expect(initial, "l'état initial du thème a disparu").toBeTruthy();
    expect(initial![1].trim(), "état initial lu dans le navigateur").toBe('"dark"');
  });

  /**
   * ⚠️ ET LE SCRIPT EN LIGNE RESTE : c'est lui qui met la classe avant même que
   * React existe. Sans lui, aucune correction JavaScript n'arrive à temps.
   */
  it("garde le script qui pose la classe avant tout JavaScript", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("tm-theme");
    expect(layout).toMatch(/classList\.add\('light'\)/);
  });
});
