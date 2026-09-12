import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIX_EN_CENTIMES, prixLisible, prixParJour } from "./prix";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN PRIX S'ÉCRIT DANS LA LANGUE DU LECTEUR, ET IL N'Y A QU'UNE TABLE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MÊME PRIX S'ÉCRIVAIT DE DEUX FAÇONS SUR LE MÊME ÉCRAN : « 14.99€ » sur
 * la carte Plus (point anglais) et « 29,99€ » sur la carte Premium (virgule
 * française), l'une sous l'autre. Le prix annuel s'écrivait « 134.90€ » sous un
 * mensuel « 11.24€ ».
 *
 * ⚠️ ET TROIS TABLES DE PRIX COEXISTAIENT : les cartes de la page d'abonnement,
 * son libellé de changement de plan, et la landing, qui en avait sa propre copie
 * avec le point anglais partout, sur une page servie en français.
 *
 * ⚠️ C'est le nombre que le visiteur lit AVANT de payer, sur la surface
 * d'acquisition. Un prix mal écrit ne coûte pas une incompréhension, il coûte
 * une hésitation.
 */
describe("les prix de l'abonnement", () => {
  it("s'écrivent dans la convention de chaque langue", () => {
    const fr = prixLisible(PRIX_EN_CENTIMES.plus.mensuel, "fr-FR");
    const en = prixLisible(PRIX_EN_CENTIMES.plus.mensuel, "en-US");
    expect(fr, "le français n'utilise plus la virgule").toContain("14,99");
    expect(en, "l'anglais n'utilise plus le point").toContain("14.99");
    expect(fr, "les deux langues écrivent la même chose").not.toBe(en);
  });

  /**
   * ⚠️ LE MONTANT NE CHANGE PAS AVEC LA LANGUE, seule son écriture change :
   * Stripe débite des euros, quel que soit le lecteur.
   */
  it("restent des euros dans toutes les langues", () => {
    for (const locale of ["fr-FR", "en-US", "de-DE", "es-ES"]) {
      const ecrit = prixLisible(PRIX_EN_CENTIMES.premium.mensuel, locale);
      expect(ecrit, `devise perdue en ${locale}`).toMatch(/€|EUR/);
      expect(ecrit.replace(/\s/g, ""), `montant faux en ${locale}`).toMatch(/29[.,]99/);
    }
  });

  /**
   * ⚠️ LE COÛT PAR JOUR EST DÉRIVÉ, JAMAIS RECOPIÉ. « 0.49€/jour » était écrit à
   * la main à côté de « 14.99€/mois » : deux nombres pour le même fait, dont
   * l'un cesse d'être vrai le jour où l'autre change.
   */
  it("dérivent le coût par jour du prix mensuel", () => {
    expect(prixParJour(PRIX_EN_CENTIMES.plus.mensuel, "fr-FR").replace(/\s/g, "")).toMatch(/0[.,]50/);
    expect(prixParJour(PRIX_EN_CENTIMES.premium.mensuel, "fr-FR").replace(/\s/g, "")).toMatch(/1[.,]00/);
  });

  /**
   * LA LANGUE EST OBLIGATOIRE, ET C'EST CE QUI PROTÈGE LA PAGE D'ACCUEIL.
   *
   * ⚠️⚠️ ELLE ÉTAIT FACULTATIVE et retombait sur `langueCourante()`, qui n'a
   * pas de document à lire côté serveur et répond « fr-FR » par un repli
   * assumé. Les DIX appels du produit l'omettaient. À une requête
   * `accept-language: en`, le serveur rendait donc `lang="en"` avec
   * « 14,99 € », virgule française comprise, dans la grille des tarifs : le
   * nombre que le visiteur lit avant de payer, et ce qu'indexe un moteur.
   *
   * ⚠️ Corriger les dix appels aurait laissé le onzième arriver. Le paramètre
   * est devenu obligatoire : l'oubli ne compile plus. Ce test dit pourquoi, et
   * échouerait si quelqu'un le rendait à nouveau facultatif « pour simplifier ».
   */
  it("exige la langue, elle ne se devine pas", () => {
    /**
     * ⚠️ SANS LES COMMENTAIRES : le commentaire qui EXPLIQUE la correction cite
     * forcément le nom de la fonction fautive. Sans ce filtre, le garde
     * échouait sur le fichier corrigé, c'est-à-dire qu'il constatait qu'on
     * PARLE de `langueCourante` et non qu'on l'appelle.
     */
    const source = sansCommentaires(
      readFileSync(join(process.cwd(), "lib/prix.ts"), "utf8"),
    );
    expect(
      source,
      "la langue est redevenue facultative : les appels serveur retomberont sur " +
        "le français, et personne ne le verra en développant en français",
    ).not.toMatch(/locale\?:/);
    expect(
      source,
      "prix.ts relit la langue ambiante au lieu de la recevoir",
    ).not.toContain("langueCourante");
  });

  /**
   * ⚠️⚠️ ET PLUS AUCUNE TABLE PARALLÈLE. Le balayage vise les écrans, pas les
   * commentaires ni les articles de blog, où citer un prix dans une phrase est
   * normal.
   */
  it("ne sont plus écrits à la main dans un écran", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }

    /** Les montants exacts de l'abonnement, écrits en clair. */
    const EN_DUR = /["'`>]\s*(?:14|29)[.,](?:99)\s*€|["'`>]\s*(?:134|269)[.,](?:90)\s*€/;
    const fautes: string[] = [];
    for (const racine of ["app", "components"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        // ⚠️ L'admin est le tableau de bord d'Axel : il y lit des coûts, pas des
        // tarifs, et ses montants sont calculés depuis la facturation réelle.
        if (chemin.includes(join("dashboard", "admin"))) continue;
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        if (EN_DUR.test(src)) fautes.push(chemin.split(/[\\/]/).slice(-2).join("/"));
      }
    }
    expect(
      fautes,
      "prix écrits à la main, donc figés dans une langue : " + fautes.join(", "),
    ).toEqual([]);
  });
});
