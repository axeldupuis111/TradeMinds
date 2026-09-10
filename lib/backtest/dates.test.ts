import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enDate, enDateEtHeure } from "./dates";

/**
 * LES DATES SUIVENT LA LANGUE DE L'APPLICATION, PAS CELLE DU NAVIGATEUR.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, INTERFACE EN ANGLAIS : sur la fiche d'un aperçu,
 * « Direction : Buy · Date : 02/01/2025 10:45 ». Le 2 janvier, écrit dans un
 * ordre que n'importe quel lecteur anglophone lit « February 1st ». Toute la
 * page était traduite ; sept appels à `toLocaleDateString()` SANS ARGUMENT
 * demandaient la langue du navigateur, qui n'a aucune raison d'être celle que
 * le trader a choisie dans l'application.
 *
 * ⚠️ ET TROIS DE CES DATES PARTAIENT DANS SA FICHE DE STRATÉGIE, c'est-à-dire
 * dans un texte que le coach relit et que le trader garde. Le format d'un
 * document qu'il conserve dépendait du navigateur avec lequel il l'a écrit.
 *
 * ⚠️ CE DÉFAUT EST INVISIBLE TANT QU'ON DÉVELOPPE DANS SA PROPRE LANGUE : le
 * navigateur et l'application disent alors la même chose, et tout va bien.
 */
describe("les dates de l'onglet", () => {
  const JOUR = Date.UTC(2025, 0, 2, 10, 45);

  it("changent de forme avec la langue", () => {
    expect(enDate(JOUR, "fr")).toBe("02/01/2025");
    expect(enDate(JOUR, "en")).toBe("1/2/2025");
    // ⚠️ Le mois d'abord en anglais, le jour d'abord en français : c'est
    // exactement l'ambiguïté que le défaut produisait.
    expect(enDate(JOUR, "fr")).not.toBe(enDate(JOUR, "en"));
  });

  it("gardent la minute quand elles portent une heure", () => {
    expect(enDateEtHeure(JOUR, "fr")).toContain("2025");
    expect(enDateEtHeure(JOUR, "fr")).toMatch(/[0-9]{2}:[0-9]{2}/);
  });

  /**
   * ⚠️ ET AUCUN AUTRE ENDROIT DE L'ONGLET NE DEMANDE LA LANGUE DU NAVIGATEUR.
   * Un `toLocaleDateString()` sans argument est exactement le défaut d'origine.
   */
  it("aucun format de date ne s'en remet au navigateur", () => {
    const racine = process.cwd();
    const dossiers = [
      join(racine, "app/dashboard/backtest"),
      join(racine, "components/backtest"),
      join(racine, "lib/backtest"),
    ];
    const SANS_LANGUE = /toLocale(Date|Time)?String\(\s*(\)|undefined)/;
    const LIGNES = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
    const fautes: string[] = [];
    for (const d of dossiers) {
      for (const f of readdirSync(d)) {
        if (!/\.tsx?$/.test(f) || f.includes(".test.") || f === "dates.ts") continue;
        const source = readFileSync(join(d, f), "utf8");
        source.split(LIGNES).forEach((ligne, i) => {
          if (SANS_LANGUE.test(ligne)) fautes.push(`${f}:${i + 1} ${ligne.trim().slice(0, 80)}`);
        });
      }
    }
    expect(fautes, "dates qui suivent le navigateur : " + fautes.join(" | ")).toEqual([]);
  });

  /** ⚠️ Garde sur le garde : sans fichiers lus, il ne prouve rien. */
  it("lit bien les fichiers de l'onglet", () => {
    const n = readdirSync(join(process.cwd(), "components/backtest")).length;
    expect(n).toBeGreaterThan(10);
  });
});
