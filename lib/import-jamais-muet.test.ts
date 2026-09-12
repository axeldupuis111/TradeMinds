import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UN FICHIER ILLISIBLE N'EST PAS UN FICHIER VIDE.
 *
 * ── CE QUE LE TRADER VOYAIT ─────────────────────────────────────────────────
 *
 * L'import d'historique est le premier geste de valeur du produit : sans
 * trades, rien ne fonctionne. Trois échecs très différents y étaient confondus,
 * ou pire, silencieux :
 *
 *   - un `.xlsx` qu'on n'a pas su ouvrir → « Aucun trade détecté dans le
 *     fichier », c'est-à-dire qu'on annonçait à quelqu'un que son historique
 *     était vide alors qu'on n'avait pas su le lire ;
 *   - un CSV illisible → RIEN. La branche CSV n'avait ni `reader.onerror` ni
 *     garde autour de l'analyse : le trader déposait son fichier et l'écran ne
 *     bougeait pas.
 *
 * ⚠️⚠️ Au 2026-09-12, 18 des 21 inscrits du mois n'avaient jamais importé un
 * seul trade. Un écran qui ne répond rien quand on lui donne un fichier est
 * exactement ce qui produit ce chiffre, et c'est invisible côté serveur.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Trois situations, trois messages, parce que le trader n'a pas les mêmes
 * choses à faire : refermer le fichier, le réexporter, ou constater qu'il est
 * vraiment vide.
 */
describe("l'import d'historique", () => {
  const src = sansCommentaires(
    readFileSync(join(process.cwd(), "components/trades/CsvImport.tsx"), "utf8"),
  );

  it("distingue « illisible » de « vide »", () => {
    expect(
      src,
      "aucun message pour un fichier qu'on n'a pas su lire : il repassera pour un fichier vide",
    ).toContain("csv_unreadable");
    expect(
      src,
      "aucun message pour un fichier lu mais incompris",
    ).toContain("csv_parse_failed");
  });

  it("ne répond plus « aucun trade » à une exception de lecture", () => {
    /**
     * ⚠️ On vérifie qu'aucun `catch` n'affiche encore `csv_no_trades` : c'est
     * la forme exacte du défaut. Le message reste légitime AILLEURS, quand le
     * fichier a bien été analysé et ne contient rien.
     */
    const catchs = src.split("catch").slice(1);
    const fautifs = catchs.filter((bloc) => /csv_no_trades/.test(bloc.slice(0, 260)));
    expect(
      fautifs.length,
      "un bloc catch annonce encore « aucun trade détecté » pour un échec de lecture",
    ).toBe(0);
  });

  it("écoute l'échec du lecteur de fichier", () => {
    expect(
      src,
      "reader.onerror n'est pas branché : un CSV illisible ne produira aucun message",
    ).toMatch(/reader\.onerror\s*=/);
  });

  it("garde l'analyse du CSV, pas seulement celle du XLSX", () => {
    /**
     * ⚠️ La règle était appliquée à une seule des deux branches : le XLSX avait
     * un `try/catch`, le CSV n'en avait pas. C'est la forme la plus fréquente
     * des défauts de ce dépôt.
     */
    const debut = src.indexOf("reader.onload");
    expect(debut, "la branche CSV a disparu").toBeGreaterThan(-1);

    /**
     * ⚠️⚠️ ON COMPTE LES ACCOLADES, ON NE PREND PAS « LES 400 CARACTÈRES QUI
     * SUIVENT ». La première version de ce test faisait exactement ça, et le
     * `catch` du bloc VOISIN (celui qui entoure `readAsText`) le rendait vert
     * alors que l'analyse n'était plus gardée du tout. Une fenêtre en nombre de
     * caractères n'est jamais une frontière : ce dépôt l'a déjà payé trois
     * fois, et ce test vient d'être le quatrième.
     */
    let i = src.indexOf("{", debut);
    const ouverture = i;
    let prof = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") prof++;
      else if (src[i] === "}" && --prof === 0) break;
    }
    const corps = src.slice(ouverture, i);

    expect(corps.length, "découpage raté : le corps est vide").toBeGreaterThan(30);
    expect(
      corps,
      "l'analyse du CSV n'est pas gardée : une exception s'y perdra sans un mot",
    ).toContain("catch");
  });

  it("les deux messages existent dans les quatre langues", () => {
    const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };
    for (const [langue, dico] of Object.entries(DICOS)) {
      for (const cle of ["csv_unreadable", "csv_parse_failed", "csv_no_trades"]) {
        expect(dico[cle], `${cle} manque en ${langue}`).toBeTruthy();
      }
      // ⚠️ Et ils ne disent pas la même chose : trois messages identiques
      // vaudraient un seul message.
      expect(dico.csv_unreadable).not.toBe(dico.csv_parse_failed);
      expect(dico.csv_unreadable).not.toBe(dico.csv_no_trades);
    }
  });

  it("chaque message dit quoi faire", () => {
    // Un message d'erreur qui ne propose rien laisse le trader devant un mur,
    // et c'est justement l'écran où le produit les perd.
    for (const dico of [fr, en, de, es] as Record<string, string>[]) {
      for (const cle of ["csv_unreadable", "csv_parse_failed"]) {
        expect(dico[cle].length, `${cle} est trop court pour dire quoi faire`).toBeGreaterThan(60);
      }
    }
  });

  it("aucun tiret long dans ces messages", () => {
    // Convention du produit : jamais de « — » dans un texte écrit au nom d'Axel.
    for (const dico of [fr, en, de, es] as Record<string, string>[]) {
      for (const cle of ["csv_unreadable", "csv_parse_failed"]) {
        expect(dico[cle], `${cle} contient un tiret long`).not.toContain("—");
      }
    }
  });
});
