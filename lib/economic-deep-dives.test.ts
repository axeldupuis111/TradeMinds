import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEEP_DIVES, deepDiveIds, isGlossaryId, lookupDeepDive } from "./economic-deep-dives";
import type { GlossaryLang } from "./economic-glossary";

const LANGS: GlossaryLang[] = ["fr", "en", "de", "es"];

describe("les explications longues du calendrier", () => {
  /**
   * ⚠️ UNE LEÇON SOUS UN IDENTIFIANT INCONNU N'EST LUE PAR PERSONNE. La
   * résolution passe par `indicatorId`, qui ne rend que des identifiants du
   * glossaire : une faute de frappe dans une clé (« retails_sales ») produit un
   * fichier parfaitement valide que rien ne va jamais chercher. Le contenu
   * serait écrit, relu, traduit, et invisible.
   */
  it("chaque leçon correspond à un indicateur du glossaire", () => {
    const orphelines = deepDiveIds().filter((id) => !isGlossaryId(id));
    expect(orphelines, `leçons sans indicateur : ${orphelines.join(", ")}`).toEqual([]);
  });

  it("chaque leçon est complète dans les quatre langues", () => {
    for (const [id, record] of Object.entries(DEEP_DIVES)) {
      for (const lang of LANGS) {
        const dive = record[lang];
        expect(dive, `${id} n'a pas de version ${lang}`).toBeTruthy();
        expect(dive.sections.length, `${id}/${lang} : trop peu de sections`).toBeGreaterThanOrEqual(3);
        expect(dive.outcomes.length, `${id}/${lang} : il faut au moins deux issues`).toBeGreaterThanOrEqual(2);
        expect(dive.watch.length, `${id}/${lang} : aucun point pratique`).toBeGreaterThanOrEqual(3);
        for (const section of dive.sections) {
          expect(section.heading.trim().length, `${id}/${lang} : titre de section vide`).toBeGreaterThan(0);
          // Une section d'une ligne n'est pas un cours, c'est le résumé qu'on
          // avait déjà : c'est exactement ce que cette page devait dépasser.
          expect(section.body.length, `${id}/${lang} : section trop courte (${section.heading})`).toBeGreaterThan(160);
        }
        for (const outcome of dive.outcomes) {
          expect(outcome.label.trim().length, `${id}/${lang} : issue sans intitulé`).toBeGreaterThan(0);
          expect(outcome.body.length, `${id}/${lang} : issue non expliquée`).toBeGreaterThan(40);
        }
      }
    }
  });

  /**
   * Toutes les langues doivent découper la leçon de la même façon : une langue
   * à trois sections et une autre à quatre, c'est un produit différent selon
   * l'endroit d'où on le lit.
   */
  it("les quatre langues ont la même structure", () => {
    for (const [id, record] of Object.entries(DEEP_DIVES)) {
      const forme = (lang: GlossaryLang) =>
        `${record[lang].sections.length}/${record[lang].outcomes.length}`;
      for (const lang of LANGS) {
        expect(forme(lang), `${id} : structure divergente en ${lang}`).toBe(forme("fr"));
      }
    }
  });

  it("se résout depuis un titre du flux", () => {
    expect(lookupDeepDive("Non-Farm Employment Change", "fr")).toBeTruthy();
    expect(lookupDeepDive("Core CPI m/m", "en")).toBeTruthy();
    expect(lookupDeepDive("German Flash Manufacturing PMI", "de")).toBeTruthy();
    // Annonce rare : pas de leçon, et c'est le comportement voulu.
    expect(lookupDeepDive("Bank Holiday", "fr")).toBeNull();
  });

  /**
   * ⚠️ PAS DE TIRET LONG DANS LA COPIE. La règle vaut pour tout ce qui est
   * écrit au nom du produit, et ce module en est la plus grosse contribution
   * récente : quatre langues de texte rédigé d'un coup.
   */
  it("aucun tiret long dans le contenu", () => {
    const dossier = join(process.cwd(), "lib/economic-deep-dives");
    for (const nom of readdirSync(dossier)) {
      if (!nom.endsWith(".ts")) continue;
      // Les COMMENTAIRES d'abord : la règle vise la copie lue par le trader,
      // pas la documentation interne, qui en emploie partout dans ce dépôt.
      // Sans ce nettoyage le garde échoue sur du contenu parfaitement propre,
      // et un test qui crie à tort finit par être ignoré.
      const source = readFileSync(join(dossier, nom), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(source.includes("—"), `tiret long dans ${nom}`).toBe(false);
    }
  });
});
