import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ADRESSE QUI N'EXISTE PAS RÉPOND 404, PAS « CONNECTE-TOI ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `/page-qui-nexiste-pas` RENVOYAIT UN VISITEUR VERS LE FORMULAIRE DE
 * CONNEXION. Le filtre d'entrée déduisait « privée » de « absente de la liste
 * blanche », et une adresse morte n'est dans aucune liste. Constaté en
 * demandant l'adresse sans session : redirection, là où `/blog/article-inexistant`
 * (dont le préfixe, lui, est listé) répondait bien 404.
 *
 * ⚠️ CE N'EST PAS QU'UNE MALADRESSE : pour un moteur de recherche, une adresse
 * morte qui redirige n'est jamais retirée de l'index ; pour un lecteur venu
 * d'un lien cassé sur un réseau social, le site demande un mot de passe pour
 * une page qui n'existe pas. C'est le contraire d'un site qui cherche à être
 * trouvé.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * La convention sur laquelle repose la correction : TOUTES les pages privées
 * vivent sous `/dashboard`. Le jour où une page privée naît ailleurs, ce test
 * échoue — et c'est exactement ce qu'on veut, parce que sinon elle serait
 * publique sans que rien ne le dise.
 */
describe("les adresses inconnues ne mènent pas à la connexion", () => {
  const middleware = () => readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

  it("le filtre distingue une page privée d'une adresse inconnue", () => {
    const src = middleware();
    expect(src).toContain("function estPrivee(");
    expect(src, "la redirection vise de nouveau tout ce qui n'est pas listé").toContain(
      "!user && !isPublicPath(pathname) && estPrivee(pathname)",
    );
  });

  /** ⚠️ Les API gardent la liste blanche : ce n'était pas le sujet. */
  it("les API restent protégées par le filtre", () => {
    expect(middleware()).toMatch(/estPrivee[\s\S]{0,200}startsWith\("\/api"\)/);
  });

  /**
   * ⚠️ LA CONVENTION, VÉRIFIÉE CONTRE L'ARBORESCENCE : une page hors
   * `/dashboard` est publique. Les exceptions sont écrites ici, chacune avec sa
   * raison, et elles sont toutes publiques PAR CONSTRUCTION (un jeton dans
   * l'URL, un pseudo public, un lien d'e-mail).
   */
  it("aucune page privée ne vit hors du tableau de bord", () => {
    const PUBLIQUES_PAR_NATURE = [
      "/", // la landing
      "/login",
      "/contact",
      "/faq",
      "/blog",
      "/blog/[slug]",
      "/trading-journal",
      "/mentions-legales",
      "/legal/terms",
      "/legal/privacy",
      "/legal/cgv",
      "/auth/reset-password", // arrive par un lien d'e-mail signé
      "/partner/join", // le collaborateur n'a pas de compte : c'est tout l'objet
      "/partner/stats/[token]", // gardée par le jeton de l'URL
      "/profile/[username]", // profil public, et seulement si son auteur l'a voulu
    ];
    const racine = join(process.cwd(), "app");
    const routes: string[] = [];
    const marcher = (d: string, chemin: string) => {
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (statSync(c).isDirectory()) {
          if (f === "api" || f === "dashboard" || f === "fonts") continue;
          marcher(c, chemin + "/" + f);
        } else if (f === "page.tsx") {
          routes.push(chemin || "/");
        }
      }
    };
    marcher(racine, "");

    const inconnues = routes
      // Le segment de langue n'est qu'un préfixe : la page dessous est la même.
      .map((r) => r.replace(/^\/\[locale\]/, "") || "/")
      .filter((r, i, tous) => tous.indexOf(r) === i)
      .filter((r) => !PUBLIQUES_PAR_NATURE.includes(r));

    expect(routes.length, "aucune page trouvée : la sonde ne cherche rien").toBeGreaterThan(10);
    expect(
      inconnues,
      "pages hors /dashboard non déclarées publiques (si l'une est privée, `estPrivee` doit la couvrir) : " +
        inconnues.join(", "),
    ).toEqual([]);
  });
});
