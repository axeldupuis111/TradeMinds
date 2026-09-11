import { describe, expect, it } from "vitest";
import { geometrieDessin } from "./apercu";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * LA DROITE DESSINÉE EST-ELLE LA DROITE CALCULÉE ?
 *
 * ⚠️ NÉ D'UN DÉFAUT VU À L'ÉCRAN, PAS D'UNE CRAINTE. Le moteur interpole une
 * trendline sur l'INDEX des bougies ; le graphique la redessinait sur
 * l'HORODATAGE, en supposant un pas de temps constant. Les deux ne coïncident
 * que sur un marché ouvert en continu. Dès qu'une nuit ou un week-end passe,
 * l'écart s'installe : sur le Nasdaq, la droite s'affichait à plusieurs
 * centaines de points de son vrai niveau, et ses PROPRES TOUCHES ne tombaient
 * plus dessus. Le trader regardait un objet qui ne touchait rien et ne pouvait
 * évidemment pas y reconnaître sa méthode.
 *
 * Le test tourne donc sur une série TROUÉE. Sur une série continue, la version
 * fausse passait sans broncher : c'est le trou qui révèle le défaut, et c'est
 * pour ça qu'il est ici.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

/**
 * Une série avec un ARRÊT DE COTATION au milieu, comme un week-end.
 * Les bougies restent consécutives en index, mais l'horloge saute.
 */
function serieTrouee(bougies: Bougie[], trouApres: number, trouMinutes: number): SerieM1 {
  const depart = Date.parse("2026-03-02T08:00:00Z");
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
  let horloge = depart;
  for (let i = 0; i < n; i++) {
    if (i === trouApres) horloge += trouMinutes * 60_000;
    s.t[i] = horloge;
    horloge += 60_000;
    s.o[i] = bougies[i][0];
    s.h[i] = bougies[i][1];
    s.l[i] = bougies[i][2];
    s.c[i] = bougies[i][3];
  }
  return s;
}

/**
 * Un soutien descendant touché trois fois, puis cassé.
 *
 * Les creux tombent en 3, 13 et 23, à 200, 180 et 160 : trois points
 * parfaitement alignés, une baisse de 2 par bougie. La bougie 33 clôture sous
 * la droite et déclenche la vente.
 */
function marcheTrendline(): Bougie[] {
  const b: Bougie[] = [];
  for (let i = 0; i < 40; i++) {
    // La droite vaut 206 - 2i. Le prix flotte au-dessus, sauf aux creux.
    const droite = 206 - 2 * i;
    if (i === 3 || i === 13 || i === 23) b.push([droite + 12, droite + 14, droite, droite + 10]);
    else if (i === 33) b.push([droite + 10, droite + 11, droite - 30, droite - 25]);
    else b.push([droite + 12, droite + 16, droite + 8, droite + 12]);
  }
  return b;
}

function plan(): PlanExecution {
  return {
    instrument: "TEST",
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "trendline", pivots: 2, touchesMin: 3, toleranceTicks: 2 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 10 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 },
  };
}

/** La table que le worker construit, et le seul moyen juste de convertir. */
function tableIndex(s: SerieM1): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 0; i < s.t.length; i++) m.set(s.t[i], i);
  return m;
}

describe("la droite dessinée est la droite calculée", () => {
  // Un trou de deux jours après la vingtième bougie : entre le premier ancrage
  // et la cassure, l'horloge et l'index ne disent plus la même chose.
  const s = serieTrouee(marcheTrendline(), 20, 2880);
  const r = lancerBacktest(s, plan());

  it("la stratégie d'essai produit bien une trendline confirmée", () => {
    // Sans ça, les tests suivants passeraient en ne vérifiant rien.
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades[0].trace?.forme).toBe("droite");
  });

  it("chaque touche tombe EXACTEMENT sur la droite, malgré le trou", () => {
    const { trace } = geometrieDessin(r.trades[0], tableIndex(s), 0, 1);
    expect(trace?.forme).toBe("droite");
    if (trace?.forme !== "droite") return;

    const pente = (trace.b.prix - trace.a.prix) / (trace.b.i - trace.a.i);
    for (const pt of trace.touches) {
      const attendu = trace.a.prix + pente * (pt.i - trace.a.i);
      // Un tick de marge pour l'arrondi du moteur, pas davantage.
      expect(Math.abs(pt.prix - attendu), `touche i=${pt.i}`).toBeLessThanOrEqual(1);
    }
  });

  it("la conversion PAR LE TEMPS, elle, se trompe franchement", () => {
    // ⚠️ Ce test existe pour prouver que le précédent DISCRIMINE. Sans lui, on
    // ne saurait pas si la vérification tient parce que le code est juste ou
    // parce que le jeu d'essai est trop gentil.
    const brute = r.trades[0].trace;
    expect(brute?.forme).toBe("droite");
    if (brute?.forme !== "droite") return;

    const pas = s.t[1] - s.t[0];
    const enTemps = (ms: number) => (ms - s.t[0]) / pas;
    const pente =
      (brute.b.prixTicks - brute.a.prixTicks) / (enTemps(brute.b.ms) - enTemps(brute.a.ms));

    const ecarts = brute.touches.map((pt) =>
      Math.abs(pt.prixTicks - (brute.a.prixTicks + pente * (enTemps(pt.ms) - enTemps(brute.a.ms)))),
    );
    // Au moins une touche à des dizaines de ticks de la droite : c'est ce que
    // le trader voyait, une droite qui ne touche rien.
    expect(Math.max(...ecarts)).toBeGreaterThan(10);
  });

  it("un ancrage antérieur à la fenêtre garde un index NÉGATIF", () => {
    // Il doit sortir du cadre par la gauche, pas se replier sur la première
    // colonne : une droite repliée sur le bord change de pente, et c'est de
    // nouveau un objet que le trader n'a pas tracé.
    const { trace } = geometrieDessin(r.trades[0], tableIndex(s), 30, 1);
    if (trace?.forme !== "droite") throw new Error("trace absente");
    expect(trace.a.i).toBeLessThan(0);
  });
});
