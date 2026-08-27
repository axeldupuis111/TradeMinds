import { describe, expect, it } from "vitest";
import { coutsParDefaut, lancerBacktest, minutesDepuisHeure } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * Ces tests ne vérifient pas « ça tourne ». Ils épinglent les quelques règles
 * qui séparent un backtest d'une machine à rassurer : pas de décision prise sur
 * une bougie qu'on n'a pas vue finir, une collision stop/objectif comptée en
 * perte, et un coût qui ne peut pas disparaître entre le moteur et l'audit.
 *
 * Toutes les bougies sont écrites à la main, en ticks entiers, et chaque
 * résultat attendu est calculé de tête dans le commentaire. Un test dont on ne
 * sait pas prédire la valeur ne teste rien.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

/** Fabrique une série M1 : une bougie par minute à partir de `departISO`. */
function serie(bougies: Bougie[], departISO = "2026-03-05T14:00:00Z"): SerieM1 {
  const depart = Date.parse(departISO);
  const n = bougies.length;
  const s: SerieM1 = {
    instrument: "TEST",
    tailleTick: 1,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    s.t[i] = depart + i * 60_000;
    s.o[i] = bougies[i][0];
    s.h[i] = bougies[i][1];
    s.l[i] = bougies[i][2];
    s.c[i] = bougies[i][3];
  }
  return s;
}

function plan(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "TEST",
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "extremes_n_bougies", n: 2 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 10 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 },
    ...over,
  };
}

/**
 * Bougies 0 à 3 : le marché dort dans un canal 99-101, puis la bougie 3 clôture
 * à 110, très au-dessus du plus haut des deux bougies précédentes (101).
 * Le signal tombe donc en bougie 3.
 */
const AMORCE: Bougie[] = [
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 110, 99, 110],
];

describe("règle 1 : aucune décision prise sur une bougie non close", () => {
  it("entre à l'OUVERTURE de la bougie suivante, pas à la clôture du signal", () => {
    // Le signal clôture à 110. La bougie suivante ouvre à 200, très loin.
    // Un moteur qui triche entrerait à 110 ; le nôtre doit payer 200.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan());

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].entreeTicks).toBe(200);
    // Stop à 190, donc 1R = 10 ticks. Objectif à 220, touché en bougie 5 : +2R.
    expect(r.trades[0].r).toBe(2);
    expect(r.trades[0].motif).toBe("objectif");
  });

  it("ne lit pas un niveau tant que la plage qui le forme n'est pas terminée", () => {
    // La plage de référence court de 15h30 à 15h35. La bougie 2, à l'intérieur,
    // clôture à 500 : si le niveau était lisible pendant sa formation, elle
    // déclencherait un achat. Le seul trade admissible est la vente de la
    // bougie 6, une fois la plage close.
    const s = serie(
      [
        [100, 101, 99, 100],
        [100, 101, 99, 100],
        [100, 500, 99, 500],
        [100, 101, 99, 100],
        [100, 101, 99, 100],
        [100, 101, 99, 100],
        [100, 101, 50, 60],
        [60, 65, 55, 60],
        [60, 61, 59, 60],
      ],
      "2026-03-05T15:30:00Z",
    );
    const r = lancerBacktest(
      s,
      plan({ niveau: { type: "range_horaire", debut: "15:30", fin: "15:35" } }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");
  });
});

describe("règle 2 : une collision stop/objectif est une perte", () => {
  it("prend le stop quand les deux tombent dans la même bougie, et le compte", () => {
    // Entrée à 200, stop 190, objectif 220. La bougie d'entrée descend à 185 ET
    // monte à 225 : on ne sait pas dans quel ordre, donc c'est -1R.
    const s = serie([...AMORCE, [200, 225, 185, 200]]);
    const r = lancerBacktest(s, plan());

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].r).toBe(-1);
    expect(r.trades[0].collisionMemeBarre).toBe(true);
    expect(r.audit.collisions).toBe(1);
  });

  it("sort au prix réel quand le marché rouvre au-delà du stop", () => {
    // Stop à 190, mais la bougie 5 ouvre à 150 : la perte est de 5R, pas de 1R.
    // Un moteur qui sort toujours au niveau du stop rend les week-ends gratuits.
    const s = serie([...AMORCE, [200, 205, 195, 200], [150, 155, 145, 150]]);
    const r = lancerBacktest(s, plan());

    expect(r.trades[0].r).toBe(-5);
    expect(r.trades[0].motif).toBe("stop");
  });
});

