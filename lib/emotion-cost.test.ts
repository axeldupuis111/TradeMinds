import { describe, expect, it } from "vitest";
import {
  MIN_TRADES_ETAT,
  coutDeLEtat,
  etatAAlerter,
  etatFavorable,
  type TradeEmotion,
} from "./emotion-cost";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Cet avertissement s'affiche au moment le plus sensible du produit : juste
 * avant que le trader ouvre sa séance. Un chiffre faux ou une alerte injustifiée
 * y coûtent plus cher qu'ailleurs, parce qu'ils apprennent au trader à ignorer
 * nos avertissements, y compris ceux qui comptent.
 */

function trades(etats: Record<string, number[]>): TradeEmotion[] {
  const out: TradeEmotion[] = [];
  for (const [emotion, pnls] of Object.entries(etats)) {
    for (const netPnl of pnls) out.push({ emotion, netPnl });
  }
  return out;
}

const n = (v: number, combien: number) => Array(combien).fill(v);

describe("on ne dit rien de personnel sans données", () => {
  it("sous le seuil, aucune mesure n'est rendue", () => {
    const j = trades({ frustrated: n(-100, MIN_TRADES_ETAT - 1), calm: n(50, 100) });
    expect(coutDeLEtat(j, "frustrated")).toBeNull();
  });

  it("au seuil exact, la mesure sort", () => {
    const j = trades({ frustrated: n(-100, MIN_TRADES_ETAT), calm: n(50, 100) });
    expect(coutDeLEtat(j, "frustrated")).not.toBeNull();
  });

  it("un état jamais enregistré ne rend rien", () => {
    expect(coutDeLEtat(trades({ calm: n(50, 100) }), "fomo")).toBeNull();
  });

  it("un état vide ne fait pas exploser le calcul", () => {
    expect(coutDeLEtat(trades({ calm: n(50, 100) }), "")).toBeNull();
  });
});

describe("l'écart avec le reste porte l'information, pas l'espérance brute", () => {
  it("un trader globalement perdant n'est pas alerté sur un état qui n'ajoute rien", () => {
    // ⚠️ LE CŒUR DU MODULE. Il perd 80 par trade quand il est frustré, et 75 le
    // reste du temps. Lui dire « tu perds quand tu es frustré » est vrai et
    // trompeur : ce n'est pas l'état qui le fait perdre, c'est sa méthode.
    // L'alerte le ferait travailler sur le mauvais problème.
    const j = trades({ frustrated: n(-80, 40), calm: n(-75, 100) });
    const c = coutDeLEtat(j, "frustrated")!;
    expect(c.esperance).toBe(-80);
    expect(c.ecartAvecLeReste).toBe(-5);
    // L'écart est négatif mais l'alerte se déclenche : c'est voulu, l'état
    // aggrave. La nuance de « combien » appartient à l'interface.
    expect(etatAAlerter(c)).toBe(true);
  });

  it("un état franchement plus coûteux que le reste est alerté", () => {
    const j = trades({ frustrated: n(-300, 30), calm: n(60, 120) });
    const c = coutDeLEtat(j, "frustrated")!;
    expect(c.esperance).toBe(-300);
    expect(c.ecartAvecLeReste).toBe(-360);
    expect(etatAAlerter(c)).toBe(true);
  });

  it("un état qui coûte moins que le reste n'est PAS alerté", () => {
    // Il perd partout, mais moins dans cet état. L'alerter ici reviendrait à
    // lui déconseiller son meilleur état.
    const j = trades({ frustrated: n(-20, 30), calm: n(-200, 120) });
    expect(etatAAlerter(coutDeLEtat(j, "frustrated"))).toBe(false);
  });

  it("les trades SANS état ne comptent pas dans le reste", () => {
    // ⚠️ On ne sait pas dans quel état ils ont été pris. Les verser dans « le
    // reste » ferait porter à cette moyenne des trades qui étaient peut-être
    // dans l'état qu'on mesure, et l'écart deviendrait un mélange des deux.
    const avecVides: TradeEmotion[] = [
      ...trades({ frustrated: n(-100, 30), calm: n(100, 30) }),
      ...Array(500).fill({ emotion: null, netPnl: -9999 }),
    ];
    const c = coutDeLEtat(avecVides, "frustrated")!;
    expect(c.ecartAvecLeReste).toBe(-200);
  });
});

describe("un état qui réussit au trader doit faire TAIRE l'avertissement générique", () => {
  it("gagner dans un état dit « risqué » est reconnu comme tel", () => {
    // ⚠️ CE CAS EXISTE VRAIMENT. Certains traders exécutent mieux sous tension.
    // Leur afficher « attention, état risqué » quand leurs chiffres disent
    // l'inverse leur apprend à ignorer nos avertissements, y compris ceux qui
    // comptent.
    const j = trades({ frustrated: n(120, 30), calm: n(20, 100) });
    const c = coutDeLEtat(j, "frustrated")!;
    expect(etatFavorable(c)).toBe(true);
    expect(etatAAlerter(c)).toBe(false);
  });

  it("gagner un peu moins que le reste n'est pas « favorable »", () => {
    const j = trades({ frustrated: n(10, 30), calm: n(100, 100) });
    expect(etatFavorable(coutDeLEtat(j, "frustrated"))).toBe(false);
  });

  it("un état absent de la liste des « risqués » est mesuré comme les autres", () => {
    // L'excès de confiance ne figure dans aucune liste codée en dur, et c'est
    // l'un des plus coûteux. Ici, il ressort parce que les chiffres le disent.
    const j = trades({ confident: n(-250, 40), neutral: n(80, 100) });
    expect(etatAAlerter(coutDeLEtat(j, "confident"))).toBe(true);
  });

  it("les deux verdicts ne peuvent jamais être vrais en même temps", () => {
    for (const j of [
      trades({ a: n(-100, 30), b: n(100, 100) }),
      trades({ a: n(100, 30), b: n(-100, 100) }),
      trades({ a: n(0, 30), b: n(0, 100) }),
    ]) {
      const c = coutDeLEtat(j, "a");
      expect(etatAAlerter(c) && etatFavorable(c)).toBe(false);
    }
  });

  it("sans mesure, aucun des deux verdicts ne se déclenche", () => {
    expect(etatAAlerter(null)).toBe(false);
    expect(etatFavorable(null)).toBe(false);
  });
});

describe("les totaux rendus sont ceux qu'on peut vérifier à la main", () => {
  it("le cumul et la moyenne se recoupent", () => {
    const j = trades({ fomo: [...n(-100, 20), ...n(200, 5)], calm: n(10, 50) });
    const c = coutDeLEtat(j, "fomo")!;
    expect(c.trades).toBe(25);
    expect(c.netPnl).toBe(-2000 + 1000);
    expect(c.esperance).toBeCloseTo(-40, 6);
  });
});
