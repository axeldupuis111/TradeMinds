import { describe, expect, it } from "vitest";
import { echelleApercu, type GeometrieApercu } from "./apercu";

/** Un trade de 10 points de risque, objectif à 2R, au milieu de sa fenêtre. */
function geometrie(over: Partial<GeometrieApercu> = {}): GeometrieApercu {
  return {
    hautBougies: 120,
    basBougies: 80,
    entree: 100,
    stop: 110,
    objectif: 80,
    sortie: 80,
    niveau: 104,
    ...over,
  };
}

/**
 * Part de la hauteur occupée par l'écart stop-objectif.
 *
 * ⚠️ Elle reste sous le quart visé, et c'est normal : l'amplitude retenue
 * couvre aussi le prix de SORTIE réel, qui déborde du stop quand le marché a
 * ouvert au-delà. Mesuré sur treize trades réels : entre 17 et 53 %.
 */
function partDuTrade(g: GeometrieApercu, tick = 0.01): number {
  const { haut, bas } = echelleApercu(g, tick);
  return Math.abs(g.objectif - g.stop) / (haut - bas);
}

describe("échelle du graphique d'inspection", () => {
  it("laisse toujours le trade nettement lisible, même à risque minuscule", () => {
    // ⚠️ LE DÉFAUT QUI A MOTIVÉ CE FICHIER. Un risque de 3 points dans une
    // fenêtre qui en couvre 60 : en calant l'échelle sur les bougies, stop,
    // entrée et objectif se superposaient en une bande d'un millimètre. Le
    // graphique s'affichait et ne servait plus à rien.
    const minuscule = geometrie({
      hautBougies: 20_360,
      basBougies: 20_300,
      entree: 20_342,
      stop: 20_345,
      objectif: 20_336,
      sortie: 20_345,
      niveau: 20_342,
    });
    expect(partDuTrade(minuscule)).toBeGreaterThan(0.15);
  });

  it("laisse le niveau franchi sortir du cadre plutôt que d'écraser le trade", () => {
    // ⚠️ Mesuré sur treize trades réels : en ancrant l'échelle sur le niveau,
    // cinq d'entre eux retombaient à trois pixels entre le stop et l'entrée.
    const loin = geometrie({ niveau: 60, entree: 100, stop: 110, objectif: 80, sortie: 110 });
    const e = echelleApercu(loin, 0.01);
    expect(e.niveauVisible).toBe(false);
    expect(partDuTrade(loin)).toBeGreaterThan(0.15);
  });

  it("trace le niveau quand il tombe dans le cadre", () => {
    expect(echelleApercu(geometrie(), 0.01).niveauVisible).toBe(true);
  });

  it("contient toujours le trade en entier, même quand il déborde des bougies", () => {
    // Un objectif jamais atteint tombe hors de la fenêtre de bougies. Le rogner
    // laisserait croire que le trade n'en avait pas.
    const g = geometrie({ objectif: 10, basBougies: 80 });
    const { haut, bas } = echelleApercu(g, 0.01);
    expect(bas).toBeLessThan(10);
    expect(haut).toBeGreaterThan(110);
  });

  it("montre le contexte quand les bougies tiennent dans la hauteur du trade", () => {
    // Fenêtre serrée autour d'un trade large : rien à rogner, on garde tout.
    const g = geometrie({ hautBougies: 112, basBougies: 78 });
    const { haut, bas } = echelleApercu(g, 0.01);
    expect(haut).toBeGreaterThanOrEqual(112);
    expect(bas).toBeLessThanOrEqual(78);
  });

  it("rogne les bougies lointaines plutôt que d'écraser le trade", () => {
    // ⚠️ L'arbitrage central : perdre le haut d'une mèche lointaine est sans
    // conséquence, perdre la distance entre le stop et l'entrée rend la
    // vérification impossible.
    const g = geometrie({ hautBougies: 5_000, basBougies: 0 });
    const { haut, bas } = echelleApercu(g, 0.01);
    expect(haut).toBeLessThan(5_000);
    expect(bas).toBeGreaterThan(0);
    expect(partDuTrade(g)).toBeGreaterThan(0.15);
  });

  it("ne rend jamais une hauteur nulle", () => {
    // Tous les prix confondus : sans plancher, la division par la hauteur
    // renverrait des NaN dans tout le tracé.
    const plat = geometrie({
      hautBougies: 100,
      basBougies: 100,
      entree: 100,
      stop: 100,
      objectif: 100,
      sortie: 100,
      niveau: 100,
    });
    const { haut, bas } = echelleApercu(plat, 0.01);
    expect(haut - bas).toBeGreaterThan(0);
  });
});