describe("règle 3 : le coût ne peut pas disparaître", () => {
  it("l'audit égale exactement la somme des écarts brut/net", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ couts: { spreadTicks: 4, glissementTicks: 1, commissionTicks: 2 } }));

    const brut = r.trades.reduce((a, t) => a + t.rBrut, 0);
    const net = r.trades.reduce((a, t) => a + t.r, 0);
    expect(Math.abs(brut - net - r.audit.coutTotalR)).toBeLessThan(1e-9);
  });

  it("sans coût, le net égale le brut", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan());
    for (const t of r.trades) expect(t.r).toBe(t.rBrut);
    expect(r.audit.coutTotalR).toBe(0);
  });

  it("ampute un gagnant à 2R de 40 % quand l'aller-retour vaut presque le stop", () => {
    // 1R vaut 10 ticks. Spread 6 + glissement 1 à l'entrée, commission 1 :
    // brut +2R, net (220 - 207 - 1) / 10 = +1,2R. Ce test existe pour qu'on ne
    // puisse plus jamais dire que les coûts sont un détail de présentation.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ couts: { spreadTicks: 6, glissementTicks: 1, commissionTicks: 1 } }));

    expect(r.trades[0].rBrut).toBe(2);
    expect(r.trades[0].r).toBeCloseTo(1.2, 10);
  });

  it("les coûts par défaut ne sont JAMAIS nuls", () => {
    // Le défaut à zéro est la seule façon de rendre positive une stratégie qui
    // perd de l'argent. Il ne doit pas pouvoir revenir par distraction.
    const d = coutsParDefaut();
    expect(d.spreadTicks).toBeGreaterThan(0);
    expect(d.glissementTicks).toBeGreaterThan(0);
    expect(d.commissionTicks).toBeGreaterThan(0);
  });
});

describe("break-even", () => {
  it("ne prend effet qu'à la bougie suivante", () => {
    // Bougie 4 : entrée 200, stop 190, monte à 212 soit +1,2R, seuil atteint.
    // Bougie 5 : le stop est désormais à 200 et il est touché. Résultat 0R.
    const s = serie([...AMORCE, [200, 212, 195, 205], [205, 206, 185, 190]]);
    const r = lancerBacktest(s, plan({ sortiesAuxiliaires: { breakEvenApresR: 1 } }));

    expect(r.trades[0].motif).toBe("break_even");
    expect(r.trades[0].r).toBe(0);
  });

  it("ne sauve pas un trade stoppé dans la bougie qui atteint le seuil", () => {
    // La même bougie monte à 212 (+1,2R) et redescend à 185, sous le stop.
    // On ignore l'ordre des prix dans la minute : c'est une perte pleine.
    const s = serie([...AMORCE, [200, 212, 185, 190]]);
    const r = lancerBacktest(s, plan({ sortiesAuxiliaires: { breakEvenApresR: 1 } }));

    expect(r.trades[0].motif).toBe("stop");
    expect(r.trades[0].r).toBe(-1);
  });
});

