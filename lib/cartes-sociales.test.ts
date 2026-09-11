import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * CE QU'ON PROMET EN MÉTADONNÉES, ON LE FOURNIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LES ARTICLES DU BLOG DÉCLARAIENT `twitter: { card: "summary_large_image" }`
 * ET N'AVAIENT AUCUNE IMAGE. Partagé sur X, LinkedIn, Discord ou WhatsApp, un
 * article s'affichait en lien nu, sans vignette — sur un blog qui existe pour
 * faire venir des gens, et dont la vignette est la seule chose qu'un lecteur
 * voit avant de cliquer. Constaté en demandant l'image : 404.
 *
 * ⚠️ LA LANDING ET LES PROFILS PUBLICS AVAIENT LA LEUR. Deux surfaces de
 * partage sur trois : encore une règle appliquée à une partie de ce qu'elle
 * vise.
 */
describe("les pages partageables ont leur carte sociale", () => {
  const racine = join(process.cwd(), "app");

  /** Les segments qui déclarent une grande carte Twitter. */
  const PROMETTEURS = [
    { segment: "blog/[slug]", declare: "lib/blog/seo.ts" },
    { segment: "[locale]/blog/[slug]", declare: "lib/blog/seo.ts" },
    { segment: "profile/[username]", declare: "app/profile/[username]/page.tsx" },
  ];

  it("chaque segment qui promet une grande carte en fabrique une", () => {
    const manquants: string[] = [];
    for (const { segment, declare } of PROMETTEURS) {
      const source = readFileSync(join(process.cwd(), declare), "utf8");
      if (!/summary_large_image/.test(source)) continue;
      if (!existsSync(join(racine, segment, "opengraph-image.tsx"))) manquants.push(segment);
    }
    expect(manquants, "segments sans image sociale : " + manquants.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LE DESSIN N'EST PAS RECOPIÉ : les deux routes du blog partagent la
   * même carte. Deux copies auraient divergé au premier changement de couleur,
   * et personne ne regarde une carte sociale deux fois.
   */
  it("les deux routes du blog partagent le même dessin", () => {
    for (const segment of ["blog/[slug]", "[locale]/blog/[slug]"]) {
      const src = readFileSync(join(racine, segment, "opengraph-image.tsx"), "utf8");
      expect(src, segment).toContain("carteDArticle");
    }
  });

  /**
   * ⚠️ UNE IMAGE GÉNÉRÉE SUR L'EDGE N'A NI CSS NI POLICE DU PROJET : tout y est
   * écrit en style en ligne. Ce test n'en juge pas l'esthétique, seulement le
   * fait qu'elle déclare bien ce que Next attend d'elle, faute de quoi la route
   * répond 404 sans que rien ne le signale.
   */
  it("chaque image déclare sa taille, son type et son texte de remplacement", () => {
    function images(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) images(chemin, out);
        else if (f === "opengraph-image.tsx") out.push(chemin);
      }
      return out;
    }
    const trouvees = images(racine);
    expect(trouvees.length, "aucune image sociale trouvée").toBeGreaterThan(2);
    for (const chemin of trouvees) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      expect(src, `${nom} : size`).toMatch(/export const size/);
      expect(src, `${nom} : contentType`).toMatch(/export const contentType/);
      expect(src, `${nom} : alt`).toMatch(/export const alt/);
    }
  });
});
