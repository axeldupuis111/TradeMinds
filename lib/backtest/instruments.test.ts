import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "./instruments";

/**
 * ⚠️⚠️ LA COMPILATION DEMANDAIT AU MODÈLE UNE FRACTION D'UN NOMBRE QU'ELLE NE
 * LUI DONNAIT PAS. La règle du prompt dit qu'une tolérance de trendline vaut
 * environ un millième du prix ; la route ne lui envoyait que le spread. Vu à
 * l'écran, sur l'or : « une tolérance de 0,5 point (un millième du prix
 * approximativement) » — cinq fois trop petit, avec une justification qui
 * affirmait le contraire.
 */
describe("l'ordre de grandeur du prix", () => {
  it("est posé sur chaque instrument", () => {
    const sans = INSTRUMENTS.filter((i) => !(i.prixIndicatif > 0));
    expect(sans.map((i) => i.code), "sans prix indicatif").toEqual([]);
  });

  /**
   * ⚠️ ON NE VÉRIFIE PAS UNE COTATION, ON VÉRIFIE UN ORDRE DE GRANDEUR : la
   * seule erreur qui compte ici est le facteur mille. Un spread qui dépasse le
   * prix, ou un prix des millions de fois plus grand que son spread, trahit une
   * unité confondue.
   */
  it("reste cohérent avec le spread de l'instrument", () => {
    for (const i of INSTRUMENTS) {
      const rapport = i.prixIndicatif / i.spread;
      expect(rapport, `${i.code} : prix ${i.prixIndicatif}, spread ${i.spread}`).toBeGreaterThan(50);
      expect(rapport, `${i.code} : prix ${i.prixIndicatif}, spread ${i.spread}`).toBeLessThan(200000);
    }
  });
});
