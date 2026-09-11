import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CHAQUE PAGE PUBLIQUE A UN CONTENU PRINCIPAL, ET UN MOYEN D'Y SAUTER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE LIEN « ALLER AU CONTENU PRINCIPAL » N'EXISTAIT QUE DANS LE TABLEAU DE
 * BORD. La landing, la FAQ, le blog, le contact, les pages légales et les deux
 * pages partenaires n'en avaient pas : au clavier, il fallait traverser tout
 * l'en-tête à chaque page avant d'atteindre le texte.
 *
 * ⚠️ ET SEPT DE CES VUES N'AVAIENT AUCUN REPÈRE `<main>`, donc aucun endroit où
 * sauter même si le lien avait existé. La règle était écrite une fois,
 * appliquée d'un seul côté du produit : c'est la forme qui revient le plus
 * souvent dans ce dépôt.
 *
 * ⚠️ LE LIEN EST INVISIBLE TANT QU'IL N'A PAS LE FOCUS (`sr-only`) : aucun
 * effet sur la mise en page, ce qui est exactement pourquoi personne ne
 * remarquait son absence.
 */
describe("les pages publiques ont un repère de contenu principal", () => {
  /**
   * Les vues rendues par une route publique.
   *
   * ⚠️ MÊME LISTE QUE `pages-publiques.test.ts`, et pour la même raison :
   * « publique » est une décision de routage, pas une propriété qu'un fichier
   * porte. Une vue ajoutée ici sans repère échoue, ce qui est le rappel qu'il
   * faut.
   */
  const VUES = [
    "components/landing/LandingPage.tsx",
    "components/seo/TradingJournalPage.tsx",
    "components/blog/BlogListView.tsx",
    "components/blog/BlogPostView.tsx",
    "components/legal/LegalDocView.tsx",
    "components/pages/FaqPage.tsx",
    "components/pages/ContactPage.tsx",
    "components/pages/PartnerJoinPage.tsx",
    "components/pages/PartnerStatsPage.tsx",
  ];

  it("chaque vue publique nomme sa cible de saut", () => {
    const sans: string[] = [];
    for (const chemin of VUES) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      if (!source.includes('id="main-content"')) sans.push(chemin);
    }
    expect(sans, "vues sans cible de saut : " + sans.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LA CIBLE DOIT POUVOIR RECEVOIR LE FOCUS. Sans `tabIndex={-1}`, le
   * navigateur déplace bien le défilement mais PAS le focus clavier : la
   * tabulation suivante repart du haut de l'en-tête, c'est-à-dire que le lien
   * n'a rien fait. C'est le piège classique du lien de saut.
   */
  it("la cible peut recevoir le focus", () => {
    const sans: string[] = [];
    for (const chemin of VUES) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      const i = source.indexOf('id="main-content"');
      if (i < 0) continue;
      // Dans la même balise : on s'arrête au `>` qui la ferme.
      const balise = source.slice(Math.max(0, i - 200), source.indexOf(">", i) + 1);
      if (!/tabIndex=\{-1\}/.test(balise)) sans.push(chemin);
    }
    expect(sans, "cibles qui ne prennent pas le focus : " + sans.join(", ")).toEqual([]);
  });

  it("l'en-tête public porte le lien de saut", () => {
    const source = readFileSync(join(process.cwd(), "components/PublicHeader.tsx"), "utf8");
    expect(source).toContain('href="#main-content"');
    expect(source).toContain('t("a11y_skip_to_content")');
    // ⚠️ Invisible hors focus : sinon il change la mise en page de tout le site.
    expect(source).toContain("sr-only focus:not-sr-only");
  });

  /** ⚠️ Et le tableau de bord garde le sien : c'est de lui que vient la règle. */
  it("le tableau de bord garde son lien de saut", () => {
    const source = readFileSync(join(process.cwd(), "app/dashboard/layout.tsx"), "utf8");
    expect(source).toContain('href="#main-content"');
    expect(source).toContain('<main id="main-content" tabIndex={-1}');
  });
});
