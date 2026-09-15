import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UN EXPORT QUI ÉCHOUE LE DIT.
 *
 * ── CE QUE LE TRADER VOYAIT ─────────────────────────────────────────────────
 *
 * Il clique sur « Exporter PDF ». Le bouton passe en « Génération… », puis
 * revient à son état normal. Aucun fichier n'arrive. Rien n'est affiché.
 *
 * Les deux `catch` concernés ne faisaient qu'un `console.error`, et le
 * `finally` remettait le bouton en place : côté trader, l'échec est
 * indiscernable d'un clic qui n'a pas pris. Sur une fonctionnalité réservée
 * aux plans payants, c'est un abonné qui paie pour un bouton muet.
 *
 * ── LA RÈGLE ÉTAIT ÉCRITE, APPLIQUÉE À UN EXPORT SUR TROIS ──────────────────
 *
 * ⚠️⚠️ `components/analytics/ExportPdfButton.tsx` affichait déjà `t("pdf_error")`
 * en cas d'échec, et la clé existe dans les quatre langues depuis toujours. Le
 * bilan mensuel et l'analyse IA, eux, se taisaient. Ce n'était donc pas une
 * convention absente : c'était une convention tenue au tiers.
 */
describe("les exports PDF", () => {
  const EXPORTS = [
    { fichier: "components/analytics/ExportPdfButton.tsx", nom: "Analytics" },
    { fichier: "app/dashboard/review/page.tsx", nom: "Bilan mensuel" },
    { fichier: "app/dashboard/analysis/page.tsx", nom: "Analyse IA" },
  ] as const;

  /** Le corps d'un `catch`, découpé en comptant les accolades. */
  function corpsDesCatch(src: string): string[] {
    const out: string[] = [];
    const MOTIF = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = MOTIF.exec(src)) !== null) {
      let j = src.indexOf("{", m.index);
      const debut = j;
      let prof = 0;
      for (; j < src.length; j++) {
        if (src[j] === "{") prof++;
        else if (src[j] === "}" && --prof === 0) break;
      }
      out.push(src.slice(debut + 1, j));
      MOTIF.lastIndex = j;
    }
    return out;
  }

  for (const { fichier, nom } of EXPORTS) {
    it(`${nom} : l'échec de l'export est dit au trader`, () => {
      const src = sansCommentaires(readFileSync(join(process.cwd(), fichier), "utf8"));

      /**
       * ⚠️ ON DÉCOUPE LE `catch` QUI ENTOURE L'EXPORT, on ne cherche pas
       * `pdf_error` n'importe où dans le fichier : une page de 2000 lignes en
       * contient d'autres, et le garde passerait au vert sans rien vérifier.
       */
      const catchs = corpsDesCatch(src).filter((c) => /PDF|pdf/.test(c));
      expect(
        catchs.length,
        "aucun catch d'export PDF trouvé : le découpage a changé",
      ).toBeGreaterThan(0);

      const muets = catchs.filter((c) => !/pdf_error/.test(c));
      expect(
        muets.length,
        "un export PDF échoue sans un mot : le bouton redevient normal, aucun " +
          "fichier n'arrive, et le trader ne sait pas pourquoi. La clé " +
          "« pdf_error » existe dans les quatre langues.",
      ).toBe(0);
    });
  }

  it("le message existe dans les quatre langues", () => {
    for (const [langue, dico] of Object.entries({ fr, en, de, es } as Record<string, Record<string, string>>)) {
      expect(dico.pdf_error, `pdf_error manque en ${langue}`).toBeTruthy();
      // Convention du produit : jamais de tiret long dans un texte au nom d'Axel.
      expect(dico.pdf_error).not.toContain("—");
    }
  });
});
