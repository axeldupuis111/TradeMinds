import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tradesConformes } from "./trades-conformes";

/**
 * UN NOMBRE DE TRADES NE PEUT PAS ÊTRE NÉGATIF.
 *
 * ⚠️⚠️ VU DANS L'HISTORIQUE DES ANALYSES, SUR LE COMPTE RÉEL : « -1/2 trades ».
 * Le calcul comptait UNE violation pour UN trade, alors qu'un même trade peut
 * en cumuler plusieurs. Deux trades, trois violations, et l'écran annonce moins
 * un à quelqu'un qui vient chercher un diagnostic.
 */
describe("tradesConformes", () => {
  it("compte les trades DISTINCTS cités par les violations", () => {
    // Un seul trade fautif, trois griefs contre lui.
    expect(
      tradesConformes(2, [{ trade_ids: [7] }, { trade_ids: [7] }, { trade_ids: [7] }]),
    ).toBe(1);
    expect(tradesConformes(5, [{ trade_ids: [1, 2] }, { trade_ids: [2, 3] }])).toBe(2);
  });

  it("ne descend jamais sous zéro", () => {
    // ⚠️ Le cas exact de l'écran : 2 trades, 3 violations sans recoupement.
    expect(tradesConformes(2, [{ trade_ids: [1] }, { trade_ids: [2] }, { trade_ids: [3] }])).toBe(0);
  });

  it("ne dépasse jamais le total", () => {
    expect(tradesConformes(3, [])).toBe(3);
    expect(tradesConformes(0, [])).toBe(0);
  });

  /**
   * ⚠️ LES ANCIENNES VIOLATIONS NE CITENT AUCUN TRADE : elles n'ont qu'une date
   * et une paire. Faute d'identifiants, on retombe sur l'ancien compte, mais
   * borné : mieux vaut un zéro prudent qu'un négatif impossible.
   */
  it("retombe sur l'ancien compte quand rien n'est cité, sans passer sous zéro", () => {
    expect(tradesConformes(4, [{}, {}])).toBe(2);
    expect(tradesConformes(1, [{}, {}, {}])).toBe(0);
  });

  it("mélange les deux générations de violations", () => {
    expect(tradesConformes(5, [{ trade_ids: [1, 1, 1] }, {}])).toBe(3);
  });

  /** ⚠️ Et la page enregistre bien CE calcul, sinon le test ne protège rien. */
  it("la page d'analyse enregistre ce calcul", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/analysis/page.tsx"), "utf8");
    expect(src, "l'ancien calcul est revenu").not.toContain(
      "data.total_trades - (data.violations?.length || 0)",
    );
    expect(src).toContain("tradesConformes(");
  });

  /**
   * ⚠️⚠️ CE GARDE NE PROTÉGEAIT QU'UNE PORTE SUR DEUX, PENDANT UNE SEMAINE.
   *
   * Le « −1/2 trades » a été trouvé et corrigé le 2026-09-11 — sur la page
   * d'analyse uniquement. L'IMPORT CSV, qui enregistre lui aussi un bilan (son
   * commentaire dit mot pour mot « même persistance que l'analyse manuelle »),
   * a gardé `total_trades - violations.length` jusqu'au 2026-09-18.
   *
   * Et le test, lui, ne regardait que `app/dashboard/analysis/page.tsx` : une
   * règle écrite, un garde écrit, tous deux appliqués à la moitié de ce qu'ils
   * visent. Il cherche désormais la mauvaise formule PARTOUT, et exige la
   * bonne de tout fichier qui écrit la colonne.
   */
  const SOURCES = [
    "app/dashboard/analysis/page.tsx",
    "components/trades/CsvImport.tsx",
    "lib/demo-fixtures.ts",
  ];

  it("aucune source ne recompte une violation pour un trade", () => {
    const fautives: string[] = [];
    for (const f of SOURCES) {
      const src = readFileSync(join(process.cwd(), f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      // « total_trades - … violations … .length » sous n'importe quelle forme.
      if (/total_trades\s*-\s*\(?[^;\n]*violations[^;\n]*\.length/.test(src)) fautives.push(f);
    }
    expect(
      fautives,
      "un compte de trades conformes repart sur le nombre de VIOLATIONS : " +
        "deux trades et trois violations donneront « −1 »",
    ).toEqual([]);
  });

  it("tout écran qui enregistre la colonne passe par la formule", () => {
    const sansFormule: string[] = [];
    for (const f of SOURCES) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      // Une ÉCRITURE, pas une déclaration de type (`conforming_trades?: number`).
      const ecrit = /conforming_trades:\s*(?!number)/.test(
        src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""),
      );
      if (!ecrit) continue;
      /**
       * ⚠️ `lib/demo-fixtures` est exempté et c'est délibéré : il ne compte pas
       * des violations, il construit l'ENSEMBLE des index fautifs et retranche
       * sa taille — c'est la même arithmétique que `tradesConformes`, sur des
       * données inventées où les index sont connus d'avance.
       */
      if (f === "lib/demo-fixtures.ts") continue;
      if (!src.includes("tradesConformes(")) sansFormule.push(f);
    }
    expect(
      sansFormule,
      "ces écrans enregistrent « trades conformes » sans passer par la formule partagée",
    ).toEqual([]);
  });

  /**
   * ⚠️ ET L'AFFICHAGE BORNE AUSSI : deux analyses déjà enregistrées portent un
   * `-1` en base. Réparer le calcul ne les corrige pas, et on ne réécrit pas
   * l'historique d'un trader pour faire plaisir à un compteur.
   */
  it("l'affichage de l'historique borne les valeurs déjà enregistrées", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/analysis/page.tsx"), "utf8");
    expect(src).toContain("Math.max(0, r.conforming_trades ?? 0)");
  });
});
