import { describe, expect, it } from "vitest";
import { niveauStandard } from "./blocs-standards";
import { instrumentParCode, INSTRUMENTS } from "./instruments";


/**
 * ⚠️⚠️ L'ÉPAISSEUR D'UN TRAIT SE MESURE SUR LE PRIX, PAS SUR LE SPREAD. Ce
 * réglage valait `spread × 2` : 0,5 point sur l'or, 3 points sur le Nasdaq.
 * Une droite tracée à la main a une épaisseur de l'ordre du millième du prix,
 * et une tolérance six fois trop fine ne confirme presque aucune droite.
 *
 * ⚠️ LE PROMPT DE COMPILATION PORTAIT DÉJÀ CETTE RÈGLE, mesurée sur quatre ans
 * de Nasdaq, et le code standard disait le contraire. Deux sources de vérité
 * pour le même réglage, et c'est celle que personne ne relisait qui gagnait.
 */
describe("la tolérance d'une trendline", () => {
  const tol = (code: string) => {
    const i = instrumentParCode(code)!;
    const n = niveauStandard("trendline", i);
    if (!n || n.type !== "trendline") throw new Error("pas une trendline");
    return { points: n.toleranceTicks * i.tailleTick, instrument: i };
  };

  it("vaut environ un millième du prix, sur chaque instrument", () => {
    for (const i of INSTRUMENTS) {
      const { points } = tol(i.code);
      const attendu = i.prixIndicatif / 1000;
      expect(points, `${i.code} : ${points} points pour un prix de ${i.prixIndicatif}`).toBeCloseTo(
        attendu,
        Math.abs(attendu) < 1 ? 2 : 0,
      );
    }
  });

  /**
   * ⚠️ ET ELLE NE SUIT PLUS LE SPREAD : sur l'or le spread vaut 0,25, donc
   * l'ancien réglage rendait 0,5. Le garde échouerait si on y revenait.
   */
  it("ne retombe pas sur l'ancienne échelle du spread", () => {
    const { points, instrument } = tol("XAUUSD");
    expect(points).not.toBeCloseTo(instrument.spread * 2, 2);
    expect(points).toBeGreaterThan(instrument.spread * 4);
  });

  /**
   * ⚠️ JAMAIS ZÉRO : à zéro, un creux devrait tomber exactement sur la droite,
   * ce qui n'arrive jamais. C'est la règle 5c du prompt de compilation, et elle
   * vaut aussi pour le réglage standard.
   */
  it("n'est jamais nulle", () => {
    for (const i of INSTRUMENTS) expect(tol(i.code).points).toBeGreaterThan(0);
  });
});
