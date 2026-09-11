import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nombre, pourcent } from "./nombres";

/**
 * LES NOMBRES S'ÉCRIVENT DANS LA LANGUE DU LECTEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LE SUIVI DE COMPTE : « 8 967 € / 4 000 € · 100.0% ». Le montant est
 * écrit à la française, le pourcentage à l'anglaise, sur la même ligne. Une
 * quinzaine d'endroits faisaient pareil : « WR 64.5% », « -12.3 % », « 4.5/7 ».
 *
 * ⚠️ LA CAUSE EST TOUJOURS LA MÊME : `toFixed()` n'est pas un formateur, c'est
 * une troncature anglaise. Il rend « 64.5 » dans les quatre langues.
 *
 * ⚠️ ET LA PAGE ABONNEMENT ÉCRIVAIT « fr-FR » EN DUR dans son `Intl.NumberFormat` :
 * un abonné anglophone y lisait « 14,99 € » là où sa langue écrit « €14.99 ».
 */
describe("les nombres suivent la langue", () => {
  /**
   * ⚠️ ON N'ÉPINGLE PAS LE CARACTÈRE D'ESPACE. Le séparateur de milliers
   * français est une espace insécable dont le point de code a déjà changé d'une
   * version d'ICU à l'autre (U+00A0 puis U+202F) : un test qui l'épingle casse à
   * la mise à jour de Node sans qu'aucun défaut existe. Ce qui compte est le
   * SÉPARATEUR DÉCIMAL, et qu'il change bien avec la langue.
   */
  const sansEspaces = (x: string) => x.replace(/\s/g, "");

  it("le séparateur décimal change avec la langue", () => {
    expect(sansEspaces(nombre(1234.5, 1, "fr-FR"))).toBe("1234,5");
    expect(nombre(1234.5, 1, "en-US")).toBe("1,234.5");
    expect(nombre(1234.5, 1, "de-DE")).toBe("1.234,5");
  });

  it("garde les décimales demandées, même nulles", () => {
    expect(nombre(1, 2, "fr-FR")).toBe("1,00");
    expect(nombre(1.005, 0, "fr-FR")).toBe("1");
  });

  /**
   * ⚠️ LE SYMBOLE EST POSÉ PAR LA LANGUE, pas collé à la main : le français met
   * une espace insécable avant le « % », l'anglais non. `${x}%` donnait
   * « 64,5% », qui est une faute en français.
   */
  it("le pourcentage porte l'espace que veut la langue", () => {
    // Le français sépare le nombre du signe, l'anglais le colle.
    expect(sansEspaces(pourcent(64.5, 1, "fr-FR"))).toBe("64,5%");
    expect(pourcent(64.5, 1, "fr-FR")).not.toBe("64,5%");
    expect(pourcent(64.5, 1, "en-US")).toBe("64.5%");
    expect(sansEspaces(pourcent(100, 1, "fr-FR"))).toBe("100,0%");
    expect(pourcent(0, 0, "en-US")).toBe("0%");
  });

  it("prend un pourcentage, pas une fraction", () => {
    // Le piège d'Intl : `style: percent` attend 0,645 pour « 64,5 % ».
    expect(pourcent(50, 0, "en-US")).toBe("50%");
  });

  /**
   * ⚠️⚠️ ET AUCUN POURCENTAGE N'EST PLUS BÂTI À LA MAIN. C'est la moitié qui
   * compte : la règle existait déjà pour les montants (`money`), et personne ne
   * l'avait étendue aux pourcentages.
   */
  it("aucun composant n'écrit un pourcentage à la main", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    /**
     * Un `toFixed` avec des décimales, immédiatement suivi d'un « % ».
     *
     * ⚠️ LES DÉCIMALES COMPTENT : `toFixed(0)` ne produit pas de séparateur, il
     * n'y a donc rien à corriger, et l'exiger ferait un garde qu'on contourne.
     * Le « % » peut être écrit tel quel ou en entité HTML.
     */
    const MOTIF = /toFixed\(\s*[1-9]\s*\)\s*\}?\s*(&nbsp;)?\s*%/;
    /**
     * Et la forme sans décimale : `{x}%` ou `${x} %`.
     *
     * ⚠️⚠️ LES DEUX CONVENTIONS COEXISTAIENT DANS LE MÊME PRODUIT : cinquante
     * endroits écrivaient `{x}%` (règle anglaise) et une douzaine `{x} %`
     * (règle française). Sur Analytics, « 63,1 % » et « WR 53% » se lisaient sur
     * le même écran. Deux conventions codées en dur, c'est la preuve qu'aucune
     * n'est décidée : c'est la langue qui décide, donc `Intl`.
     */
    const A_LA_MAIN = /\$?\{[^{}]+\}\s?%/;
    /**
     * ⚠️ UNE LARGEUR CSS N'EST PAS UN POURCENTAGE LU PAR QUELQU'UN. `left: "12.34%"`
     * doit rester en notation machine : le formater à la française donnerait une
     * valeur CSS invalide. On écarte donc les propriétés de position et de taille.
     */
    const CSS = /width:|left:|top:|right:|bottom:|height:|strokeDash|flexBasis|translate|background:|gradient|const width/;
    /**
     * ⚠️ L'IMAGE DE PARTAGE N'A PAS DE LECTEUR CONNU. Elle est rendue par le
     * serveur pour un robot social, sans langue de visiteur : `pourcent()` y
     * retomberait sur le français pour le monde entier. C'est la seule
     * exception, et elle est écrite.
     */
    const SANS_LECTEUR = /opengraph-image/;
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      if (SANS_LECTEUR.test(chemin)) continue;
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          if (CSS.test(ligne)) return;
          if (MOTIF.test(ligne) || A_LA_MAIN.test(ligne)) fautes.push(`${nom}:${i + 1}`);
        });
    }
    expect(
      fautes,
      "pourcentages écrits à la main (voir lib/nombres.ts) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Et personne ne fige une langue dans un formateur. */
  it("aucun Intl ne code une langue en dur", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    const MOTIF = /new Intl\.\w+\(\s*"(fr|en|es|de)(-[A-Z]{2})?"/;
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          if (MOTIF.test(ligne)) fautes.push(`${nom}:${i + 1}`);
        });
    }
    expect(fautes, "langue figée dans un formateur : " + fautes.join(", ")).toEqual([]);
  });
});
