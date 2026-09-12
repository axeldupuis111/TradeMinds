import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { META_PAR_CHEMIN } from "./seo";

/**
 * LE TITRE D'UN ONGLET SUIT LA LANGUE DE CE QUI EST AFFICHÉ DESSOUS.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA PAGE D'ACCUEIL, CONTENU EN FRANÇAIS ET TITRE EN ANGLAIS. Dans
 * l'onglet : « TradeDiscipline: AI trading journal & discipline coach ». Dans la
 * page : « Arrête de répéter les mêmes erreurs ». La FAQ faisait pareil, ses
 * questions en français sous un titre anglais.
 *
 * ⚠️ DEUX MÉCANIQUES POUR UNE SEULE QUESTION : les métadonnées sont rendues par
 * le SERVEUR pour la langue de la ROUTE (l'anglais à la racine), le contenu est
 * rendu par le NAVIGATEUR dans la langue détectée. Personne ne les accordait.
 *
 * ⚠️ C'est la surface d'ACQUISITION : ce titre part quand le visiteur met la
 * page en favori, la partage, ou l'ajoute à son écran d'accueil.
 */
describe("le titre de l'onglet des pages publiques", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
  const LANGUES = ["fr", "en", "de", "es"] as const;

  it("existe dans les quatre langues pour chaque page du registre", () => {
    const chemins = Object.keys(META_PAR_CHEMIN);
    expect(chemins.length, "registre vide : ce test ne prouve rien").toBeGreaterThan(3);
    for (const chemin of chemins) {
      for (const langue of LANGUES) {
        const textes = META_PAR_CHEMIN[chemin][langue];
        expect(textes?.title, `${chemin} n'a pas de titre en ${langue}`).toBeTruthy();
        expect(textes?.description, `${chemin} n'a pas de description en ${langue}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️ ET LES QUATRE SONT VRAIMENT DIFFÉRENTS. Un registre où le français
   * répéterait l'anglais passerait le test ci-dessus sans rien corriger.
   */
  it("dit vraiment quelque chose de différent dans chaque langue", () => {
    /**
     * ⚠️ ON MESURE SUR LA DESCRIPTION, PAS SUR LE TITRE. « Contact -
     * TradeDiscipline » s'écrit pareil en français et en anglais, et l'exiger
     * différent forcerait à inventer une variante pour satisfaire un test. Une
     * PHRASE, elle, n'est jamais identique d'une langue à l'autre.
     */
    for (const chemin of Object.keys(META_PAR_CHEMIN)) {
      const phrases = new Set(LANGUES.map((l) => META_PAR_CHEMIN[chemin][l].description));
      expect(
        phrases.size,
        `${chemin} répète la même description dans plusieurs langues`,
      ).toBe(LANGUES.length);
    }
  });

  /**
   * ⚠️⚠️ LE REGISTRE DOIT SUIVRE L'ARBORESCENCE. Une page publique ajoutée
   * demain, servie à la racine et rendue par le contexte de langue, reprendrait
   * le défaut en silence : personne ne pense au titre de l'onglet le jour où il
   * écrit une page.
   */
  it("couvre toutes les pages publiques servies dans plusieurs langues", () => {
    function pages(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) pages(chemin, out);
        else if (f === "page.tsx") out.push(chemin);
      }
      return out;
    }

    const manquantes: string[] = [];
    for (const chemin of pages(join(process.cwd(), "app", "[locale]"))) {
      const src = lire(chemin.slice(process.cwd().length + 1));
      // Seules les pages à métadonnées par LANGUE sont concernées.
      if (!/pageMetadata\(|landingMetadata\(/.test(src)) continue;
      /**
       * ⚠️ LE CHEMIN SE DÉDUIT DU DOSSIER, pas du fichier : `[locale]/page.tsx`
       * est la racine « / », pas « /page.tsx ». Ma première version gardait le
       * nom du fichier et accusait la page d'accueil d'être absente d'un
       * registre où elle figure.
       */
      const racine = join(process.cwd(), "app", "[locale]");
      const dossier = chemin.slice(racine.length).replace(/[\\/]page\.tsx$/, "");
      const nu = dossier === "" ? "/" : dossier.split(/[\\/]/).join("/");
      if (!META_PAR_CHEMIN[nu]) manquantes.push(nu);
    }
    expect(
      manquantes,
      "pages publiques multilingues absentes du registre des titres : " + manquantes.join(", "),
    ).toEqual([]);
  });

  it("est posé par un composant monté dans la mise en page racine", () => {
    const composant = lire("components/TitreLocalise.tsx");
    expect(composant).toContain("META_PAR_CHEMIN");
    expect(composant, "le préfixe de langue n'est plus retiré du chemin").toContain(
      "replace(/^\\/(fr|en|de|es)(?=\\/|$)/",
    );
    expect(composant, "la description n'est plus accordée").toContain(
      'meta[name="description"]',
    );
    const layout = lire("app/layout.tsx");
    expect(layout, "le composant n'est plus monté").toContain("<TitreLocalise />");
    /**
     * ⚠️ DANS le fournisseur de langue, sinon il ne peut pas la lire.
     */
    expect(layout.indexOf("<TitreLocalise />")).toBeGreaterThan(layout.indexOf("<LanguageProvider"));
  });
});
