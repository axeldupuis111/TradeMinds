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

  it("un gagnant à 2R devient perdant quand le spread pèse deux fois le stop", () => {
    // 1R vaut 10 ticks. Spread 20 + glissement 2 à l'entrée, commission 6 :
    // brut +2R, net (220 - 222 - 6) / 10 = -0,8R. Ce test existe pour qu'on ne
    // puisse plus jamais dire que les coûts sont un détail de présentation.
    const s = serie([...AMORCE, [200, 205, 195, 200], [200, 225, 199, 220]]);
    const r = lancerBacktest(s, plan({ couts: { spreadTicks: 20, glissementTicks: 2, commissionTicks: 6 } }));

    expect(r.trades[0].rBrut).toBe(2);
    expect(r.trades[0].r).toBeCloseTo(-0.8, 10);
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
