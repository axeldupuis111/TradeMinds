import { describe, expect, it } from "vitest";
import { chercherReglagesViables, variantes } from "./suggestions";
import { MIN_TRADES_CONCLUSION } from "./verdict";
import { BOUGIES_NAS100, DEBUT_MS, TAILLE_TICK } from "./bougies-reelles";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * Ces tests protègent une frontière, pas un algorithme : l'aide ne doit jamais
 * devenir une recherche du réglage qui BRILLE. Voir l'en-tête de suggestions.ts.
 */

function serieReelle(repetitions = 1): SerieM1 {
  const morceaux = BOUGIES_NAS100.split(";");
  const n = morceaux.length * repetitions;
  const s: SerieM1 = {
    instrument: "NAS100",
    tailleTick: TAILLE_TICK,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  // On répète la journée pour avoir de quoi dépasser le seuil de conclusion :
  // ce qu'on teste ici est la mécanique de recherche, pas le marché.
  for (let k = 0; k < n; k++) {
    const [o, h, l, c] = morceaux[k % morceaux.length].split(",").map(Number);
    s.t[k] = DEBUT_MS + k * 60_000;
    s.o[k] = o;
    s.h[k] = h;
    s.l[k] = l;
    s.c[k] = c;
  }
  return s;
}

function planEtroit(): PlanExecution {
  return {
    instrument: "NAS100",
    uniteDeTemps: 15,
    sens: "les_deux",
    contexte: { fuseau: "Europe/Paris", debut: "14:00", fin: "18:00", jours: [] },
    niveau: { type: "trendline", pivots: 12, touchesMin: 3, toleranceTicks: 500 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "dernier_pivot", bufferTicks: 100 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 1500, glissementTicks: 400, commissionTicks: 0 },
  };
}

describe("recherche de réglages viables", () => {
  const SERIE = serieReelle(40);

  it("ne rend que des réglages qui atteignent vraiment le seuil", () => {
    const s = chercherReglagesViables(SERIE, planEtroit(), TAILLE_TICK);
    for (const sug of s) {
      expect(sug.trades).toBeGreaterThanOrEqual(MIN_TRADES_CONCLUSION);
    }
  });

  it("ne change qu'un seul levier par suggestion", () => {
    // ⚠️ Une suggestion qui réécrit trois réglages ne serait plus la stratégie
    // du trader, et il ne pourrait plus dire ce qui a changé.
    const base = planEtroit();
    for (const sug of chercherReglagesViables(SERIE, base, TAILLE_TICK)) {
      let changes = 0;
      if (JSON.stringify(sug.plan.niveau) !== JSON.stringify(base.niveau)) changes++;
      if (sug.plan.uniteDeTemps !== base.uniteDeTemps) changes++;
      if (JSON.stringify(sug.plan.contexte) !== JSON.stringify(base.contexte)) changes++;
      if (JSON.stringify(sug.plan.declencheur) !== JSON.stringify(base.declencheur)) changes++;
      expect(changes, sug.levier).toBe(1);
    }
  });

  it("ne touche JAMAIS au stop, à l'objectif ni aux coûts", () => {
    // ⚠️ Ce sont les trois réglages qui décident du RÉSULTAT. Les bouger sous
    // couvert d'agrandir l'échantillon reviendrait à chercher la performance à
    // la place du trader, ce que tout le reste de l'outil s'interdit.
    const base = planEtroit();
    for (const sug of chercherReglagesViables(SERIE, base, TAILLE_TICK)) {
      expect(sug.plan.stop).toEqual(base.stop);
      expect(sug.plan.objectif).toEqual(base.objectif);
      expect(sug.plan.couts).toEqual(base.couts);
      expect(sug.plan.gestion).toEqual(base.gestion);
    }
  });

  it("ne rend aucune performance, seulement un compte de trades", () => {
    // La forme même de la sortie interdit d'y lire un résultat.
    for (const sug of chercherReglagesViables(SERIE, planEtroit(), TAILLE_TICK)) {
      expect(Object.keys(sug).sort()).toEqual(["apres", "avant", "levier", "plan", "trades"]);
    }
  });

  it("propose les leviers du moins au plus intrusif", () => {
    const ordre = ["tolerance", "pivots", "unite_de_temps", "seance"];
    const s = chercherReglagesViables(SERIE, planEtroit(), TAILLE_TICK);
    const rangs = s.map((x) => ordre.indexOf(x.levier));
    for (let i = 1; i < rangs.length; i++) {
      expect(rangs[i]).toBeGreaterThanOrEqual(rangs[i - 1]);
    }
  });

  it("ne propose rien quand aucun voisin ne suffit", () => {
    // Sur une seule journée, aucun réglage ne peut produire cent trades : on
    // préfère ne rien proposer plutôt que suggérer un réglage qui échouera.
    const courte = serieReelle(1);
    expect(chercherReglagesViables(courte, planEtroit(), TAILLE_TICK)).toEqual([]);
  });

  it("s'arrête au nombre demandé", () => {
    expect(chercherReglagesViables(SERIE, planEtroit(), TAILLE_TICK, 2).length).toBeLessThanOrEqual(2);
  });
});

/**
 * « LE RÉGLAGE VOISIN LE PLUS PROCHE » DOIT ÊTRE LE PLUS PROCHE.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SOUS CE TITRE EXACT : « Séance ouverte à 00:00-23:59 au
 * lieu de 08:00-17:00 ». Passer de neuf heures à vingt-quatre est le contraire
 * d'un voisin : c'est le changement le plus lourd que cette liste puisse
 * contenir, et c'était le SEUL proposé sur ce levier.
 *
 * ⚠️ ET CE LEVIER N'EST PAS COMME LES AUTRES. Descendre d'une unité de temps se
 * fait devant le même écran, aux mêmes heures. Ouvrir la séance 24 h demande au
 * trader d'être là la nuit : c'est sa vie qu'on règle, pas son graphique, et cet
 * onglet existe pour produire un plan qu'il puisse tenir.
 */
describe("l'élargissement de séance procède par paliers", () => {
  const seances = (heures: { debut: string; fin: string }) =>
    variantes(
      { ...planEtroit(), contexte: { fuseau: "Europe/Paris", ...heures, jours: [] } },
      TAILLE_TICK,
    )
      .filter((v) => v.levier === "seance")
      .map((v) => v.apres);

  it("commence par une heure de chaque côté, pas par la journée entière", () => {
    const s = seances({ debut: "08:00", fin: "17:00" });
    expect(s[0]).toBe("07:00-18:00");
    expect(s).toEqual(["07:00-18:00", "06:00-19:00", "04:00-21:00", "00:00-23:59"]);
  });

  /** ⚠️ La journée entière reste proposée : c'est le dernier palier, pas le premier. */
  it("finit tout de même par ouvrir la journée entière", () => {
    expect(seances({ debut: "08:00", fin: "17:00" })).toContain("00:00-23:59");
  });

  /** ⚠️ Une séance déjà ouverte n'a rien à élargir. */
  it("ne propose rien quand la séance couvre déjà la journée", () => {
    expect(seances({ debut: "00:00", fin: "23:59" })).toEqual([]);
  });

  /** ⚠️ Et aucun palier ne se répète : deux lignes identiques n'apprennent rien. */
  it("ne répète jamais deux fois le même horaire", () => {
    const s = seances({ debut: "01:00", fin: "23:00" });
    expect(new Set(s).size).toBe(s.length);
    expect(s[s.length - 1]).toBe("00:00-23:59");
  });
});
