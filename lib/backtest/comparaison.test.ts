import { describe, expect, it } from "vitest";
import { comparerMesures, ecartsDeReglages, type MesureVersion } from "./comparaison";
import type { Modification } from "./modifications";

const P = { de: "2025-01", a: "2025-12" };

/** Une mesure à partir de son espérance et de sa demi-largeur d'intervalle. */
function mesure(esperanceR: number, marge: number, trades = 400): MesureVersion {
  return {
    trades,
    esperanceR,
    borneBasse: esperanceR - marge,
    borneHaute: esperanceR + marge,
  };
}

describe("deux versions sont-elles seulement distinguables", () => {
  /**
   * ⚠️ LE CAS QUI JUSTIFIE TOUT L'ÉCRAN. +0,12 R contre +0,31 R ressemble à un
   * gouffre. Avec leurs intervalles, c'est la même chose mesurée deux fois, et
   * c'est le renseignement le plus utile qu'une comparaison puisse donner.
   */
  it("refuse de séparer deux résultats dont les intervalles se recouvrent", () => {
    const c = comparerMesures(mesure(0.31, 0.25), mesure(0.12, 0.25), P, P);
    expect(c.verdict).toBe("indistinguables");
    expect(c.ecartR).toBeCloseTo(0.19, 6);
    expect(c.ecartBasse!).toBeLessThan(0);
    expect(c.ecartHaute!).toBeGreaterThan(0);
  });

  it("reconnaît un écart qui tient hors de zéro", () => {
    const c = comparerMesures(mesure(0.9, 0.05), mesure(0.1, 0.05), P, P);
    expect(c.verdict).toBe("un_ecart_mesurable");
    expect(c.ecartBasse!).toBeGreaterThan(0);
  });

  /**
   * ⚠️ ON COMPOSE LES DEUX INCERTITUDES, ON NE REGARDE PAS LES INTERVALLES SE
   * CHEVAUCHER. C'est l'erreur de lecture la plus répandue, et elle se trompe
   * dans les DEUX sens :
   *
   * - deux intervalles qui se recouvrent laissent croire à « aucune
   *   différence », alors que l'écart peut très bien tenir hors de zéro ;
   * - deux moyennes éloignées laissent croire à un écart, alors que
   *   l'incertitude de la différence est plus large que chacune des deux.
   *
   * Seul le calcul sur la différence tranche.
   */
  it("ne se contente pas de regarder si les deux intervalles se recouvrent", () => {
    // [0,30 ; 0,70] et [0,00 ; 0,40] : ils se chevauchent franchement...
    const c = comparerMesures(mesure(0.5, 0.2), mesure(0.2, 0.2), P, P);
    // ... et pourtant l'écart tient hors de zéro.
    expect(c.verdict).toBe("un_ecart_mesurable");
    // L'intervalle de la différence est plus large que chacun des deux.
    expect(c.ecartHaute! - c.ecartBasse!).toBeGreaterThan(0.4);
  });

  it("et rapproche deux moyennes que tout semblait séparer", () => {
    // 0,05 R contre 0,45 R : neuf fois plus, à l'œil. Indistinguables.
    const c = comparerMesures(mesure(0.45, 0.3), mesure(0.05, 0.3), P, P);
    expect(c.verdict).toBe("indistinguables");
  });

  it("ne conclut rien quand l'une des deux n'a pas de chiffre", () => {
    const sans: MesureVersion = { trades: 12, esperanceR: null, borneBasse: null, borneHaute: null };
    expect(comparerMesures(mesure(0.5, 0.1), sans, P, P).verdict).toBe("sans_chiffre");
    expect(comparerMesures(sans, mesure(0.5, 0.1), P, P).verdict).toBe("sans_chiffre");
  });

  it("ne conclut rien non plus sur un intervalle plat", () => {
    const plat: MesureVersion = { trades: 1, esperanceR: 1, borneBasse: 1, borneHaute: 1 };
    expect(comparerMesures(plat, mesure(0.5, 0.1), P, P).verdict).toBe("sans_chiffre");
  });

  /**
   * ⚠️ Deux périodes différentes, ce sont deux marchés différents : l'écart
   * mesuré peut n'être qu'un changement d'époque. Ça ne s'ajoute pas au
   * verdict, ça le disqualifie.
   */
  it("signale que les deux versions n'ont pas tourné sur la même période", () => {
    const c = comparerMesures(mesure(0.5, 0.1), mesure(0.1, 0.1), P, { de: "2022-01", a: "2023-12" });
    expect(c.periodesDifferentes).toBe(true);
  });

  it("ne le signale pas quand la période est la même", () => {
    expect(comparerMesures(mesure(0.5, 0.1), mesure(0.1, 0.1), P, P).periodesDifferentes).toBe(false);
  });

  it("l'écart est signé dans le sens A moins B", () => {
    expect(comparerMesures(mesure(0.1, 0.5), mesure(0.4, 0.5), P, P).ecartR).toBeCloseTo(-0.3, 6);
  });
});

describe("ce qui sépare les réglages de deux versions", () => {
  const mod = (cle: string, apres: string): Modification => ({
    cle,
    bloc: "niveau",
    avant: "20",
    apres,
    origine: "manuel",
  });

  it("ne rapporte rien quand les deux versions ont les mêmes réglages", () => {
    expect(ecartsDeReglages([mod("niveau_pivots", "10")], [mod("niveau_pivots", "10")])).toEqual([]);
  });

  it("voit un réglage poussé plus loin dans l'une des deux", () => {
    expect(ecartsDeReglages([mod("niveau_pivots", "5")], [mod("niveau_pivots", "10")])).toEqual([
      { cle: "niveau_pivots", a: "5", b: "10" },
    ]);
  });

  /**
   * ⚠️ Un réglage absent d'une version n'est pas « une valeur manquante » : ça
   * veut dire que cette version-là avait gardé celui de la fiche, et l'écran
   * doit pouvoir le dire ainsi.
   */
  it("distingue « pas changé » de « changé autrement »", () => {
    const e = ecartsDeReglages([mod("niveau_pivots", "5")], []);
    expect(e).toEqual([{ cle: "niveau_pivots", a: "5", b: null }]);
  });

  it("range les écarts par clé, pour que deux lectures se ressemblent", () => {
    const e = ecartsDeReglages(
      [mod("unite_de_temps", "5"), mod("niveau_pivots", "5")],
      [mod("seance", "00:00-23:59")],
    );
    expect(e.map((x) => x.cle)).toEqual(["niveau_pivots", "seance", "unite_de_temps"]);
  });
});
