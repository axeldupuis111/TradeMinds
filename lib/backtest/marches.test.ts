import { describe, expect, it } from "vitest";
import {
  amplitudeTypique,
  lireLesMarches,
  transposerPlan,
  type ResultatMarche,
} from "./marches";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution, SerieM1 } from "./types";

const NAS = instrumentParCode("NAS100")!;
const BTC = instrumentParCode("BTCUSD")!;

/** Une série dont chaque bougie a exactement l'amplitude demandée, en ticks. */
function serie(amplitudeTicks: number, tailleTick: number, n = 500): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  const depart = Date.UTC(2024, 0, 1, 8, 0, 0);
  for (let i = 0; i < n; i++) {
    t[i] = depart + i * 60_000;
    o[i] = 1_000_000;
    h[i] = 1_000_000 + amplitudeTicks;
    l[i] = 1_000_000;
    c[i] = 1_000_000;
  }
  return { instrument: "X", tailleTick, t, o, h, l, c };
}

function plan(partiel: Partial<PlanExecution> = {}): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 1,
    niveau: { type: "trendline", pivots: 20, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    stop: { type: "fixe", ticks: 10_000 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: { risqueParTradePct: 1 },
    couts: coutsPourInstrument(NAS),
    ...partiel,
  };
}

describe("l'amplitude typique d'une bougie", () => {
  it("rend la médiane en points, pas en ticks", () => {
    // 2000 ticks de 0,001 point font 2 points.
    expect(amplitudeTypique(serie(2000, 0.001), 1)).toBeCloseTo(2, 6);
  });

  /**
   * ⚠️ LA MÉDIANE, PAS LA MOYENNE. Une poignée de bougies de publication
   * économique suffirait à doubler une moyenne, et toute l'échelle de
   * transposition partirait avec elle.
   */
  it("ne se laisse pas emporter par quelques bougies énormes", () => {
    const s = serie(1000, 0.001, 500);
    for (let i = 0; i < 20; i++) s.h[i] = s.l[i] + 500_000;
    expect(amplitudeTypique(s, 1)).toBeCloseTo(1, 6);
  });

  it("rend zéro sur une série vide plutôt que de diviser par rien", () => {
    const vide: SerieM1 = {
      instrument: "X",
      tailleTick: 0.001,
      t: new Float64Array(0),
      o: new Int32Array(0),
      h: new Int32Array(0),
      l: new Int32Array(0),
      c: new Int32Array(0),
    };
    expect(amplitudeTypique(vide, 1)).toBe(0);
  });
});