describe("contexte horaire", () => {
  it("ignore un signal hors de la fenêtre autorisée", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(
      s,
      plan({ contexte: { fuseau: "UTC", debut: "14:10", fin: "14:20", jours: [] } }),
    );

    expect(r.trades).toHaveLength(0);
    expect(r.audit.signaux).toBe(0);
  });

  it("suit l'heure d'été : 15h30 à Paris ne tombe pas au même moment UTC en janvier", () => {
    // Le signal est en bougie 3, soit 3 minutes après le début de la série.
    const bougies: Bougie[] = [...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]];
    const fenetre = { fuseau: "Europe/Paris", debut: "15:30", fin: "16:00", jours: [] };

    // 1er juillet, 13h30 UTC = 15h30 à Paris : dans la fenêtre.
    const ete = lancerBacktest(serie(bougies, "2026-07-01T13:30:00Z"), plan({ contexte: fenetre }));
    expect(ete.trades).toHaveLength(1);

    // 7 janvier, 13h30 UTC = 14h30 à Paris : hors fenêtre.
    const hiver = lancerBacktest(serie(bougies, "2026-01-07T13:30:00Z"), plan({ contexte: fenetre }));
    expect(hiver.trades).toHaveLength(0);
  });
});

describe("gestion du risque", () => {
  /** Deux cassures dans la même journée, la seconde en bougie 6. */
  const DEUX_SIGNAUX: Bougie[] = [
    ...AMORCE,
    [200, 205, 195, 200],
    [200, 225, 199, 220],
    [220, 230, 219, 230],
    [300, 305, 295, 300],
    [300, 301, 299, 300],
  ];

  it("prend les deux trades sans plafond", () => {
    const r = lancerBacktest(serie(DEUX_SIGNAUX), plan());
    expect(r.trades.length).toBe(2);
  });

  it("refuse d'entrer au-delà du plafond, mais continue de compter les signaux", () => {
    // ⚠️ `signaux` compte les OCCASIONS, `refusesParGestion` ce que la règle a
    // coûté. Les deux divergent volontairement : un plafond empêche d'entrer,
    // il n'empêche pas le marché de signaler. Sans position ouverte pour
    // masquer la suite, le moteur voit ici trois cassures et en refuse deux.
    const r = lancerBacktest(serie(DEUX_SIGNAUX), plan({ gestion: { maxTradesParJour: 1 } }));
    expect(r.trades).toHaveLength(1);
    expect(r.audit.signaux).toBe(3);
    expect(r.audit.refusesParGestion).toBe(2);
  });

  it("arrête la journée après N pertes d'affilée", () => {
    // Deux stops de suite, puis une cassure franche en bougie 9 qui ne doit
    // plus rien déclencher.
    const bougies: Bougie[] = [
      ...AMORCE,
      [200, 205, 185, 190],
      [190, 191, 189, 190],
      [190, 210, 189, 206],
      [300, 305, 285, 290],
      [290, 291, 289, 290],
      [290, 400, 289, 400],
      [400, 405, 395, 400],
    ];

    const sans = lancerBacktest(serie(bougies), plan());
    expect(sans.trades.length).toBe(3);

    const avec = lancerBacktest(serie(bougies), plan({ gestion: { maxPertesConsecutives: 2 } }));
    expect(avec.trades).toHaveLength(2);
    expect(avec.trades.every((t) => t.r === -1)).toBe(true);
  });
});

