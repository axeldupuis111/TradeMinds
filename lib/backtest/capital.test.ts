import { describe, expect, it } from "vitest";
import { effetSurLeCompte } from "./capital";

/**
 * CE QUE LA SUITE DE R FAIT À UN VRAI COMPTE.
 *
 * ⚠️ NÉ D'UN CHIFFRE IMPOSSIBLE VU À L'ÉCRAN : « pire recul du compte :
 * -148,4 % ». On ne perd pas cent quarante-huit pour cent d'un compte. La faute
 * était de multiplier le pire recul en R par le risque par trade, c'est-à-dire
 * de rapporter un recul au capital de DÉPART alors qu'un recul se mesure depuis
 * le SOMMET qui le précède.
 *
 * Un nombre impossible ne se contente pas d'être faux : il décrédibilise tous
 * les chiffres justes qui l'entourent.
 */

describe("effet d'une suite de R sur le compte", () => {
  it("un recul se mesure depuis le sommet, jamais depuis le départ", () => {
    // ⚠️ LE CAS EXACT DE LA CAPTURE, en plus court. Le compte monte à +50 R
    // (soit 3,5 fois la mise à 5 % par trade), puis rend 29,7 R.
    // Ancien calcul : 29,7 × 5 = -148,4 %, ce qui n'existe pas.
    // Vrai calcul : de 3,5 à 3,5 - 1,485 = 2,015, soit -42,4 %.
    const e = effetSurLeCompte([50, -29.7], 5);
    expect(e.reculPct).toBeCloseTo(42.4, 1);
    expect(e.reculPct).toBeLessThan(100);
    expect(e.ruine).toBe(false);
  });

  it("baisser le risque NE divise PAS le recul proportionnellement", () => {
    // ⚠️⚠️ CONSTAT CONTRE-INTUITIF, ET IL COMPTE POUR CE QU'ON ÉCRIT À L'ÉCRAN.
    // On croit qu'en divisant son risque par deux on divise son pire recul par
    // deux. C'est faux dès que le compte a grossi : le recul se mesure depuis
    // le SOMMET, et un risque plus petit fait aussi un sommet plus bas.
    //
    // Même suite montée à +50 R puis rendue de 29,7 R :
    //   à 5 %  → -42,4 %
    //   à 2,5 % → -32,7 %, soit à peine un tiers de moins et non la moitié.
    //
    // Ne pas le savoir ferait promettre « divise ton risque par deux et ton
    // recul par deux », ce qui est un conseil faux.
    const fort = effetSurLeCompte([50, -29.7], 5);
    const doux = effetSurLeCompte([50, -29.7], 2.5);
    expect(doux.reculPct).toBeLessThan(fort.reculPct);
    expect(fort.reculPct / doux.reculPct).toBeLessThan(1.5);
  });

  it("mais tout près du départ, la proportion revient", () => {
    // Sur un compte qui n'a presque pas bougé, le sommet vaut la mise initiale
    // et le recul redevient proportionnel à la taille de position.
    const a = effetSurLeCompte([0.2, -4], 2);
    const b = effetSurLeCompte([0.2, -4], 1);
    expect(a.reculPct / b.reculPct).toBeGreaterThan(1.9);
    expect(a.reculPct / b.reculPct).toBeLessThan(2.1);
  });

  it("ne dépasse JAMAIS cent pour cent, quelle que soit la suite", () => {
    // La borne est structurelle : on ne peut pas perdre plus que ce qu'on a.
    const suites = [
      [10, -50],
      [1, 1, 1, -100],
      [-19, 40, -60],
      [100, -200],
    ];
    for (const rs of suites) {
      const e = effetSurLeCompte(rs, 5);
      expect(e.reculPct, JSON.stringify(rs)).toBeLessThanOrEqual(100);
    }
  });

  it("dit que le compte est VIDÉ quand il tombe à zéro", () => {
    // ⚠️ À 5 % par trade, il faut -20 R depuis le départ pour tout perdre.
    // Le trade qui vide le compte est nommé : les suivants n'ont pas eu lieu.
    const e = effetSurLeCompte([-5, -5, -5, -6, 100, 100], 5);
    expect(e.ruine).toBe(true);
    expect(e.rangRuine).toBe(4);
    expect(e.final).toBe(0);
  });

  it("n'invente pas de gain après la ruine", () => {
    // ⚠️ LA RAISON D'ÊTRE DU DRAPEAU. Un compte vidé au quatrième trade ne prend
    // pas les deux gains de cent R qui suivent. Les compter afficherait un
    // résultat magnifique qui suppose de continuer à trader sans argent.
    const e = effetSurLeCompte([-5, -5, -5, -6, 100, 100], 5);
    expect(e.totalPct).toBe(-100);
  });

  it("un risque plus petit peut éviter la ruine sur la MÊME suite", () => {
    // Même méthode, même marché, même ordre : seule la taille change. C'est le
    // chiffre que le trader doit voir avant de choisir son pourcentage.
    const suite = [-5, -5, -5, -6, 20];
    expect(effetSurLeCompte(suite, 5).ruine).toBe(true);
    expect(effetSurLeCompte(suite, 1).ruine).toBe(false);
  });

  it("rend le compte inchangé sans aucun trade", () => {
    const e = effetSurLeCompte([], 5);
    expect(e.final).toBe(1);
    expect(e.totalPct).toBe(0);
    expect(e.reculPct).toBe(0);
  });

  it("le total suit la somme des R quand rien ne casse", () => {
    // Sur un parcours sans ruine, la conversion reste celle qui est annoncée :
    // taille de position constante, donc résultat proportionnel à la somme.
    const e = effetSurLeCompte([1, 2, -1, 3], 2);
    expect(e.totalPct).toBeCloseTo(5 * 2, 6);
  });
});