describe("transposer un plan d'un marché à l'autre", () => {
  /**
   * ⚠️ LE CŒUR DE LA RÈGLE. « Une tolérance de 3 points sur un marché dont la
   * bougie fait 15 points » vaut 0,2 bougie ; sur un marché dont la bougie fait
   * 150 points, ça doit redonner 30 points. Garder les mêmes ticks aurait donné
   * une tolérance deux cents fois trop fine, et un « zéro trade » qui n'aurait
   * rien à voir avec la méthode.
   */
  it("met les distances à l'échelle de l'amplitude du marché cible", () => {
    const p = transposerPlan(plan(), NAS, BTC, 15, 150);
    expect(p.niveau.type === "trendline" && p.niveau.toleranceTicks).toBeTruthy();
    if (p.niveau.type !== "trendline" || p.stop.type !== "fixe") throw new Error("forme");
    // 3000 ticks NAS = 3 points = 0,2 bougie ; 0,2 × 150 = 30 points BTC ;
    // 30 / 0,1 = 300 ticks BTC.
    expect(p.niveau.toleranceTicks).toBe(300);
    // 10 000 ticks NAS = 10 points = 0,667 bougie ; × 150 = 100 points = 1000 ticks.
    expect(p.stop.ticks).toBe(1000);
  });

  /**
   * ⚠️ CE QUI SE COMPTE EN BOUGIES NE SE MET PAS À L'ÉCHELLE. Une largeur de
   * pivot, une période, un délai ne dépendent pas du prix : les convertir serait
   * une faute, et une faute invisible.
   */
  it("ne touche pas à ce qui se compte en bougies", () => {
    const p = transposerPlan(plan(), NAS, BTC, 15, 150);
    if (p.niveau.type !== "trendline") throw new Error("forme");
    expect(p.niveau.pivots).toBe(20);
    expect(p.niveau.touchesMin).toBe(3);
    expect(p.uniteDeTemps).toBe(1);
  });

  it("ne touche ni à l'objectif en R ni au risque en pourcent", () => {
    const p = transposerPlan(plan(), NAS, BTC, 15, 150);
    expect(p.objectif).toEqual({ type: "multiple_r", r: 2 });
    expect(p.gestion.risqueParTradePct).toBe(1);
  });

  /**
   * ⚠️ LES COÛTS SONT CEUX DU MARCHÉ CIBLE. Transporter le spread du Nasdaq sur
   * le Bitcoin fabriquerait un avantage de toutes pièces, et c'est exactement
   * l'erreur qui rendait « rentable » la stratégie de la vidéo.
   */
  it("prend les coûts du marché d'arrivée", () => {
    const p = transposerPlan(plan(), NAS, BTC, 15, 150);
    expect(p.couts).toEqual(coutsPourInstrument(BTC));
    expect(p.instrument).toBe("BTCUSD");
  });

  it("met aussi à l'échelle le filtre d'amplitude minimale", () => {
    const p = transposerPlan(
      plan({ confirmations: [{ type: "amplitude_min", ticks: 3000 }] }),
      NAS,
      BTC,
      15,
      150,
    );
    const f = p.confirmations[0];
    expect(f.type === "amplitude_min" && f.ticks).toBe(300);
  });

  /**
   * ⚠️ Une distance mise à zéro rendrait le stop ou la tolérance inutilisables,
   * et le marché cible sortirait « zéro trade » pour une raison qui n'a rien à
   * voir avec la méthode.
   */
  it("ne réduit jamais une distance à zéro", () => {
    const p = transposerPlan(plan({ stop: { type: "fixe", ticks: 1 } }), NAS, BTC, 1500, 1);
    if (p.stop.type !== "fixe") throw new Error("forme");
    expect(p.stop.ticks).toBeGreaterThanOrEqual(1);
  });

  it("laisse le plan intact quand une amplitude est inconnue", () => {
    const p = transposerPlan(plan(), NAS, BTC, 0, 150);
    if (p.stop.type !== "fixe") throw new Error("forme");
    expect(p.stop.ticks).toBe(10_000);
  });
});

describe("lire une série de marchés", () => {
  const m = (partiel: Partial<ResultatMarche>): ResultatMarche => ({
    code: "X",
    nom: "X",
    trades: 400,
    esperanceR: 0.1,
    borneBasse: 0.02,
    borneHaute: 0.18,
    avantageRetrouve: true,
    insuffisant: false,
    sien: false,
    moisManquants: 0,
    ...partiel,
  });

  /**
   * ⚠️⚠️ LE CAS QU'IL FAUT SAVOIR NOMMER. Une méthode qui ne tient que sur son
   * marché d'origine ressemble à une bonne nouvelle et en est le contraire :
   * elle ne décrit pas ce marché-là, elle décrit la chance qu'elle y a eue.
   */
  it("nomme le cas où seul le marché d'origine tient", () => {
    const r = lireLesMarches([
      m({ sien: true, avantageRetrouve: true }),
      m({ avantageRetrouve: false }),
      m({ avantageRetrouve: false }),
    ]);
    expect(r.verdict).toBe("seul_le_sien");
  });

  it("voit un avantage partagé entre plusieurs marchés", () => {
    const r = lireLesMarches([
      m({ sien: true }),
      m({}),
      m({ avantageRetrouve: false }),
    ]);
    expect(r.verdict).toBe("partage");
    expect(r.retrouves).toBe(2);
  });

  it("voit un avantage qu'on ne retrouve nulle part", () => {
    const r = lireLesMarches([m({ avantageRetrouve: false }), m({ avantageRetrouve: false })]);
    expect(r.verdict).toBe("nulle_part");
  });

  it("ne conclut rien avec moins de deux marchés mesurables", () => {
    const r = lireLesMarches([m({ sien: true }), m({ insuffisant: true })]);
    expect(r.verdict).toBe("indecidable");
  });

  it("ne compte jamais un marché insuffisant comme mesurable", () => {
    const r = lireLesMarches([m({}), m({}), m({ insuffisant: true, avantageRetrouve: true })]);
    expect(r.mesurables).toBe(2);
  });
});