describe("déclencheur FVG puis retest", () => {
  it("attend le déséquilibre PUIS son retest avant d'entrer", () => {
    // Bougie 4 : cassure à 110 au-dessus du niveau (102) en laissant un trou
    // entre le haut de la bougie 2 (101) et le bas de la bougie 4 (105).
    // Bougie 6 : le prix redescend à 100, il entre dans le trou. Signal.
    // Bougie 7 : entrée à 104, stop sous le bas de la bougie 6 (100 - 1 = 99),
    // donc 1R = 5 ticks, objectif à 114, touché dans la même bougie. +2R.
    const s = serie([
      [100, 101, 99, 100],
      [100, 101, 99, 100],
      [100, 101, 99, 100],
      [100, 102, 99, 101],
      [106, 112, 105, 110],
      [110, 111, 108, 109],
      [109, 110, 100, 102],
      [104, 120, 103, 118],
    ]);
    const r = lancerBacktest(
      s,
      plan({
        declencheur: { type: "fvg_puis_retest", delaiMaxBarres: 5 },
        stop: { type: "structurel", bufferTicks: 1 },
      }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("long");
    expect(r.trades[0].risqueTicks).toBe(5);
    expect(r.trades[0].r).toBe(2);
  });
});

describe("liquidité : les anciens sommets et creux", () => {
  it("n'expose un pivot qu'une fois qu'il est confirmable des deux côtés", () => {
    // Deux creux pivots successifs, avec `pivots: 3`.
    //   b3  creux large à 90, confirmé en b6 : le niveau vaut 90.
    //   b9  creux plus serré à 95, qui ne sera confirmable qu'en b12.
    //   b11 clôture à 93. C'est sous 95 mais au-dessus de 90 : avec le bon
    //       niveau (encore 90), rien ne se passe. Un moteur qui publierait le
    //       creux de b9 dès sa formation signalerait ICI et entrerait en b12.
    //   b12 le creux de b9 devient lisible, la clôture à 93 passe sous 95.
    // On entre donc en b13, pas en b12.
    const s = serie([
      [100, 105, 99, 100],
      [100, 102, 98, 100],
      [100, 103, 97, 100],
      [100, 110, 90, 100],
      [100, 104, 96, 100],
      [100, 101, 95, 100],
      [100, 101, 96, 100],
      [100, 102, 97, 100],
      [100, 103, 96, 100],
      [100, 104, 95, 100],
      [100, 101, 96, 100],
      [100, 101, 96, 93],
      [93, 101, 96, 93],
      [93, 94, 80, 85],
      [85, 86, 70, 73],
    ]);
    const r = lancerBacktest(s, plan({ niveau: { type: "liquidite_swing", pivots: 3 } }));

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].entreeMs).toBe(s.t[13]);
    expect(r.trades[0].sens).toBe("short");
    expect(r.trades[0].r).toBe(2);
  });
});

describe("déclencheur balayage puis FVG", () => {
  /**
   * Le scénario complet, en vente.
   * b4  : le prix va chercher la liquidité à 110, au-dessus du niveau (101).
   * b7  : impulsion baissière qui laisse un trou entre le bas de b5 (100) et
   *       le haut de b7 (97).
   * b9  : le prix remonte à 101, il rentre dans le trou. Signal.
   * b10 : entrée à 99, stop au-dessus de l'extrême du balayage (110 + 1 = 111),
   *       donc 1R = 12 ticks et l'objectif est à 99 - 24 = 75.
   * b11 : le bas touche 70, l'objectif est atteint. +2R.
   */
  const SCENARIO: Bougie[] = [
    [100, 101, 99, 100],
    [100, 101, 99, 100],
    [100, 101, 99, 100],
    [100, 101, 99, 100],
    [100, 110, 99, 105],
    [105, 106, 100, 102],
    [102, 103, 95, 96],
    [96, 97, 90, 91],
    [91, 93, 89, 92],
    [92, 101, 91, 99],
    [99, 100, 90, 92],
    [92, 93, 70, 75],
  ];

  function planBalayage(over: Partial<PlanExecution> = {}) {
    return plan({
      niveau: { type: "extremes_n_bougies", n: 3 },
      declencheur: { type: "balayage_puis_fvg", delaiReaction: 5, delaiRetest: 5 },
      stop: { type: "extreme_balayage", bufferTicks: 1 },
      ...over,
    });
  }

  it("enchaîne balayage, impulsion et retour avant d'entrer", () => {
    const r = lancerBacktest(serie(SCENARIO), planBalayage());
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");
    // Le risque se mesure depuis l'extrême du balayage, pas depuis la bougie
    // de signal : c'est ça, « le scénario est invalidé ».
    expect(r.trades[0].risqueTicks).toBe(12);
    expect(r.trades[0].r).toBe(2);
  });

  it("annule tout si le prix redépasse l'extrême du balayage", () => {
    // La règle « le retracement ne doit pas dépasser la prise de liquidité ».
    // La bougie 8 remonte à 115, au-dessus des 110 du balayage : le scénario
    // est mort, et le retour dans le FVG en bougie 9 ne vaut plus rien.
    const abime = [...SCENARIO];
    abime[8] = [91, 115, 89, 92];
    expect(lancerBacktest(serie(abime), planBalayage()).trades).toHaveLength(0);
  });

  it("abandonne si la réaction n'arrive pas dans le délai", () => {
    const r = lancerBacktest(serie(SCENARIO), planBalayage({
      declencheur: { type: "balayage_puis_fvg", delaiReaction: 1, delaiRetest: 5 },
    }));
    expect(r.trades).toHaveLength(0);
  });

  it("abandonne si le prix ne revient pas dans le FVG dans le délai", () => {
    const r = lancerBacktest(serie(SCENARIO), planBalayage({
      declencheur: { type: "balayage_puis_fvg", delaiReaction: 5, delaiRetest: 1 },
    }));
    expect(r.trades).toHaveLength(0);
  });

  it("refuse d'ouvrir plutôt que de retomber sur un autre stop", () => {
    // Un stop « extrême du balayage » sans balayage n'a pas de sens. Choisir
    // silencieusement un autre stop testerait une stratégie que personne n'a
    // écrite, et le chiffre sortirait quand même.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ stop: { type: "extreme_balayage", bufferTicks: 1 } }));
    expect(r.audit.signaux).toBeGreaterThan(0);
    expect(r.trades).toHaveLength(0);
  });
});

