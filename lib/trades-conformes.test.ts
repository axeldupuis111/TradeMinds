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
   * ⚠️ ET L'AFFICHAGE BORNE AUSSI : deux analyses déjà enregistrées portent un
   * `-1` en base. Réparer le calcul ne les corrige pas, et on ne réécrit pas
   * l'historique d'un trader pour faire plaisir à un compteur.
   */
  it("l'affichage de l'historique borne les valeurs déjà enregistrées", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/analysis/page.tsx"), "utf8");
    expect(src).toContain("Math.max(0, r.conforming_trades ?? 0)");
  });
});
