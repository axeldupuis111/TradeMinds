import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `.force-dark` ANNULE TOUT CE QUE `html.light` A POSÉ, OU IL N'ANNULE RIEN.
 *
 * ── LE DÉFAUT, MESURÉ SUR LA LANDING ────────────────────────────────────────
 *
 * Les pages publiques (landing, login, pages légales) restent en sombre quel
 * que soit le thème du visiteur : elles portent `.force-dark`, qui redéclare
 * les variables de couleur par-dessus `html.light`.
 *
 * ⚠️⚠️ IL EN REDÉCLARAIT SIX SUR DIX-SEPT. Ouverte par quelqu'un dont le thème
 * est CLAIR — le cas d'Axel — la landing affichait :
 *
 *   • `--foreground-muted` à sa valeur claire (#52525b) sur un fond #09090b,
 *     soit **2,57:1 sur 99 éléments**, dont toute la navigation
 *     (« Fonctionnalités », « Tarifs », « FAQ », « Blog », « Se connecter »).
 *     Le seuil AA est 4,5. C'est la page qui vend le produit.
 *   • `--accent` à #00A8AC, la variante **assombrie pour fond clair**, au lieu
 *     du cyan de signature #00D4D8. La landing qu'il a choisie « parce qu'elle
 *     est cyan, plus pro » n'était pas cyan chez lui.
 *   • `--loss`, `--profit`, `--warning`, `--gold` et les trois auras : valeurs
 *     claires posées sur du noir.
 *
 * ⚠️ ET C'EST INVISIBLE EN LISANT LE CSS. Une liste d'annulation incomplète
 * ressemble exactement à une liste complète ; il faut comparer les deux pour
 * voir ce qui manque. D'où ce test, qui les compare.
 */
describe("force-dark annule tout ce que le thème clair pose", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  function variablesDe(selecteur: string): string[] {
    const debut = css.indexOf(selecteur);
    expect(debut, `${selecteur} introuvable`).toBeGreaterThan(0);
    const ouvrante = css.indexOf("{", debut);
    const fermante = css.indexOf("\n}", ouvrante);
    expect(fermante).toBeGreaterThan(ouvrante);
    const corps = css.slice(ouvrante, fermante);
    return Array.from(new Set(Array.from(corps.matchAll(/^\s*(--[a-z-]+)\s*:/gm)).map((m) => m[1])));
  }

  const clair = variablesDe("html.light {");
  const sombre = variablesDe(".force-dark,");

  it("lit bien les deux listes, sinon ce test ne prouve rien", () => {
    expect(clair.length).toBeGreaterThan(15);
    expect(sombre.length).toBeGreaterThan(15);
  });

  it("chaque variable posée par le thème clair est annulée par force-dark", () => {
    const oubliees = clair.filter((v) => !sombre.includes(v));
    expect(
      oubliees,
      "variables claires qui survivent sur une page forcée en sombre : " + oubliees.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET DANS L'AUTRE SENS : une variable annulée sans que le thème clair ne
   * la pose est du bruit, et signale surtout qu'on a copié sans comprendre.
   */
  it("n'annule rien que le thème clair ne pose", () => {
    const inutiles = sombre.filter((v) => !clair.includes(v));
    expect(inutiles, "annulations sans objet : " + inutiles.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LES VALEURS SONT CELLES DU SOMBRE, pas d'autres. Redéclarer la
   * variable en gardant la valeur claire aurait passé les deux tests ci-dessus
   * sans rien corriger.
   */
  it("reprend les valeurs du thème sombre", () => {
    const valeurs = (selecteur: string) => {
      const debut = css.indexOf(selecteur);
      const ouvrante = css.indexOf("{", debut);
      const fermante = css.indexOf("\n}", ouvrante);
      const corps = css.slice(ouvrante, fermante);
      const m = new Map<string, string>();
      for (const x of corps.matchAll(/^\s*(--[a-z-]+)\s*:\s*([^;]+);/gm)) {
        m.set(x[1], x[2].trim().replace(/\s+/g, " "));
      }
      return m;
    };
    const racine = valeurs(":root {");
    const forcee = valeurs(".force-dark,");
    const fautes: string[] = [];
    for (const [nom, valeur] of Array.from(forcee)) {
      const attendue = racine.get(nom);
      if (attendue === undefined) continue;
      if (attendue !== valeur) fautes.push(`${nom} : force-dark dit « ${valeur} », le sombre dit « ${attendue} »`);
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });
});
