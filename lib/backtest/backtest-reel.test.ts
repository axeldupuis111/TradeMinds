import { describe, expect, it } from "vitest";
import { agreger } from "./serie";
import { lancerBacktest } from "./engine";
import { lireBacktest } from "./verdict";
import { BOUGIES_NAS100, DEBUT_MS, TAILLE_TICK } from "./bougies-reelles";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * NON-RÉGRESSION SUR DE VRAIES BOUGIES.
 *
 * Tous les autres tests du moteur emploient des bougies écrites à la main :
 * ils vérifient des cas qu'on a imaginés, et c'est leur force comme leur
 * limite. Ce fichier rejoue une VRAIE journée du Nasdaq et FIGE les nombres
 * obtenus. Il ne dit pas que le moteur a raison, il dit que son comportement
 * n'a pas changé sans qu'on le veuille.
 *
 * ⚠️ QUAND UN CHIFFRE D'ICI BOUGE, CE N'EST JAMAIS LE TEST QU'IL FAUT METTRE À
 * JOUR EN PREMIER. C'est le moteur qui a changé d'avis sur des données qui,
 * elles, n'ont pas bougé d'un tick depuis mars 2025. Comprendre pourquoi, puis
 * seulement ensuite, réécrire le nombre attendu.
 */

function serieReelle(): SerieM1 {
  const morceaux = BOUGIES_NAS100.split(";");
  const n = morceaux.length;
  const s: SerieM1 = {
    instrument: "NAS100",
    tailleTick: TAILLE_TICK,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const [o, h, l, c] = morceaux[i].split(",").map(Number);
    s.t[i] = DEBUT_MS + i * 60_000;
    s.o[i] = o;
    s.h[i] = h;
    s.l[i] = l;
    s.c[i] = c;
  }
  return s;
}

const SERIE = serieReelle();

function base(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "NAS100",
    uniteDeTemps: 5,
    sens: "les_deux",
    contexte: { fuseau: "Europe/Paris", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "liquidite_swing", pivots: 5 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "dernier_pivot", bufferTicks: 100 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    // 1,5 pt de spread et 0,4 de glissement sur le Nasdaq, tick à 0,001.
    couts: { spreadTicks: 1500, glissementTicks: 400, commissionTicks: 0 },
    ...over,
  };
}

describe("la journée réelle, telle qu'elle est", () => {
  it("est complète et cohérente", () => {
    expect(SERIE.t.length).toBe(1335);
    expect(SERIE.tailleTick).toBe(0.001);
    // Le Nasdaq valait autour de 19 000 points début mars 2025.
    const premier = SERIE.o[0] * SERIE.tailleTick;
    expect(premier).toBeGreaterThan(15_000);
    expect(premier).toBeLessThan(25_000);
    for (let i = 0; i < SERIE.t.length; i++) {
      expect(SERIE.h[i]).toBeGreaterThanOrEqual(Math.max(SERIE.o[i], SERIE.c[i]));
      expect(SERIE.l[i]).toBeLessThanOrEqual(Math.min(SERIE.o[i], SERIE.c[i]));
      if (i > 0) expect(SERIE.t[i]).toBeGreaterThan(SERIE.t[i - 1]);
    }
  });

  it("se regroupe en M5 sans perdre une seule minute", () => {
    const m5 = agreger(SERIE, 5);
    // ⚠️ La somme des amplitudes ne se conserve pas, mais les EXTRÊMES si : le
    // plus haut de la journée doit survivre au regroupement, sinon on aurait
    // fabriqué des bougies plus sages que le marché.
    let hautM1 = -Infinity;
    let basM1 = Infinity;
    for (let i = 0; i < SERIE.t.length; i++) {
      if (SERIE.h[i] > hautM1) hautM1 = SERIE.h[i];
      if (SERIE.l[i] < basM1) basM1 = SERIE.l[i];
    }
    let hautM5 = -Infinity;
    let basM5 = Infinity;
    for (let i = 0; i < m5.t.length; i++) {
      if (m5.h[i] > hautM5) hautM5 = m5.h[i];
      if (m5.l[i] < basM5) basM5 = m5.l[i];
    }
    expect(hautM5).toBe(hautM1);
    expect(basM5).toBe(basM1);
    expect(m5.o[0]).toBe(SERIE.o[0]);
    expect(m5.c[m5.t.length - 1]).toBe(SERIE.c[SERIE.t.length - 1]);
  });
});

