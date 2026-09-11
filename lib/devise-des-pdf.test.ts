import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UN PDF PORTE LA DEVISE DE CE QU'IL RACONTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX RAPPORTS SUR TROIS ÉCRIVAIENT DES EUROS SUR TOUT. Le symbole du kit
 * PDF est une variable de MODULE, posée par le rapport de compte et remise à
 * null après lui : le rapport ANALYTICS et le rapport d'ANALYSE IA ne la
 * posaient jamais. Leurs montants sortaient donc en « € » quelle que soit la
 * devise du compte, y compris quand l'écran, juste avant l'export, les
 * affichait en « $ ».
 *
 * ⚠️ ET C'EST LA PIRE SURFACE POUR CE DÉFAUT. Un PDF quitte l'app : le trader
 * le garde, l'imprime, l'envoie à son mentor ou à sa prop firm. C'est la seule
 * chose qu'un lecteur ne peut pas recouper avec l'écran d'à côté. Le même
 * raisonnement avait déjà servi pour la carte sociale du profil public.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout générateur qui écrit un montant pose son symbole AVANT le premier
 * nombre, et le rend à null après : il partage la variable avec les autres.
 */
describe("les rapports PDF", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  /**
   * ⚠️ LE BALAYAGE EST LA PARTIE UTILE : nommer les trois générateurs connus ne
   * dirait rien du quatrième. Tout fichier qui importe `money` du kit écrit des
   * montants, donc doit poser son symbole.
   */
  const GENERATEURS = [
    "lib/analytics-pdf.ts",
    "lib/analysis-pdf.ts",
    "lib/export-pdf.ts",
  ];

  it("écrivent tous des montants, sinon ce test ne prouve rien", () => {
    for (const chemin of GENERATEURS) {
      const src = lire(chemin);
      expect(src, `${chemin} n'écrit plus de montant`).toMatch(/\b(money|signedMoney)\(/);
    }
  });

  /**
   * ⚠️ LA POSITION DANS LE FICHIER NE PROUVE RIEN, et ma première version de ce
   * test le croyait : elle comparait l'index du `setMoneySymbol` à celui du
   * premier `money(`, alors que ce premier `money(` vit dans une fonction
   * auxiliaire déclarée en haut et APPELÉE tout en bas. L'ordre du texte n'est
   * pas l'ordre d'exécution.
   *
   * Ce qui se vérifie vraiment : le symbole se pose au même endroit que la
   * LOCALE, qui porte exactement la même contrainte (« avant le premier nombre
   * écrit ») et que ces trois fichiers respectent déjà.
   */
  it("posent leur symbole là où ils posent leur locale", () => {
    for (const chemin of GENERATEURS) {
      const src = lire(chemin);
      expect(src, `${chemin} ne pose pas son symbole`).toContain("setMoneySymbol(");
      const lignes = src.split(/\r?\n/);
      const iLocale = lignes.findIndex((l) => l.includes("setPdfLocale("));
      const iSymbole = lignes.findIndex((l) => l.includes("setMoneySymbol("));
      /**
       * ⚠️ DEUX ARRANGEMENTS SONT JUSTES, et exiger le premier seul accuserait
       * `export-pdf.ts` à tort : il pose son symbole dans l'enveloppe, JUSTE
       * AVANT d'appeler la construction. Les deux disent la même chose, « avant
       * le premier montant » ; c'est ça qu'on vérifie, pas une mise en page.
       */
      const iAppel = lignes.findIndex((l) => /await build\w*Pdf\(/.test(l));
      const aupresDeLaLocale = iLocale >= 0 && Math.abs(iSymbole - iLocale) < 6;
      const avantLaConstruction = iAppel > 0 && iSymbole >= 0 && iSymbole < iAppel;
      expect(
        aupresDeLaLocale || avantLaConstruction,
        `${chemin} pose son symbole ni auprès de sa locale ni avant la construction : rien ne garantit qu'il précède le premier montant`,
      ).toBe(true);
    }
  });

  /**
   * ⚠️ ET LE REND À NULL. Sans ça, le premier rapport contamine le suivant :
   * exporter un compte en dollars puis une analyse ferait sortir l'analyse en
   * dollars, quel que soit son contenu.
   */
  it("rendent le symbole après usage", () => {
    for (const chemin of GENERATEURS) {
      expect(lire(chemin), `${chemin} garde le symbole pour lui`).toContain(
        "setMoneySymbol(null)",
      );
    }
  });

  it("reçoivent bien une devise de leur appelant", () => {
    expect(lire("app/dashboard/analysis/page.tsx"), "l'analyse IA n'envoie pas sa devise").toContain(
      "currency: displayCurrency,",
    );
    expect(lire("app/dashboard/analytics/page.tsx"), "Analytics n'envoie pas sa devise").toContain(
      "currency={devisesMelangees ? null : pageCurrency}",
    );
  });

  /**
   * ⚠️⚠️ ET ON N'EXPORTE PAS UN TOTAL EN DEVISES MÊLÉES. Refuser est ici plus
   * honnête qu'avertir : l'avertissement reste à l'écran, le PDF part.
   */
  it("refusent d'exporter une sélection qui mêle les devises", () => {
    const src = lire("components/analytics/ExportPdfButton.tsx");
    expect(src).toContain("if (devisesMelangees) {");
    expect(src).toContain('alert(t("pdf_devises_melangees"));');
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["pdf_devises_melangees"];
      expect(texte, `pdf_devises_melangees manque en ${nom}`).toBeTruthy();
      expect(texte.length).toBeGreaterThan(40);
    }
  });
});
