import { describe, expect, it } from "vitest";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * UNE TRENDLINE RELIE LES PIVOTS QUI S'ALIGNENT, PAS LES PIVOTS CONSÉCUTIFS.
 *
 * ⚠️⚠️ NÉ D'UN ÉCART ÉNORME ENTRE LA MACHINE ET LE TRADER. Axel prend plusieurs
 * trades par semaine avec cette méthode ; le moteur en trouvait SEPT en quatre
 * ans. La cause n'était ni les données ni les coûts : le moteur ne suivait
 * qu'UNE droite candidate à la fois, ancrée sur deux pivots CONSÉCUTIFS. Dès
 * qu'un pivot ne tombait pas dessus, la candidate était jetée.
 *
 * Or personne ne trace comme ça. On regarde les derniers sommets, on relie ceux
 * qui s'alignent, et on ignore les autres : la droite passe par les pivots 1, 4
 * et 9 sans rien devoir aux 2, 3, 5 à 8.
 *
 * Mesuré sur les 23 489 bougies H1 du Nasdaq, pivots de largeur 5 et tolérance
 * 6 points : 75 droites confirmées avant, 1419 après. Sur la stratégie complète
 * d'Axel : 7 trades en quatre ans, contre 128 à 270 selon le réglage, soit
 * environ un par semaine — ce qu'il décrit.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

function serie(bougies: Bougie[]): SerieM1 {
  const depart = Date.parse("2026-03-05T08:00:00Z");
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

/** La droite du scénario : un soutien qui descend de deux points par bougie. */
const ligne = (i: number) => 200 - 2 * i;

/**
 * Cinq creux pivots. TROIS tombent exactement sur la droite (4, 16, 28), DEUX
 * tombent vingt points au-dessus (10, 22) : ce sont de vrais creux locaux, mais
 * la droite ne passe pas par eux, et un trader ne les compterait pas.
 *
 * Avec l'ancienne règle, la candidate se refaisait à chaque pivot hors droite,
 * et les trois touches n'arrivaient jamais.
 */
function marcheAvecPivotsIntercalaires(): Bougie[] {
  const SUR_LA_DROITE = new Set([4, 16, 28]);
  const A_COTE = new Set([10, 22]);
  const b: Bougie[] = [];
  for (let i = 0; i < 40; i++) {
    const base = ligne(i);
    const bas = SUR_LA_DROITE.has(i) ? base : A_COTE.has(i) ? base + 20 : base + 40;
    // La bougie 33 casse la droite par le bas : c'est le signal.
    if (i === 33) b.push([base + 50, base + 52, base - 20, base - 16]);
    else b.push([base + 50, base + 60, bas, base + 50]);
  }
  return b;
}

function plan(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "TEST",
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "trendline", pivots: 2, touchesMin: 3, toleranceTicks: 2 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 30 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 },
    ...over,
  };
}

describe("le tracé d'une trendline", () => {
  const s = serie(marcheAvecPivotsIntercalaires());
  const r = lancerBacktest(s, plan());

  it("confirme la droite en SAUTANT les pivots qui ne sont pas dessus", () => {
    expect(r.audit.droitesConfirmees).toBeGreaterThan(0);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("short");
  });

  it("garde exactement les trois touches alignées, et aucune autre", () => {
    // ⚠️ L'ASSERTION QUI DISCRIMINE. Les touches retenues sont les bougies 4, 16
    // et 28 : deux pivots réels (10 et 22) ont été ignorés entre elles. Avec
    // l'ancrage sur pivots consécutifs, une telle droite était impossible.
    const tr = r.trades[0].trace;
    expect(tr?.forme).toBe("droite");
    if (tr?.forme !== "droite") return;

    const barres = tr.touches.map((pt) => Math.round((pt.ms - s.t[0]) / 60_000));
    expect(barres).toEqual([4, 16, 28]);
    for (const pt of tr.touches) {
      const b = Math.round((pt.ms - s.t[0]) / 60_000);
      expect(pt.prixTicks, `touche b${b}`).toBe(ligne(b));
    }
  });

  it("ne compte pas un pivot hors tolérance comme une touche", () => {
    // Les creux des bougies 10 et 22 sont vingt points au-dessus de la droite,
    // pour une tolérance de deux. Les compter reviendrait à tracer une droite
    // qui ne touche rien, ce que le trader verrait immédiatement.
    const tr = r.trades[0].trace;
    if (tr?.forme !== "droite") throw new Error("trace absente");
    const barres = tr.touches.map((pt) => Math.round((pt.ms - s.t[0]) / 60_000));
    expect(barres).not.toContain(10);
    expect(barres).not.toContain(22);
  });

  it("exige toujours le nombre de touches demandé", () => {
    // La règle n'est pas assouplie : quatre touches alignées n'existent pas
    // dans ce marché, donc rien ne se confirme et rien ne se déclenche.
    const strict = lancerBacktest(
      s,
      plan({ niveau: { type: "trendline", pivots: 2, touchesMin: 4, toleranceTicks: 2 } }),
    );
    expect(strict.audit.droitesConfirmees).toBe(0);
    expect(strict.trades).toHaveLength(0);
  });
});
