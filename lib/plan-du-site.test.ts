import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "../app/sitemap";
import { SITE_URL } from "./seo";

/**
 * ON NE DEMANDE PAS À GOOGLE D'INDEXER CE QU'ON LUI INTERDIT D'INDEXER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PLAN DU SITE SOUMETTAIT `/login` DANS QUATRE LANGUES, alors que cette
 * page se déclare `noindex` depuis la passe sur les métadonnées. Un plan du
 * site qui propose une page marquée « ne pas indexer » demande deux choses
 * opposées : la Search Console le signale en erreur, et cette erreur-là masque
 * les vraies.
 *
 * ⚠️ C'EST MOI QUI AI CRÉÉ LA CONTRADICTION : le `noindex` est de cette passe,
 * l'entrée du plan était là avant. Une correction qui ne regarde pas ce qui
 * dépendait de l'ancien état en fabrique une nouvelle — c'est la troisième fois
 * dans cette session.
 */
describe("le plan du site", () => {
  const entrees = sitemap();

  it("ne propose que des adresses du site canonique", () => {
    const etrangeres = entrees.map((e) => e.url).filter((u) => !u.startsWith(SITE_URL));
    expect(etrangeres, "adresses hors du site : " + etrangeres.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ LA LISTE DES PAGES `noindex` SE LIT DANS LE CODE, pas ici : c'est
   * `lib/seo.ts` qui décide, et ce test ne fait que vérifier qu'aucune d'elles
   * n'a été soumise. Recopier la liste en ferait une troisième vérité.
   */
  it("ne soumet aucune page déclarée noindex", () => {
    const seo = readFileSync(join(process.cwd(), "lib", "seo.ts"), "utf8");
    const cheminsNoindex: string[] = [];
    for (const m of Array.from(
      seo.matchAll(/chemin:\s*"([^"]+)"[^}]*indexer:\s*false/g),
    )) {
      cheminsNoindex.push(m[1]);
    }
    // Les appels vivent dans les pages : on relit aussi leurs déclarations.
    for (const fichier of ["app/login/page.tsx", "app/auth/reset-password/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), fichier), "utf8");
      const m = /chemin:\s*"([^"]+)"[\s\S]{0,160}indexer:\s*false/.exec(src);
      if (m) cheminsNoindex.push(m[1]);
    }
    expect(cheminsNoindex.length, "aucune page noindex trouvée : le motif ne cherche rien").toBeGreaterThan(0);

    const soumises = entrees.map((e) => e.url);
    const fautes = cheminsNoindex.filter((chemin) =>
      soumises.some((u) => u === `${SITE_URL}${chemin}` || /\/(fr|de|es)/.test(u.replace(SITE_URL, "")) && u.endsWith(chemin)),
    );
    expect(
      fautes,
      "pages noindex proposées au référencement : " + fautes.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Et il contient bien ce qu'on veut voir indexé, sinon il ne sert à rien. */
  it("propose la landing, la FAQ et les articles du blog", () => {
    const urls = entrees.map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/faq`);
    expect(urls.filter((u) => u.includes("/blog/")).length).toBeGreaterThan(20);
  });
});
