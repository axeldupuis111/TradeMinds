import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remplir } from "./remplir";

/**
 * UN ACCORD NE SE RÉSOUT PAS À COUPS DE `replace`.
 *
 * ── LE DÉFAUT, LU SUR LA PAGE STRATÉGIE ─────────────────────────────────────
 *
 * ⚠️⚠️ « 3 {pertes|perte|pertes} d'affilée à 5 % te coûtent -14.3 % du
 * capital. » Mesuré le 2026-09-15, en toutes lettres, au milieu de la carte
 * « Ta fiche tient-elle debout ? » — celle qui vend le sérieux du produit.
 *
 * ⚠️ DEUX FAUTES DANS LA MÊME PHRASE, ET UNE SEULE CAUSE : les deux écrans qui
 * rendent un constat de cohérence substituaient les jetons À LA MAIN,
 * `replaceAll("{pertes}", String(valeur))`. Or :
 *
 *   - `replaceAll("{pertes}")` ne touche pas `{pertes|perte|pertes}`, donc
 *     l'accord restait brut ;
 *   - `String(14.3)` écrit « 14.3 » dans toutes les langues, donc le
 *     séparateur décimal était anglais sur une page française.
 *
 * ⚠️ ET L'ONGLET BACKTEST LE FAISAIT DÉJÀ BIEN, dix lignes de code plus loin :
 * `t(\`bt_coh_${c.code}\`, c.valeurs)`. La règle était écrite, appliquée à un
 * écran sur trois. La forme habituelle des défauts de ce dépôt.
 */
describe("les constats de cohérence", () => {
  const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
  const fr = lire("lib/i18n/fr.ts");

  /** La syntaxe d'accord : `{nom|singulier|pluriel}`. */
  const ACCORD = /\{[a-zA-Z0-9_]+\|[^|{}]*\|[^|{}]*\}/;

  it("leurs textes portent bien des accords, sinon ce test ne prouve rien", () => {
    const cles = Array.from(fr.matchAll(/^\s*"(coh_[a-zA-Z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/gm))
      .filter((m) => ACCORD.test(m[2]))
      .map((m) => m[1]);
    expect(cles.length, "plus aucun constat n'a d'accord à résoudre").toBeGreaterThan(3);
  });

  it("les trois écrans passent leurs valeurs à t(), au lieu de substituer à la main", () => {
    for (const chemin of [
      "app/dashboard/strategy/page.tsx",
      "app/dashboard/projection/page.tsx",
    ]) {
      const src = lire(chemin);
      expect(src, `${chemin} ne passe plus les valeurs du constat à t()`).toContain(
        "t(c.code, valeursLisibles(c.valeurs))",
      );
      expect(
        src,
        `${chemin} substitue de nouveau les jetons à la main : les accords y resteront bruts`,
      ).not.toMatch(/texte\.replaceAll\(`\{\$\{cle\}\}`/);
    }
    // L'onglet backtest, qui n'a jamais eu le défaut.
    expect(lire("components/backtest/Analyse.tsx")).toContain("c.valeurs)");
  });

  it("les nombres des constats sont mis en forme pour le lecteur", () => {
    for (const chemin of [
      "app/dashboard/strategy/page.tsx",
      "app/dashboard/projection/page.tsx",
    ]) {
      const src = lire(chemin);
      expect(src, `${chemin} n'a plus de mise en forme des nombres`).toContain(
        "function valeursLisibles(",
      );
      expect(src).toContain("nombre(valeur, Number.isInteger(valeur) ? 0 : 1)");
    }
  });

  /**
   * ⚠️ ET `remplir` SAIT RELIRE UN NOMBRE DÉJÀ MIS EN FORME. Sans cela, la
   * correction ci-dessus en aurait créé une autre : « 1 000 » et « 14,3 »
   * donnent `NaN` avec `Number()`, et l'accord se serait décidé au hasard dans
   * la langue même où il compte.
   */
  it("un nombre déjà mis en forme accorde quand même", () => {
    // Français : virgule décimale, espace de groupement.
    expect(remplir("{n} {n|perte|pertes}", { n: "1" }, "fr")).toBe("1 perte");
    expect(remplir("{n} {n|perte|pertes}", { n: "3" }, "fr")).toBe("3 pertes");
    expect(remplir("{n} {n|jour|jours}", { n: "1 000" }, "fr")).toBe("1 000 jours");
    // Zéro prend le singulier en français, le pluriel en anglais.
    expect(remplir("{n} {n|jour|jours}", { n: "0" }, "fr")).toBe("0 jour");
    expect(remplir("{n} {n|day|days}", { n: "0" }, "en")).toBe("0 days");
    // Anglais : la virgule est un séparateur de milliers, pas un décimal.
    expect(remplir("{n} {n|day|days}", { n: "1,000" }, "en")).toBe("1,000 days");
  });

  it("une valeur illisible ne casse pas la phrase", () => {
    // Pas de crash, pas de gabarit brut : la forme la moins souvent fausse.
    expect(remplir("{n} {n|perte|pertes}", { n: "beaucoup" }, "fr")).toBe("beaucoup pertes");
  });
});
