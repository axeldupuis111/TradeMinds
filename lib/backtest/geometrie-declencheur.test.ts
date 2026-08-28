import { describe, expect, it } from "vitest";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * LA GÉOMÉTRIE DE LA MÉCANIQUE D'ENTRÉE.
 *
 * ⚠️ CE QUE CES TESTS PROTÈGENT, ET POURQUOI ILS EXISTENT. Le graphique
 * d'inspection ne sert qu'à une chose : que le trader puisse dire « oui, c'est
 * ma méthode » ou « non ». Tant qu'on ne dessinait que le niveau, un trader ICT
 * voyait une ligne et une bougie d'entrée, sans la mèche qui a pris la
 * liquidité ni la boîte dans laquelle le prix revient. Il ne pouvait donc rien
 * confirmer ni démentir.
 *
 * Une géométrie approximative serait PIRE que pas de géométrie : elle donnerait
 * l'air d'une vérification tout en montrant autre chose que ce qui a décidé du
 * trade. Chaque borne attendue est donc calculée de tête dans le commentaire.
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

function plat(n: number, prix = 100): Bougie[] {
  return Array.from({ length: n }, () => [prix, prix + 1, prix - 1, prix] as Bougie);
}

/**
 * Cassure haussière laissant un déséquilibre, puis retour sur son bord.
 *
 * b0..b3 : plat à 100 (haut 101, bas 99). Le niveau à b5 vaut donc max(h3,h4).
 * b4 : monte, haut 104. Le niveau devient 104.
 * b5 : clôture 111 au-dessus de 104 ET laisse un trou, car son bas (106) est
 *      au-dessus du haut de b3 (101). La boîte est donc [101 ; 106], et son
 *      bord retesté est 101, le côté par lequel le prix reviendra.
 * b7 : son bas touche 100, donc sous 101 : retour dans la boîte, signal long.
 */
const CASSURE_AVEC_TROU: Bougie[] = [
  ...plat(4),
  [100, 104, 100, 104],
  [104, 112, 106, 111],
  [111, 112, 108, 109],
  [109, 110, 100, 102],
  [102, 103, 101, 102],
  [102, 125, 101, 124],
];

describe("le déséquilibre se dessine comme une boîte", () => {
  it("porte les deux bords du trou, et le bord retesté", () => {
    const s = serie(CASSURE_AVEC_TROU);
    const r = lancerBacktest(
      s,
      plan({ declencheur: { type: "fvg_puis_retest", delaiMaxBarres: 10 } }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("long");

    const m = r.trades[0].mecanique;
    expect(m).toHaveLength(1);
    expect(m?.[0]).toEqual({
      forme: "desequilibre",
      // Le trou va du haut de b3 (101) au bas de b5 (106).
      basTicks: 101,
      hautTicks: 106,
      // C'est le bord BAS que le prix revient toucher pour un signal long.
      bordTicks: 101,
      // La boîte naît sur la première des trois bougies, et court jusqu'au
      // signal : sinon on montrerait un rectangle flottant sans début.
      debutMs: s.t[3],
      finMs: s.t[7],
    });
  });

  it("ne redessine PAS le niveau : la boîte est un autre objet", () => {
    // ⚠️ Le piège serait de dessiner une boîte autour du niveau franchi et de
    // l'appeler déséquilibre. Elle aurait l'air juste et ne prouverait rien.
    // Ici le niveau lu au moment du signal vaut 112 (le plus haut des deux
    // bougies précédentes, b5 et b6) et le bord retesté 101 : deux prix
    // franchement différents, et c'est le second qui a déclenché l'entrée.
    const r = lancerBacktest(
      serie(CASSURE_AVEC_TROU),
      plan({ declencheur: { type: "fvg_puis_retest", delaiMaxBarres: 10 } }),
    );
    const m = r.trades[0].mecanique?.[0];
    expect(r.trades[0].niveauSignal).toBe(112);
    expect(m?.forme === "desequilibre" && m.bordTicks).toBe(101);
  });
});

/**
 * Balayage de liquidité, impulsion inverse, retour dans le trou.
 *
 * b0..b3 : plat à 100. Le niveau à b4 vaut max(h2,h3) = 101.
 * b4 : haut 110, au-dessus de 101 : la liquidité est prise. Extrême 110.
 * b6 : son haut (96) est sous le bas de b4 (99) : impulsion baissière avec
 *      trou. La boîte est [96 ; 99], et le prix devra revenir à 99.
 * b8 : son haut touche 100, donc au-dessus de 99 : retour, signal short.
 */
const BALAYAGE_PUIS_TROU: Bougie[] = [
  ...plat(4),
  [100, 110, 99, 100],
  [100, 100, 92, 93],
  [93, 96, 88, 90],
  [90, 94, 89, 93],
  [93, 100, 92, 99],
  [99, 100, 98, 99],
  [99, 100, 78, 79],
];

describe("le balayage se dessine comme une prise de liquidité", () => {
  it("pose DEUX formes, dans l'ordre où les événements ont eu lieu", () => {
    // ⚠️ L'ordre n'est pas cosmétique : c'est justement l'enchaînement
    // « liquidité prise PUIS déséquilibre » qui distingue cette mécanique
    // d'une simple cassure tombée au même endroit.
    const s = serie(BALAYAGE_PUIS_TROU);
    const r = lancerBacktest(
      s,
      plan({
        declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 },
      }),
    );

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");

    const m = r.trades[0].mecanique;
    expect(m).toHaveLength(2);
    expect(m?.[0]).toEqual({
      forme: "balayage",
      // Le niveau dont la liquidité a été prise, et jusqu'où le prix est allé.
      niveauTicks: 101,
      extremeTicks: 110,
      ms: s.t[4],
    });
    expect(m?.[1]).toEqual({
      forme: "desequilibre",
      basTicks: 96,
      hautTicks: 99,
      // Pour un short, c'est le bord HAUT que le prix revient toucher.
      bordTicks: 99,
      debutMs: s.t[4],
      finMs: s.t[8],
    });
  });

  it("distingue le niveau balayé de l'extrême atteint", () => {
    // Les confondre ferait dessiner une mèche de longueur nulle, c'est-à-dire
    // rien du tout, sur l'événement qui ouvre tout le scénario.
    const r = lancerBacktest(
      serie(BALAYAGE_PUIS_TROU),
      plan({
        declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 },
      }),
    );
    const m = r.trades[0].mecanique?.[0];
    expect(m?.forme === "balayage" && m.extremeTicks > m.niveauTicks).toBe(true);
  });
});

describe("les déclencheurs sans forme propre", () => {
  it("une simple cassure ne dessine AUCUNE mécanique", () => {
    // ⚠️ Le niveau EST toute la géométrie d'une cassure. Inventer une boîte
    // pour remplir le graphique montrerait un objet que le trader n'a jamais
    // tracé, et le ferait douter de ce qui est juste par ailleurs.
    const r = lancerBacktest(
      serie(CASSURE_AVEC_TROU),
      plan({ declencheur: { type: "cassure", mode: "cloture" } }),
    );
    expect(r.trades.length).toBeGreaterThan(0);
    for (const tr of r.trades) expect(tr.mecanique).toBeUndefined();
  });
});
