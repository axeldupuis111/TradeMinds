import { describe, expect, it } from "vitest";
import { recapitulatif, pnlNet } from "./recapitulatif";

/**
 * LE COACH ET L'ÉCRAN COMPTENT PAREIL.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE COACH RÉPONDAIT « 24 GAGNANTS SUR 60, SOIT 40 % » PENDANT QUE LA PAGE
 * AFFICHAIT « 85 trades · WR 45,9 % ». Mesuré en lui posant la question la plus
 * banale qui soit. Ce n'était pas une invention : aucun outil du catalogue ne
 * rendait les totaux, il n'avait que `find_trades`, plafonné à soixante lignes,
 * et il a compté son échantillon en le disant honnêtement. Ça ne suffit pas :
 * le trader a lu deux chiffres pour le même fait, à un clic d'écart.
 *
 * ── LES TROIS CONVENTIONS QUI DOIVENT RESTER COMMUNES ───────────────────────
 */
describe("le récapitulatif du journal", () => {
  it("compte le P&L NET, frais et swap compris", () => {
    expect(pnlNet({ pnl: 100, commission: -7, swap: -3 })).toBe(90);
    expect(pnlNet({ pnl: 100 })).toBe(100);
    expect(pnlNet({ pnl: null })).toBe(0);
  });

  /** ⚠️ Un trade à zéro net n'est PAS un gagnant : c'est la règle du bandeau. */
  it("ne compte gagnant qu'un net strictement positif", () => {
    const r = recapitulatif([{ pnl: 10 }, { pnl: 0 }, { pnl: -5 }, { pnl: 7, commission: -7 }]);
    expect(r.gagnants).toBe(1);
    expect(r.perdants).toBe(3);
  });

  /** ⚠️ Le taux se rapporte au TOTAL, pas aux seuls trades décidés. */
  it("rapporte le taux de réussite au total des trades clôturés", () => {
    const r = recapitulatif([{ pnl: 10 }, { pnl: 10 }, { pnl: -1 }, { pnl: -1 }]);
    expect(r.trades).toBe(4);
    expect(r.tauxDeReussite).toBe(50);
  });

  it("ne divise pas par zéro sur un journal vide", () => {
    const r = recapitulatif([]);
    expect(r).toEqual({
      trades: 0, gagnants: 0, perdants: 0, tauxDeReussite: 0, pnlNet: 0, meilleur: 0, pire: 0,
    });
  });

  it("rend le meilleur et le pire en NET", () => {
    const r = recapitulatif([{ pnl: 50, commission: -60 }, { pnl: 20 }, { pnl: -3 }]);
    expect(r.meilleur).toBe(20);
    expect(r.pire).toBe(-10);
  });
});

/**
 * ⚠️ ET LE COACH A BIEN DE QUOI RÉPONDRE. Sans cet outil, sa seule source
 * était un échantillon plafonné : le garde tient l'existence de l'outil ET
 * l'ordre qui lui interdit de recompter à la main.
 */
describe("l'outil qui donne les totaux au coach", () => {
  it("existe, dit de ne pas recompter, et passe par le calcul partagé", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "lib/coach-tools.ts"), "utf8");
    expect(src).toContain('name: "get_journal_summary"');
    expect(src, "rien n'interdit au coach de recompter depuis find_trades").toMatch(
      /find_trades[^"]*échantillon/,
    );
    expect(src, "les totaux ne passent pas par le calcul partagé").toContain("recapitulatif(lignes)");
    expect(src, "lecture non paginée : au-delà de mille trades le total serait faux").toMatch(
      /get_journal_summary[\s\S]{0,900}fetchAllRows/,
    );
  });
});
