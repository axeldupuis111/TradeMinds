import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE PAGE TRADUITE N'ÉCRIT PAS SES PHRASES EN DUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PROFIL PUBLIC ÉTAIT ENTIÈREMENT EN ANGLAIS : « Total Trades »,
 * « Sessions reviewed », « 0 days of discipline », « Create your TradeDiscipline
 * profile » — sur un produit traduit en quatre langues, et avec l'avertissement
 * de risque en bas de page, lui, en français. Deux langues sur la même page.
 *
 * ⚠️ ET C'EST LA VITRINE : c'est la page qu'un trader partage, celle par
 * laquelle quelqu'un découvre le produit. Le bouton « crée ton profil » juste
 * en dessous ne veut rien dire pour qui ne lit pas l'anglais.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Pas « aucune chaîne en dur nulle part » : les libellés techniques, les codes
 * de devise, les noms de marque sont légitimes. La règle porte sur les vues
 * NOMMÉES ICI — celles dont on a vérifié qu'elles s'adressent à un lecteur — et
 * sur les phrases assez longues pour être de la prose.
 */
describe("les vues traduites ne parlent pas anglais en dur", () => {
  /**
   * Les vues relues, et le nombre de phrases en dur qu'on y tolère.
   *
   * ⚠️ ZÉRO PARTOUT, ET C'EST VOULU : un plancher non nul ne se justifie que
   * ligne par ligne, et il faudrait alors les écrire.
   */
  const VUES = [
    "components/profile/PublicProfileView.tsx",
    "components/pages/FaqPage.tsx",
    "components/pages/ContactPage.tsx",
    "components/pages/LoginPage.tsx",
    "components/pages/ResetPasswordPage.tsx",
    "components/pages/PartnerJoinPage.tsx",
    "components/pages/PartnerStatsPage.tsx",
    "components/seo/TradingJournalPage.tsx",
    "components/blog/BlogListView.tsx",
    "components/blog/BlogPostView.tsx",
    "components/legal/LegalDocView.tsx",
    "components/landing/LandingPage.tsx",
  ];

  /**
   * Une phrase de prose : au moins quatre mots dont un article ou un verbe
   * anglais courant, dans un texte JSX ou un attribut `title`.
   *
   * ⚠️ ON NE CHERCHE PAS « un mot anglais » : « Discipline », « Winrate » et
   * « Trades » sont du vocabulaire de trading, employé tel quel en français.
   * C'est la PHRASE qui trahit une page non traduite.
   */
  const PROSE = /(?:>|title=")\s*([A-Za-z]+(?:\s+[A-Za-z]+[.,!]?){3,})/g;

  for (const chemin of VUES) {
    it(`aucune phrase anglaise en dur dans ${chemin.split("/").pop()}`, () => {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
      const fautes: string[] = [];
      source.split(SAUT).forEach((ligne, i) => {
        const nu = ligne.trim();
        if (nu.startsWith("*") || nu.startsWith("//") || nu.startsWith("/*")) return;
        PROSE.lastIndex = 0;
        let m;
        while ((m = PROSE.exec(ligne))) fautes.push(`${i + 1} : « ${m[1].trim()} »`);
      });
      expect(fautes, "phrases en dur : " + fautes.join(" | ")).toEqual([]);
    });
  }

  /** ⚠️ Garde sur le garde : le motif reconnaît bien une phrase anglaise. */
  it("le motif attrape une phrase, pas un mot de vocabulaire", () => {
    const attrape = (s: string) => {
      PROSE.lastIndex = 0;
      return PROSE.test(s);
    };
    expect(attrape(`<p>Track your trades. Master your discipline.</p>`)).toBe(true);
    expect(attrape(`title="One of the first 100 members"`)).toBe(true);
    // Du vocabulaire de trading employé tel quel : ce n'est pas de la prose.
    expect(attrape(`<p>Winrate</p>`)).toBe(false);
    expect(attrape(`<p>{t("pubprofile_total_trades")}</p>`)).toBe(false);
  });
});