describe("un stop plus proche que le coût n'est pas un trade", () => {
  it("refuse d'ouvrir, et le compte", () => {
    // Entrée à 200, stop fixe à 3 ticks, mais l'aller-retour coûte 4+2x1+2 = 8
    // ticks. La position serait perdante avant que le marché bouge, et son R
    // (dénominateur 3) pèserait plusieurs fois celui d'un trade normal.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(
      s,
      plan({
        stop: { type: "fixe", ticks: 3 },
        couts: { spreadTicks: 4, glissementTicks: 1, commissionTicks: 2 },
      }),
    );

    expect(r.trades).toHaveLength(0);
    // Deux refus et non un seul : aucune position n'ayant été ouverte, le
    // marché continue de signaler et le plan se represente. C'est cette
    // répétition qui rend le compteur utile à l'écran.
    expect(r.audit.refusesRisqueTropPetit).toBe(2);
  });

  it("accepte dès que le risque couvre l'aller-retour", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(
      s,
      plan({
        stop: { type: "fixe", ticks: 8 },
        couts: { spreadTicks: 4, glissementTicks: 1, commissionTicks: 2 },
      }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.audit.refusesRisqueTropPetit).toBe(0);
  });

  it("laisse passer un stop d'un tick quand le trader a mis les coûts à zéro", () => {
    // ⚠️ Défaut résiduel assumé : sans coût, le seuil tombe à un tick et le R
    // redevient instable. C'est le prix de n'avoir aucun nombre magique ici, et
    // les coûts à zéro sont déjà signalés comme la pire idée de la page.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ stop: { type: "fixe", ticks: 1 } }));
    expect(r.trades).toHaveLength(1);
    expect(r.audit.refusesRisqueTropPetit).toBe(0);
  });
});

