import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { groupNum, setPdfLocale } from "./kit";

/**
 * UN PDF ÉCRIT SES NOMBRES DANS LA LANGUE DE SON LECTEUR.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE FRANÇAIS ÉTAIT CODÉ EN DUR dans le formateur du kit PDF : espace pour
 * les milliers, virgule pour les décimales, quelle que soit la langue du
 * document. Un rapport anglais écrivait donc « 1 234,50 » là où il faut
 * « 1,234.50 », un allemand « 1.234,50 ». C'est le même défaut que le
 * `.replace(".", ",")` trouvé à l'écran une heure plus tôt, vu depuis l'autre
 * côté : il donne le bon résultat pour qui l'écrit, et personne à Paris ne le
 * remarque.
 *
 * ⚠️ ET LA RAISON DU CALCUL À LA MAIN TENAIT, ELLE, ce qui explique qu'il ait
 * survécu : `Intl` pose une ESPACE FINE INSÉCABLE (U+202F) entre les milliers
 * en français, et les polices standard d'un PDF ne l'ont pas dans leur
 * encodage WinAnsi. Le remède ne pouvait donc pas être « appeler Intl » tout
 * court.
 */
describe("les nombres d'un PDF suivent sa langue", () => {
  it("groupe et sépare selon la langue du document", () => {
    setPdfLocale("fr-FR");
    expect(groupNum(1234.5, 2)).toBe("1 234,50");
    setPdfLocale("en-GB");
    expect(groupNum(1234.5, 2)).toBe("1,234.50");
    setPdfLocale("de-DE");
    expect(groupNum(1234.5, 2)).toBe("1.234,50");
  });

  it("garde le français par défaut, langue de rédaction du produit", () => {
    setPdfLocale(undefined);
    expect(groupNum(1234567, 0)).toBe("1 234 567");
  });

  /**
   * ⚠️⚠️ TOUT DOIT TENIR EN WINANSI : une police standard de PDF n'a ni espace
   * fine insécable ni signe moins typographique. Un caractère hors encodage ne
   * fait pas échouer la génération, il sort en glyphe parasite au milieu d'un
   * montant — le genre de défaut qu'on ne voit qu'en ouvrant le fichier.
   */
  it("n'écrit que des caractères qu'une police standard sait rendre", () => {
    for (const locale of ["fr-FR", "en-GB", "de-DE", "es-ES"]) {
      setPdfLocale(locale);
      for (const valeur of [1234.5, -1234.5, 1234567.89, 0, -0.5]) {
        const rendu = groupNum(valeur, 2);
        const exotiques = Array.from(rendu).filter((c) => c.charCodeAt(0) > 126);
        expect(exotiques, `${locale} · ${valeur} → ${JSON.stringify(rendu)}`).toEqual([]);
      }
    }
    setPdfLocale("fr-FR");
  });

  /** ⚠️ Et les trois générateurs posent bien la langue avant d'écrire. */
  it("chaque générateur pose la langue du document", () => {
    for (const chemin of ["lib/analysis-pdf.ts", "lib/analytics-pdf.ts", "lib/export-pdf.ts"]) {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(src, chemin).toMatch(/setPdfLocale\(/);
    }
  });
});
