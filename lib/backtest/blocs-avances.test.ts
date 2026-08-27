import { describe, expect, it } from "vitest";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * LES BLOCS AJOUTÉS POUR ÉLARGIR LE CATALOGUE : indicateurs et zones.
 *
 * Même discipline que le reste du moteur : toutes les bougies sont écrites à la
 * main, en ticks entiers, et chaque résultat attendu est calculé de tête dans le
 * commentaire. Un test dont on ne sait pas prédire la valeur ne teste rien.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

function serie(bougies: Bougie[], departISO = "2026-03-05T08:00:00Z"): SerieM1 {
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

/** Un marché plat à 100, sur lequel greffer des mouvements précis. */
function plat(n: number, prix = 100): Bougie[] {
  return Array.from({ length: n }, () => [prix, prix + 1, prix - 1, prix] as Bougie);
}

describe("moyenne mobile comme niveau", () => {
  it("n'expose aucun niveau tant que la fenêtre est incomplète", () => {
    // ⚠️ Une moyenne calculée sur trois bougies quand on en demande dix ne
    // décrit rien : mieux vaut pas de niveau du tout qu'un niveau inventé.
    const s = serie(plat(5));
    const r = lancerBacktest(s, plan({ niveau: { type: "moyenne_mobile", periode: 10 } }));
    expect(r.audit.barresAvecNiveau).toBe(0);
  });

  it("suit le prix et se fait casser quand il s'en écarte", () => {
    // Dix bougies à 100, la moyenne à 5 périodes vaut donc 100. La bougie 10
    // clôture à 130 : elle casse la moyenne par le haut.
    const s = serie([...plat(10), [100, 131, 99, 130], [130, 131, 129, 130], [130, 155, 129, 152]]);
    const r = lancerBacktest(s, plan({ niveau: { type: "moyenne_mobile", periode: 5 } }));

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("long");
    // Entrée à l'ouverture de b11 (130), stop fixe 10 donc objectif à 150,
    // touché en b12.
    expect(r.trades[0].r).toBe(2);
  });
});

describe("VWAP de séance", () => {
  it("repart de zéro à chaque journée", () => {
    /**
     * ⚠️ LE TEST SE LIT PAR SON EFFET, parce que le VWAP n'est pas observable
     * de l'extérieur. Journée 1 : quinze bougies à 100. Journée 2 : le marché
     * ouvre à 200 et n'en bouge plus.
     *
     * VWAP remis à zéro → il vaut 200 dès la première bougie du jour 2, la
     * clôture est dessus, rien ne se déclenche.
     * VWAP qui traînerait → il vaudrait environ 100, le prix à 200 le
     * franchirait immédiatement et produirait un achat. Zéro trade est donc la
     * preuve que la remise à zéro a eu lieu.
     */
    const s = serie([...plat(15, 100), ...plat(30, 200)], "2026-03-05T23:45:00Z");
    const r = lancerBacktest(s, plan({ niveau: { type: "vwap_session" } }));
    expect(r.trades).toHaveLength(0);
  });

  it("sert de niveau franchissable", () => {
    const s = serie([...plat(10), [100, 131, 99, 130], [130, 131, 129, 130], [130, 155, 129, 152]]);
    const r = lancerBacktest(s, plan({ niveau: { type: "vwap_session" } }));
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].sens).toBe("long");
  });
});

describe("bandes de Bollinger", () => {
  it("ne déclenche pas tant que le prix reste entre les bandes", () => {
    // Un marché parfaitement plat a un écart-type nul : les bandes collent à la
    // moyenne, et la clôture, égale à la moyenne, ne franchit rien.
    const r = lancerBacktest(
      serie(plat(40)),
      plan({ niveau: { type: "bollinger", periode: 20, ecarts: 2 } }),
    );
    expect(r.trades).toHaveLength(0);
  });

  it("déclenche quand le prix sort de la bande haute", () => {
    const s = serie([
      ...plat(20),
      [100, 121, 99, 120],
      [120, 141, 119, 140],
      [140, 141, 139, 140],
      [140, 200, 139, 190],
    ]);
    const r = lancerBacktest(
      s,
      plan({ niveau: { type: "bollinger", periode: 20, ecarts: 2 } }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].sens).toBe("long");
  });
});