describe("trendline : trois touches, n'importe quel sens, restée intacte", () => {
  /**
   * Soutien montant, `pivots: 2`, tolérance 1 tick.
   *   b2  creux à 90    confirmé en b4
   *   b8  creux à 100   confirmé en b10  → droite candidate (2 touches)
   *   b14 creux à 110   confirmé en b16  → la droite vaut 90 + 10 x 12/6 = 110
   *                                        pile dessus : TROISIÈME touche
   *   b17 la droite vaut 115, la clôture tombe à 112 : cassure
   *   b12 sommet à 130  confirmé en b14  → c'est lui, le stop
   *
   * Entrée à l'ouverture de b18 (112), stop 130 + 1 = 131, donc 1R = 19 ticks
   * et l'objectif à 112 - 38 = 74, touché en b22.
   */
  const TROIS_TOUCHES: Bougie[] = [
    [100, 106, 95, 102],
    [102, 107, 94, 103],
    [103, 108, 90, 104], // 1re touche
    [104, 109, 97, 105],
    [105, 110, 98, 106],
    [106, 111, 102, 107],
    [107, 112, 103, 108],
    [108, 113, 102, 109],
    [109, 114, 100, 110], // 2e touche
    [110, 115, 104, 111],
    [111, 116, 105, 112],
    [112, 117, 106, 113],
    // ⚠️ Le prix s'écarte de la droite ici : sans ces deux plus-bas AU-DESSUS
    // de 110, la bougie 14 ne serait pas un creux pivot et la troisième touche
    // n'existerait pas.
    [113, 130, 111, 120], // sommet pivot : le stop
    [120, 128, 115, 122],
    [115, 121, 110, 116], // 3e touche, pile sur la droite
    [116, 119, 112, 117],
    [117, 120, 113, 118],
    [118, 119, 110, 112], // clôture sous la droite : cassure
    [112, 114, 104, 106],
    [106, 108, 96, 98],
    [98, 100, 88, 90],
    [90, 92, 80, 82],
    [82, 84, 72, 73], // objectif
  ];

  function planTL(over: { touchesMin?: number } = {}) {
    return plan({
      niveau: { type: "trendline", pivots: 2, touchesMin: over.touchesMin ?? 3, toleranceTicks: 1 },
      stop: { type: "dernier_pivot", bufferTicks: 1 },
    });
  }

  it("entre quand la droite à trois touches est enfin cassée", () => {
    const s = serie(TROIS_TOUCHES);
    const r = lancerBacktest(s, planTL());

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");
    expect(r.trades[0].entreeMs).toBe(s.t[18]);
    expect(r.trades[0].risqueTicks).toBe(19);
    expect(r.trades[0].r).toBe(2);
  });

  it("ne fait rien tant que la troisième touche manque", () => {
    // ⚠️ La règle qui distingue une trendline d'un trait au hasard : par deux
    // points il passe toujours une droite. En exigeant quatre touches sur ce
    // même jeu, la droite reste candidate et sa cassure ne vaut rien.
    expect(lancerBacktest(serie(TROIS_TOUCHES), planTL({ touchesMin: 4 })).trades).toHaveLength(0);
  });

  it("tue la droite si une clôture la traverse avant la troisième touche", () => {
    // « Le prix doit rebondir dessus sans clôturer en la cassant. » La bougie 13
    // clôture à 105 alors que la droite vaut 108 : la droite est morte, la
    // touche de b14 ne la ressuscite pas, et la cassure de b17 ne signale rien.
    const traversee = TROIS_TOUCHES.map((b, k) => (k === 13 ? ([120, 128, 104, 105] as Bougie) : b));
    expect(lancerBacktest(serie(traversee), planTL()).trades).toHaveLength(0);
  });

  it("accepte un soutien qui DESCEND, parce qu'une trendline n'a pas de sens imposé", () => {
    // Creux à 110, 100 puis 90 : la droite descend, le prix rebondit dessus
    // trois fois, puis clôture dessous. Exiger des creux ascendants écarterait
    // la moitié des trendlines que les traders tracent.
    const DESCENDANT: Bougie[] = [
      [120, 126, 115, 122],
      [122, 127, 114, 123],
      [123, 128, 110, 124], // 1re touche
      [124, 129, 117, 125],
      [125, 130, 118, 126],
      [126, 131, 120, 127],
      [127, 132, 105, 128],
      [128, 133, 104, 129],
      [129, 134, 100, 130], // 2e touche
      [130, 135, 104, 131],
      [131, 136, 105, 132],
      [132, 137, 106, 133],
      [133, 150, 110, 140],
      [140, 148, 115, 142],
      [142, 144, 90, 138], // 3e touche
      [138, 141, 92, 139],
      [139, 142, 93, 140],
      [140, 141, 83, 84], // clôture sous la droite (85)
      [84, 86, 74, 76],
      [76, 78, 62, 64],
    ];
    const r = lancerBacktest(
      serie(DESCENDANT),
      plan({
        niveau: { type: "trendline", pivots: 2, touchesMin: 3, toleranceTicks: 1 },
        stop: { type: "fixe", ticks: 10 },
      }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");
    expect(r.trades[0].r).toBe(2);
  });

  it("refuse d'ouvrir sans pivot confirmé plutôt que de changer de stop", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ stop: { type: "dernier_pivot", bufferTicks: 1 } }));
    expect(r.audit.signaux).toBeGreaterThan(0);
    expect(r.trades).toHaveLength(0);
  });
});

