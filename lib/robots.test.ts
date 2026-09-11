import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import { SITE_URL } from "./seo";

/**
 * CE QUE LE PRODUIT FABRIQUE POUR ÊTRE PARTAGÉ DOIT POUVOIR ÊTRE LU.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `Disallow: /profile/` COUVRAIT AUSSI L'IMAGE DE PARTAGE DES PROFILS.
 * Le produit génère pour chaque profil public une carte sociale soignée (son
 * propre commentaire dit « turning every shared profile into an acquisition
 * surface »), et interdisait au même moment aux robots d'aperçu d'aller la
 * chercher. LinkedIn, entre autres, respecte robots.txt avant d'afficher une
 * vignette : le lien partagé sortait donc nu.
 *
 * ⚠️ LA RÈGLE DE VIE PRIVÉE RESTE : les profils eux-mêmes ne sont pas indexés.
 * C'est une décision produit écrite dans le fichier, et ce test la protège
 * autant qu'il protège l'image.
 */
describe("robots.txt", () => {
  const regle = robots().rules;
  const premiere = Array.isArray(regle) ? regle[0] : regle;
  const autorise = ([] as string[]).concat(premiere.allow ?? []);
  const interdit = ([] as string[]).concat(premiere.disallow ?? []);

  /**
   * ⚠️⚠️ LA PREMIÈRE CORRECTION ÉTAIT UNE DEMI-CORRECTION. On avait autorisé
   * l'IMAGE de partage tout en laissant `Disallow: /profile/` sur la page. Or
   * un robot d'aperçu lit D'ABORD LA PAGE pour y trouver `og:image` : lui
   * interdire la page, c'est lui interdire de découvrir l'image. Le lien
   * partagé sortait donc toujours nu.
   *
   * ⚠️⚠️ ET L'INTERDIT EMPÊCHAIT LA VIE PRIVÉE DE S'EXPRIMER : un moteur peut
   * lister une adresse interdite au crawl s'il la trouve ailleurs, en affichant
   * le lien SANS contenu. La seule consigne qu'il respecte vraiment est
   * `noindex`, et pour la lire il doit pouvoir ouvrir la page.
   */
  it("laisse les robots ouvrir un profil et sa carte de partage", () => {
    expect(autorise, "le profil est de nouveau interdit au crawl").toContain("/profile/");
    expect(interdit, "un Disallow sur /profile/ empêche de lire le noindex").not.toContain("/profile/");
  });

  /** ⚠️ Et la vie privée vit maintenant DANS LA PAGE, pas dans ce fichier. */
  it("la page du profil se déclare hors des résultats de recherche", () => {
    const source = readFileSync(
      join(process.cwd(), "app/profile/[username]/page.tsx"),
      "utf8",
    );
    expect(source, "le noindex du profil a disparu").toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("garde le tableau de bord, les API et l'authentification hors de l'index", () => {
    for (const chemin of ["/dashboard/", "/api/", "/auth/"]) {
      expect(interdit, chemin).toContain(chemin);
    }
  });

  /** ⚠️ Et il désigne le plan du site sur le domaine canonique, pas un autre. */
  it("désigne le plan du site sur le domaine canonique", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(robots().host).toBe(SITE_URL);
  });
});