describe("chiffres figés sur données réelles", () => {
  /**
   * Chaque ligne est un CONTRAT, et chaque nombre a été relu avant d'être écrit
   * ici. Exemple de la vérification faite : sur le balayage M3, un gagnant dont
   * le risque vaut 12,7 points sort à 1,851 R, et 2 - (1500 + 400) / 12700
   * donne 1,850. L'écart au millième vient de l'arrondi au tick, et le
   * glissement n'apparaît pas parce qu'un objectif est un ordre limite.
   */
  interface CasFige {
    nom: string;
    plan: PlanExecution;
    bougies: number;
    signaux: number;
    trades: number;
    ecartes: number;
    collisions: number;
    totalR: number;
  }

  const CAS: CasFige[] = [
    {
      nom: "cassure de liquidité, M5",
      plan: base(),
      bougies: 267,
      signaux: 5,
      trades: 5,
      ecartes: 0,
      collisions: 0,
      totalR: -0.7,
    },
    {
      nom: "cassure de liquidité, M1",
      plan: base({ uniteDeTemps: 1, niveau: { type: "liquidite_swing", pivots: 15 } }),
      bougies: 1335,
      signaux: 7,
      trades: 7,
      ecartes: 0,
      collisions: 0,
      totalR: -2.52,
    },
    {
      // ⚠️ CHIFFRES REECRITS LE 2026-08-28, ET LA RAISON EST DANS LE MOTEUR.
      // Il ne suivait qu'UNE droite candidate a la fois, ancree sur deux pivots
      // CONSECUTIFS : un pivot qui ne tombait pas dessus jetait la candidate.
      // Un trader, lui, relie les pivots QUI S'ALIGNENT et ignore les autres.
      // Mesure sur les 23 489 bougies H1 du Nasdaq : 75 droites confirmees
      // avant, 1419 apres. Ici, sur la journee figee : 2 signaux -> 4.
      nom: "trendline à trois touches, M5",
      plan: base({ niveau: { type: "trendline", pivots: 4, touchesMin: 3, toleranceTicks: 5000 } }),
      bougies: 267,
      signaux: 4,
      trades: 4,
      ecartes: 0,
      collisions: 0,
      totalR: -0.19,
    },
    {
      nom: "balayage de liquidité puis FVG, M3",
      plan: base({
        uniteDeTemps: 3,
        niveau: { type: "liquidite_swing", pivots: 8 },
        declencheur: { type: "balayage_puis_fvg", delaiReaction: 8, delaiRetest: 12 },
        stop: { type: "extreme_balayage", bufferTicks: 100 },
      }),
      bougies: 445,
      signaux: 9,
      trades: 9,
      ecartes: 0,
      collisions: 0,
      totalR: 4.75,
    },
    {
      // Celui-ci exerce les deux chemins rares : des stops si serrés que trois
      // signaux sont écartés, et deux bougies où stop et objectif tombaient
      // ensemble. Ce sont les cas qu'une journée inventée ne produit jamais.
      nom: "range d'ouverture NY puis FVG, M1",
      plan: base({
        uniteDeTemps: 1,
        niveau: { type: "range_horaire", debut: "15:30", fin: "15:35" },
        declencheur: { type: "fvg_puis_retest", delaiMaxBarres: 10 },
        stop: { type: "structurel", bufferTicks: 100 },
      }),
      bougies: 1335,
      signaux: 16,
      trades: 13,
      ecartes: 3,
      collisions: 2,
      totalR: -5.16,
    },
  ];

  for (const cas of CAS) {
    it(cas.nom, () => {
      const r = lancerBacktest(SERIE, cas.plan);
      expect(r.audit.bougies, "bougies").toBe(cas.bougies);
      expect(r.audit.signaux, "signaux").toBe(cas.signaux);
      expect(r.trades.length, "trades").toBe(cas.trades);
      expect(r.audit.refusesRisqueTropPetit, "écartés").toBe(cas.ecartes);
      expect(r.audit.collisions, "collisions").toBe(cas.collisions);
      expect(r.trades.reduce((a, t) => a + t.r, 0), "total R").toBeCloseTo(cas.totalR, 2);

      // L'invariant de coût vaut aussi sur des données réelles.
      const brut = r.trades.reduce((a, t) => a + t.rBrut, 0);
      const net = r.trades.reduce((a, t) => a + t.r, 0);
      expect(Math.abs(brut - net - r.audit.coutTotalR)).toBeLessThan(1e-9);
    });
  }

  it("une journée seule ne permet jamais de conclure", () => {
    // ⚠️ Le garde-fou le plus utile du fichier : quelle que soit la stratégie,
    // un jour de bougies ne produit pas cent trades. Si ce test passait au
    // verdict chiffré un jour, c'est que le seuil aurait été baissé.
    for (const ut of [1, 3, 5, 15]) {
      const r = lancerBacktest(SERIE, base({ uniteDeTemps: ut }));
      const lecture = lireBacktest(r, base().couts);
      expect(lecture.verdict).toBe("insuffisant");
      expect(lecture.stats).toBeUndefined();
    }
  });

  it("les coûts ne peuvent qu'abaisser le résultat, sur toutes les unités de temps", () => {
    for (const ut of [1, 3, 5, 15]) {
      const sansCout = lancerBacktest(
        SERIE,
        base({ uniteDeTemps: ut, couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 } }),
      );
      const avecCout = lancerBacktest(SERIE, base({ uniteDeTemps: ut }));
      const somme = (t: { r: number }[]) => t.reduce((a, x) => a + x.r, 0);
      if (avecCout.trades.length > 0) {
        expect(somme(avecCout.trades)).toBeLessThanOrEqual(somme(sansCout.trades));
      }
    }
  });
});