describe("unité de temps", () => {
  it("regroupe les M1 avant d'exécuter", () => {
    // Six bougies M1 identiques deviennent deux bougies M3 : il ne peut plus
    // rien se passer avant la deuxième, faute d'historique.
    const s = serie(
      Array.from({ length: 6 }, () => [100, 101, 99, 100] as Bougie),
      "2026-03-05T14:00:00Z",
    );
    const r = lancerBacktest(s, plan({ uniteDeTemps: 3 }));
    expect(r.audit.bougies).toBe(2);
  });
});

describe("garantie structurelle : le futur ne peut pas fuir vers le passé", () => {
  /**
   * ⚠️ LE TEST LE PLUS IMPORTANT DU FICHIER, ET IL NE RESSEMBLE À AUCUN AUTRE.
   *
   * Les autres tests vérifient des cas qu'on a imaginés. Celui-ci vérifie une
   * PROPRIÉTÉ, et il attrape les fuites de futur qu'on n'a pas imaginées.
   *
   * Le raisonnement : si le moteur lisait, même par accident, une bougie
   * postérieure à celle qu'il traite, alors couper la série plus tôt changerait
   * ses décisions PASSÉES. En rejouant la même série tronquée à toutes les
   * longueurs, chaque trade déjà clos doit rester identique au tick près.
   *
   * C'est ce qu'un badge « 0 violation de lookahead » prétend garantir sans
   * jamais le prouver : ce badge est calculé par le même code qui produirait la
   * violation. Ici, aucune complicité possible.
   */
  function serieTronquee(s: SerieM1, n: number): SerieM1 {
    return {
      instrument: s.instrument,
      tailleTick: s.tailleTick,
      t: s.t.slice(0, n),
      o: s.o.slice(0, n),
      h: s.h.slice(0, n),
      l: s.l.slice(0, n),
      c: s.c.slice(0, n),
    };
  }

  /** Une série longue et irrégulière, pour que beaucoup de blocs s'activent. */
  function serieVariee(taille: number): SerieM1 {
    const bougies: Bougie[] = [];
    // Marche déterministe : pas de hasard, sinon le test dépend de sa chance.
    let prix = 10_000;
    let graine = 12345;
    const suivant = () => {
      graine = (graine * 1103515245 + 12345) & 0x7fffffff;
      return graine / 0x7fffffff;
    };
    for (let i = 0; i < taille; i++) {
      const derive = Math.round((suivant() - 0.5) * 60);
      const ouverture = prix;
      const cloture = prix + derive;
      const haut = Math.max(ouverture, cloture) + Math.round(suivant() * 25);
      const bas = Math.min(ouverture, cloture) - Math.round(suivant() * 25);
      bougies.push([ouverture, haut, bas, cloture]);
      prix = cloture;
    }
    return serie(bougies);
  }

  const PLANS: { nom: string; plan: PlanExecution }[] = [
    { nom: "cassure + extremes", plan: plan({ niveau: { type: "extremes_n_bougies", n: 10 } }) },
    {
      nom: "liquidité + balayage FVG",
      plan: plan({
        niveau: { type: "liquidite_swing", pivots: 5 },
        declencheur: { type: "balayage_puis_fvg", delaiReaction: 8, delaiRetest: 12 },
        stop: { type: "extreme_balayage", bufferTicks: 2 },
      }),
    },
    {
      nom: "trendline 3 touches",
      plan: plan({
        niveau: { type: "trendline", pivots: 4, touchesMin: 3, toleranceTicks: 8 },
        stop: { type: "dernier_pivot", bufferTicks: 2 },
      }),
    },
    {
      nom: "retest + ordre limite",
      plan: plan({
        niveau: { type: "extremes_n_bougies", n: 12 },
        declencheur: { type: "retest_apres_cassure", delaiMaxBarres: 10, toleranceTicks: 5 },
        entree: { type: "limite_au_niveau", valableNBarres: 8 },
      }),
    },
    {
      nom: "moyenne + break-even + gestion",
      plan: plan({
        niveau: { type: "extremes_n_bougies", n: 8 },
        confirmations: [{ type: "biais_moyenne", periode: 20 }, { type: "bougie_reaction" }],
        sortiesAuxiliaires: { breakEvenApresR: 1 },
        gestion: { maxTradesParJour: 3, maxPertesConsecutives: 2 },
        couts: { spreadTicks: 3, glissementTicks: 1, commissionTicks: 1 },
      }),
    },
  ];

  const COMPLETE = serieVariee(1500);

  for (const { nom, plan: p } of PLANS) {
    it(`ne change aucun trade déjà clos quand on coupe le futur : ${nom}`, () => {
      const complet = lancerBacktest(COMPLETE, p);
      expect(complet.trades.length).toBeGreaterThan(3);

      for (const n of [300, 600, 900, 1200]) {
        const tronque = lancerBacktest(serieTronquee(COMPLETE, n), p);
        // Le dernier trade d'une série coupée peut être soldé d'office : il
        // n'existerait pas ainsi dans la série complète, on l'exclut.
        const clos = tronque.trades.filter((x) => x.motif !== "fin_de_serie");
        expect(clos.length).toBeLessThanOrEqual(complet.trades.length);
        for (let k = 0; k < clos.length; k++) {
          expect(clos[k], `${nom} coupé à ${n}, trade ${k}`).toEqual(complet.trades[k]);
        }
      }
    });
  }

  it("rend deux fois le même résultat sur une série longue", () => {
    for (const { plan: p } of PLANS) {
      expect(lancerBacktest(COMPLETE, p)).toEqual(lancerBacktest(COMPLETE, p));
    }
  });
});

describe("bornes du moteur", () => {
  it("solde une position encore ouverte à la fin de la série, et le dit", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200]]);
    const r = lancerBacktest(s, plan());
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].motif).toBe("fin_de_serie");
  });

  it("rend exactement le même résultat deux fois de suite", () => {
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const p = plan({ couts: coutsParDefaut() });
    expect(lancerBacktest(s, p)).toEqual(lancerBacktest(s, p));
  });

  it("ne rend aucun trade sur une série vide", () => {
    const r = lancerBacktest(serie([]), plan());
    expect(r.trades).toHaveLength(0);
    expect(r.audit.bougies).toBe(0);
  });
});

describe("minutesDepuisHeure", () => {
  it("lit les heures valides et rejette les autres", () => {
    expect(minutesDepuisHeure("15:30")).toBe(930);
    expect(minutesDepuisHeure("00:00")).toBe(0);
    expect(minutesDepuisHeure("9:05")).toBe(545);
    expect(minutesDepuisHeure("24:00")).toBeNull();
    expect(minutesDepuisHeure("15:70")).toBeNull();
    expect(minutesDepuisHeure("bonjour")).toBeNull();
  });
});
