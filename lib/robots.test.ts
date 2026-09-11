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

  it("garde les profils hors de l'index", () => {
    expect(interdit, "la règle de vie privée a disparu").toContain("/profile/");
  });

  it("laisse passer l'image de partage d'un profil", () => {
    expect(autorise).toContain("/profile/*/opengraph-image");
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
