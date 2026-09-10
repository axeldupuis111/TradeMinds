import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";

/**
 * LA PONCTUATION D'UNE LANGUE NE S'ÉCRIT PAS DANS LE CODE.
 *
 * ── LES DEUX DÉFAUTS, VUS À L'ÉCRAN EN ANGLAIS ──────────────────────────────
 *
 * ⚠️⚠️ « Set by you : 10 · Deduced from measurement : 3 · To be written : 5 ».
 * L'espace avant le deux-points est une règle FRANÇAISE ; en anglais elle est
 * simplement fausse. Le deux-points n'était pas dans la traduction, il était
 * tapé dans le JSX et dans le texte copié : la même ponctuation pour quatre
 * langues qui n'ont pas les mêmes.
 *
 * ⚠️⚠️ « You only take positions on these days: L M M J V ». Les initiales des
 * jours étaient écrites en dur en français, dans le document que le trader
 * emporte. Cinq lettres qui ne veulent rien dire pour un lecteur anglophone —
 * exactement le défaut déjà corrigé pour les noms de marchés (« Or »,
 * « Argent »), qui sortaient eux aussi tels quels dans les quatre langues.
 *
 * ⚠️ CES DEUX-LÀ SONT INVISIBLES TANT QU'ON DÉVELOPPE EN FRANÇAIS. Il a fallu
 * piloter l'onglet en anglais pour les voir, et c'est la troisième famille de
 * défauts que ce pilotage-là a rendue visible, après les dates.
 */
describe("la ponctuation vient de la langue", () => {
  const DOSSIERS = ["app/dashboard/backtest", "components/backtest", "lib/backtest"];

  /**
   * Ce qui a le droit d'écrire « : » en dur, et pourquoi.
   *
   * ⚠️ UNE SEULE ENTRÉE, ET CE N'EST PAS DE LA TYPOGRAPHIE. `fiche-plan.ts`
   * écrit ce séparateur dans la fiche du trader ET le relit pour retrouver
   * l'intitulé de chaque réponse : c'est un FORMAT DE STOCKAGE. Le traduire
   * rendrait illisibles toutes les fiches écrites dans une autre langue, y
   * compris les siennes s'il en change.
   */
  const FORMAT_DE_STOCKAGE = new Set(["fiche-plan.ts"]);

  function lignesDeLOnglet(): { fichier: string; ligne: string; n: number }[] {
    const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
    const out: { fichier: string; ligne: string; n: number }[] = [];
    for (const d of DOSSIERS) {
      for (const f of readdirSync(join(process.cwd(), d))) {
        if (!/\.tsx?$/.test(f) || f.includes(".test.")) continue;
        if (FORMAT_DE_STOCKAGE.has(f)) continue;
        readFileSync(join(process.cwd(), d, f), "utf8")
          .split(SAUT)
          .forEach((ligne, i) => {
            const t = ligne.trim();
            if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return;
            out.push({ fichier: f, ligne, n: i + 1 });
          });
      }
    }
    return out;
  }

  it("lit bien les fichiers de l'onglet, sinon ce test ne prouve rien", () => {
    expect(lignesDeLOnglet().length).toBeGreaterThan(2000);
  });

  /**
   * ⚠️ ON NE CHERCHE QUE LES DEUX FORMES QUI COLLENT UN TEXTE À UN AUTRE :
   * `{a} : {b}` en JSX et `${a} : ${b}` dans un gabarit. Un « ? … : … » de
   * TypeScript contient lui aussi « : », et un garde qui les confondrait
   * signalerait une centaine de lignes justes, donc s'apprendrait à ignorer.
   */
  it("aucun deux-points à la française n'est tapé dans le code", () => {
    // `{a} : {b}`, `{a} : <span…`, `${a} : ${b}`, `{a} : texte` : les quatre
    // façons de coller un deux-points français à ce qui suit.
    const COLLE = /\}\s:\s(\$?\{|<|[A-Za-zÀ-ÿ0-9«"])/;
    /**
     * ⚠️ ET ON ÉCARTE LES TERNAIRES, qui portent le même « } : { » quand leurs
     * deux branches sont des objets. Le signe distinctif est le point
     * d'interrogation qui les ouvre : sans lui, cinq lignes parfaitement justes
     * étaient accusées, et un garde qui accuse à tort s'apprend à ignorer.
     */
    const fautes = lignesDeLOnglet()
      .filter(({ ligne }) => {
        const m = COLLE.exec(ligne);
        return m != null && !ligne.slice(0, m.index).includes("?");
      })
      .map(({ fichier, n, ligne }) => `${fichier}:${n} ${ligne.trim().slice(0, 80)}`);
    expect(
      fautes,
      "ponctuation française tapée dans le code : " + fautes.join(" | "),
    ).toEqual([]);
  });

  it("et le séparateur existe dans les quatre langues", () => {
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      const sep = (dico as Record<string, string>).bt_deux_points;
      expect(sep, `bt_deux_points en ${nom}`).toBeTruthy();
      expect(sep, `bt_deux_points en ${nom}`).toContain(":");
    }
    // ⚠️ Et le français est le seul à mettre une espace AVANT : sans cette
    // différence, la clé ne servirait à rien.
    expect((fr as Record<string, string>).bt_deux_points).toMatch(/^\s:/);
    expect((en as Record<string, string>).bt_deux_points).not.toMatch(/^\s:/);
  });

  /**
   * ⚠️ LES INITIALES DES JOURS VIENNENT DE LA TRADUCTION, dans les quatre
   * langues, et l'onglet n'en écrit aucune en dur.
   */
  it("les jours de la semaine sont traduits", () => {
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      for (let j = 0; j <= 6; j++) {
        expect((dico as Record<string, string>)[`bt_jour_${j}`], `bt_jour_${j} en ${nom}`).toBeTruthy();
      }
    }
  });

  it("aucune table d'initiales de jours n'est écrite en dur", () => {
    const EN_DUR = /\["D", "L", "M", "M", "J", "V", "S"\]|label: "L"/;
    const fautes = lignesDeLOnglet()
      .filter(({ ligne }) => EN_DUR.test(ligne))
      .map(({ fichier, n }) => `${fichier}:${n}`);
    expect(fautes, "initiales de jours en dur : " + fautes.join(", ")).toEqual([]);
  });
});
