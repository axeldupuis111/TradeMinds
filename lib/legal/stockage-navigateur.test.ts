import { describe, expect, it } from "vitest";
import path from "node:path";
import confidentialite from "./confidentialite";
import {
  INVENTAIRE,
  REPERES_SECTION_10,
  recenserEcritures,
  type CategorieStockage,
} from "./stockage-navigateur";

/**
 * Ce test tient une obligation légale, pas une préférence de style.
 *
 * Il relie ce que le CODE écrit sur l'appareil du visiteur à ce que la
 * POLITIQUE DE CONFIDENTIALITÉ déclare. Les deux ont divergé une fois sans que
 * rien ne le signale, pendant des mois. Ils divergeront à nouveau : la seule
 * chose qui change, c'est qu'on l'apprendra en trente secondes au lieu de
 * l'apprendre par une réclamation CNIL.
 *
 * ⚠️ Vert ne prouve pas la conformité. Ce test prouve que toute écriture connue
 * est rattachée à une catégorie déclarée dans les quatre langues publiées. Il ne
 * dit rien de la base légale de chaque catégorie, en particulier de
 * « attribution », qui reste le point ouvert (voir stockage-navigateur.ts).
 */

const RACINE = path.resolve(__dirname, "..", "..");
const LANGS = ["fr", "en", "de", "es"] as const;

/** Texte brut de la section « Cookies » d'une langue, titre compris. */
function sectionStockage(lang: (typeof LANGS)[number]): string {
  const doc = confidentialite[lang];
  expect(doc, `politique absente en ${lang}`).toBeTruthy();
  const section = doc!.sections.find((s) => /^10\./.test(s.heading));
  expect(section, `section 10 introuvable en ${lang}`).toBeTruthy();
  const corps = section!.blocks.flatMap((b) => (b.kind === "ul" ? b.items : [b.text]));
  return [section!.heading, ...corps].join("\n");
}

describe("stockage sur l'appareil du visiteur", () => {
  it("n'écrit rien qui ne soit recensé", () => {
    const inconnues = recenserEcritures(RACINE)
      .filter((e) => !(e.empreinte in INVENTAIRE))
      .map((e) => e.empreinte);

    // Message volontairement bavard : celui qui le lit vient d'ajouter une
    // écriture et doit savoir quoi en faire, sans ouvrir ce fichier.
    expect(
      inconnues,
      `Nouvelle information déposée sur l'appareil du visiteur, non déclarée.\n` +
        `Ajoute chaque entrée à INVENTAIRE (lib/legal/stockage-navigateur.ts) avec sa\n` +
        `catégorie, et vérifie que la section 10 de la politique de confidentialité la\n` +
        `couvre vraiment dans les 4 langues. Si elle n'est pas strictement nécessaire au\n` +
        `service, la bonne réponse est peut-être de ne pas l'écrire :\n  ` +
        inconnues.join("\n  "),
    ).toEqual([]);
  });

  it("ne garde pas d'entrée fantôme dans l'inventaire", () => {
    // Sans ça, l'inventaire se remplit de lignes mortes et finit par décrire un
    // produit qui n'existe plus : exactement la panne qu'on répare ici.
    const reelles = new Set(recenserEcritures(RACINE).map((e) => e.empreinte));
    const fantomes = Object.keys(INVENTAIRE).filter((e) => !reelles.has(e));
    expect(
      fantomes,
      `Entrées d'inventaire qui ne correspondent à aucune écriture du code (retire-les) :\n  ` +
        fantomes.join("\n  "),
    ).toEqual([]);
  });

  it("rattache chaque écriture à une catégorie décrite dans les 4 langues", () => {
    const utilisees: CategorieStockage[] = Array.from(new Set(Object.values(INVENTAIRE)));
    expect(utilisees.length, "inventaire vide : le recensement ne tourne plus").toBeGreaterThan(0);

    for (const lang of LANGS) {
      const texte = sectionStockage(lang);
      for (const categorie of utilisees) {
        const repere = REPERES_SECTION_10[lang]?.[categorie];
        expect(repere, `repère manquant pour ${categorie} en ${lang}`).toBeTruthy();
        expect(
          texte,
          `la section 10 en ${lang} ne décrit pas la catégorie « ${categorie} »`,
        ).toContain(repere!);
      }
    }
  });

  it("ne réaffirme plus que tout est strictement nécessaire", () => {
    // La phrase d'origine ; elle couvrait d'un seul geste la langue, le thème,
    // une quinzaine de préférences et la source d'arrivée marketing.
    expect(sectionStockage("fr")).not.toContain("n'utilise que des cookies strictement nécessaires");
    expect(sectionStockage("en")).not.toContain("only uses cookies strictly necessary");
  });

  it("déclare la mesure d'audience et la provenance partenaire dans les 4 langues", () => {
    // Les deux traitements que la version précédente passait sous silence.
    const attendus: Record<(typeof LANGS)[number], string[]> = {
      fr: ["Vercel Web Analytics", "30 jours"],
      en: ["Vercel Web Analytics", "30 days"],
      de: ["Vercel Web Analytics", "30 Tage"],
      es: ["Vercel Web Analytics", "30 días"],
    };
    for (const lang of LANGS) {
      const texte = sectionStockage(lang);
      for (const attendu of attendus[lang]) {
        expect(texte, `« ${attendu} » absent de la section 10 en ${lang}`).toContain(attendu);
      }
    }
  });
});
