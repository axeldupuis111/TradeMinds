import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TOUTE PAGE PUBLIQUE RESTE EN SOMBRE, QUEL QUE SOIT LE THÈME DU VISITEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ EN THÈME CLAIR, LE SITE PUBLIC SE COUPAIT EN DEUX. La landing, la page
 * de connexion et les pages légales portaient `force-dark` et restaient noires.
 * La FAQ, le contact, le blog, la page « trading journal », l'inscription
 * partenaire et les profils publics, eux, suivaient le thème du visiteur : un
 * clic sur « FAQ » depuis la landing faisait passer d'un fond noir à un fond
 * blanc, avec le MÊME EN-TÊTE au-dessus des deux.
 *
 * ⚠️ L'INTENTION ÉTAIT ÉCRITE, ET DÉJÀ INCOMPLÈTE : le commentaire de
 * `globals.css` dit « public pages always stay in dark mode », puis énumère
 * trois familles de pages. Les autres sont arrivées après, et personne ne
 * relit un commentaire pour vérifier qu'il est encore vrai. Ce test, si.
 */
describe("les pages publiques gardent le même fond", () => {
  /**
   * Les vues rendues par une route publique, et rien d'autre.
   *
   * ⚠️ ON LES NOMME plutôt que de deviner : « public » n'est pas une propriété
   * qu'un fichier porte, c'est une décision de routage. Une vue ajoutée ici
   * sans `force-dark` échoue, ce qui est exactement le rappel qu'il faut.
   */
  const VUES_PUBLIQUES = [
    "components/landing/LandingPage.tsx",
    "components/legal/LegalDocView.tsx",
    "components/pages/LoginPage.tsx",
    "components/pages/ResetPasswordPage.tsx",
    "components/pages/FaqPage.tsx",
    "components/pages/ContactPage.tsx",
    "components/pages/PartnerJoinPage.tsx",
    "components/blog/BlogListView.tsx",
    "components/blog/BlogPostView.tsx",
    "components/seo/TradingJournalPage.tsx",
    "components/profile/PublicProfileView.tsx",
    "components/pages/PartnerStatsPage.tsx",
    // ⚠️ Les quatre pages légales délèguent leur mise en page à `LegalDocView`,
    // qui porte déjà `force-dark` : elles le citent donc par cette vue.
    "components/pages/LegalCgvPage.tsx",
    "components/pages/LegalPrivacyPage.tsx",
    "components/pages/LegalTermsPage.tsx",
    "components/pages/MentionsLegalesPage.tsx",
  ];

  /**
   * ⚠️ « PORTER » VEUT DIRE SOI-MÊME OU PAR LA VUE QU'ON REND. Les quatre pages
   * légales délèguent leur mise en page à `LegalDocView`, qui la porte : exiger
   * la classe dans chaque fichier ferait écrire quatre fois la même chose et
   * mentirait sur qui décide.
   */
  function porteLeFondSombre(chemin: string, vus = new Set<string>()): boolean {
    if (vus.has(chemin)) return false;
    vus.add(chemin);
    const src = readFileSync(join(process.cwd(), chemin), "utf8");
    if (src.includes("force-dark")) return true;
    for (const m of Array.from(src.matchAll(/from "@\/(components\/[^"]+)"/g))) {
      const candidat = `${m[1]}.tsx`;
      try {
        if (porteLeFondSombre(candidat, vus)) return true;
      } catch {
        // Import qui n'est pas un fichier .tsx : rien à suivre.
      }
    }
    return false;
  }

  it("chaque vue publique porte force-dark, elle-même ou par la vue qu'elle rend", () => {
    const sans = VUES_PUBLIQUES.filter((chemin) => !porteLeFondSombre(chemin));
    expect(sans, "vues publiques qui suivent le thème du visiteur : " + sans.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LA LISTE NE MENT PAS PAR OMISSION. Toute page sous `app/` qui n'est
   * ni le tableau de bord, ni une route d'API, rend une de ces vues : si une
   * route publique nouvelle rend une vue absente de la liste, on le dit.
   */
  it("aucune route publique ne rend une vue hors de cette liste", () => {
    const PRIVE = /^app[\\/](dashboard|api)\b/;
    const routes: string[] = [];
    (function parcourir(d: string) {
      for (const f of readdirSync(d)) {
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (f === "page.tsx" && !PRIVE.test(chemin)) routes.push(chemin);
      }
    })("app");
    expect(routes.length).toBeGreaterThan(5);

    const connues = new Set(VUES_PUBLIQUES.map((v) => v.split(/[\\/]/).pop()!.replace(".tsx", "")));
    const inconnues: string[] = [];
    for (const route of routes) {
      const src = readFileSync(route, "utf8");
      const rendus = Array.from(src.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)).map((m) => m[1]);
      // Une route qui ne rend aucune vue nommée (page écrite sur place) est
      // vérifiée par son propre contenu.
      const nommees = rendus.filter((r) => /(Page|View)$/.test(r));
      if (nommees.length === 0) {
        if (!src.includes("force-dark") && !/redirect\(|notFound\(/.test(src)) {
          inconnues.push(`${route} : page écrite sur place, sans force-dark`);
        }
        continue;
      }
      for (const nom of nommees) {
        if (!connues.has(nom)) inconnues.push(`${route} rend ${nom}, absent de la liste`);
      }
    }
    expect(inconnues, inconnues.join(" | ")).toEqual([]);
  });
});
