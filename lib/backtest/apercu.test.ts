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

  it("contient toujours l'entrée, le stop et la SORTIE, même hors des bougies", () => {
    // Ce sont les trois faits du trade. Les rogner rendrait le graphique
    // incapable de montrer ce qui s'est passé, et c'est sa seule raison d'être.
    const g = geometrie({ sortie: 130, basBougies: 80 });
    const { haut, bas } = echelleApercu(g, 0.01);
    expect(haut).toBeGreaterThanOrEqual(130);
    expect(bas).toBeLessThanOrEqual(80);
  });

  it("laisse l'objectif JAMAIS ATTEINT sortir du cadre", () => {
    // ⚠️ CHANGEMENT DE CONTRAT, ET IL EST MESURE. L'objectif ancrait l'echelle
    // au meme titre que l'entree et le stop. Sur un trade perdant a 2R, il se
    // trouve a deux fois le risque au-dessus de l'entree, dans une zone ou le
    // prix n'est JAMAIS alle : le cadre s'etirait pour l'accueillir et les
    // bougies s'ecrasaient en bas. Vu sur une capture reelle : 60 % de la
    // hauteur en blanc, au-dessus d'un trait decrivant ce qui n'a pas eu lieu.
    //
    // Le cadre montre ce qui s'est passe, pas ce qui etait espere. Sa valeur
    // reste affichee en marge, comme celle du niveau.
    const perdant = geometrie({ entree: 100, stop: 90, objectif: 120, sortie: 90 });
    const e = echelleApercu(perdant, 0.01);
    expect(e.objectifVisible).toBe(false);
    expect(e.haut).toBeLessThan(120);
  });

  it("garde l'objectif dans le cadre quand il a ete ATTEINT", () => {
    // Sur un trade gagnant, la sortie vaut l'objectif : il entre par elle, sans
    // que l'echelle ait a s'etirer pour un prix theorique.
    const gagnant = geometrie({ entree: 100, stop: 90, objectif: 120, sortie: 120 });
    expect(echelleApercu(gagnant, 0.01).objectifVisible).toBe(true);
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