describe("confirmation RSI", () => {
  /** Une montée continue : le RSI y monte vers 100. */
  const MONTEE: Bougie[] = Array.from(
    { length: 30 },
    (_, i) => [100 + i * 2, 101 + i * 2, 99 + i * 2, 100 + i * 2] as Bougie,
  );
  const CASSURE: Bougie[] = [
    [160, 200, 159, 195],
    [195, 196, 194, 195],
    [195, 240, 194, 235],
  ];

  it("laisse passer un achat quand l'élan est là, en mode momentum", () => {
    const r = lancerBacktest(
      serie([...MONTEE, ...CASSURE]),
      plan({ confirmations: [{ type: "rsi", periode: 14, seuil: 55, mode: "momentum" }] }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
  });

  it("refuse le MÊME achat en mode excès, parce que le filtre est inversé", () => {
    // ⚠️ LE TEST QUI COMPTE. Les deux usages du RSI sont opposés : suivre
    // l'élan, ou jouer l'excès. Se tromper de mode inverse le filtre, et un
    // filtre inversé ne se voit pas dans les chiffres, seulement dans le nombre
    // de trades. Ici, le même jeu de bougies passe d'un côté et bloque de l'autre.
    const r = lancerBacktest(
      serie([...MONTEE, ...CASSURE]),
      plan({ confirmations: [{ type: "rsi", periode: 14, seuil: 55, mode: "exces" }] }),
    );
    expect(r.trades).toHaveLength(0);
  });
});

describe("zones ICT", () => {
  /**
   * Un déséquilibre haussier : le bas de b12 (130) passe au-dessus du haut de
   * b10 (110). La zone va donc de 110 à 130, et elle est de sens ACHAT.
   * Le prix y revient en b15, ce qui déclenche l'entrée.
   */
  const FVG: Bougie[] = [
    ...plat(10),
    [100, 110, 99, 108], // b10, son haut borne le bas du trou
    [108, 129, 107, 128],
    [128, 145, 130, 142], // b12 : son bas ouvre le trou
    [142, 148, 138, 140],
    [140, 142, 132, 134],
    [134, 136, 125, 128], // b15 : retour DANS la zone
    [128, 130, 118, 120],
    [120, 122, 110, 112],
    [112, 114, 104, 106],
  ];

  it("entre quand le prix revient dans le déséquilibre", () => {
    const r = lancerBacktest(
      serie(FVG),
      plan({
        niveau: { type: "fvg_zone", tailleMinTicks: 10 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].sens).toBe("long");
  });

  it("ne déclenche qu'À L'ENTRÉE, pas à chaque bougie passée dedans", () => {
    // ⚠️ Sans cette bascule, une zone traversée lentement produirait un signal
    // par bougie et gonflerait le nombre de trades sans qu'aucun setup
    // supplémentaire n'ait eu lieu.
    const r = lancerBacktest(
      serie(FVG),
      plan({
        niveau: { type: "fvg_zone", tailleMinTicks: 10 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    // Quatre bougies traversent la zone ; un seul signal doit en sortir.
    expect(r.audit.signaux).toBe(1);
  });

  it("ignore un déséquilibre plus petit que la taille demandée", () => {
    const r = lancerBacktest(
      serie(FVG),
      plan({
        niveau: { type: "fvg_zone", tailleMinTicks: 500 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    expect(r.trades).toHaveLength(0);
  });

  it("dessine la zone comme une boîte, pas comme un trait", () => {
    const r = lancerBacktest(
      serie(FVG),
      plan({
        niveau: { type: "fvg_zone", tailleMinTicks: 10 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    const trace = r.trades[0].trace;
    expect(trace?.forme).toBe("zone");
    if (trace?.forme !== "zone") return;
    // Le trou va du haut de b10 (110) au bas de b12 (130).
    expect(trace.basTicks).toBe(110);
    expect(trace.hautTicks).toBe(130);
  });
});

describe("order block et breaker", () => {
  /**
   * b12 est une bougie baissière, puis b13 est une impulsion haussière de 40
   * ticks. L'order block est donc b12, zone 118-132, de sens ACHAT.
   */
  const OB: Bougie[] = [
    ...plat(12),
    [130, 132, 118, 120], // b12 : dernière bougie baissière
    [120, 165, 119, 160], // b13 : impulsion haussière de 40
    [160, 162, 150, 152],
    [152, 154, 138, 140],
    [140, 142, 126, 128], // retour dans la zone
    [128, 130, 118, 120],
    [120, 122, 108, 110],
    [110, 112, 98, 100],
  ];

  it("prend la dernière bougie opposée avant l'impulsion, dans le sens de l'impulsion", () => {
    const r = lancerBacktest(
      serie(OB),
      plan({
        niveau: { type: "order_block", impulsionMinTicks: 30 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].sens).toBe("long");
    const trace = r.trades[0].trace;
    expect(trace?.forme).toBe("zone");
    if (trace?.forme !== "zone") return;
    expect(trace.basTicks).toBe(118);
    expect(trace.hautTicks).toBe(132);
  });

  it("INVERSE le sens sur un breaker, parce qu'une demande qui cède devient une offre", () => {
    // ⚠️ C'est la nuance que les traders distinguent, et la confondre inverse le
    // trade sans que rien à l'écran ne le montre.
    const r = lancerBacktest(
      serie(OB),
      plan({
        niveau: { type: "breaker", impulsionMinTicks: 30 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].sens).toBe("short");
  });

  it("ignore une impulsion trop faible", () => {
    const r = lancerBacktest(
      serie(OB),
      plan({
        niveau: { type: "order_block", impulsionMinTicks: 500 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 10 },
      }),
    );
    expect(r.trades).toHaveLength(0);
  });
});
