import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { barreDeRecherche, explorer, type Dimension } from "./exploration";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution, SerieM1 } from "./types";

const NAS = instrumentParCode("NAS100")!;

function serie(n: number, graine = 3): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  let x = graine;
  let prix = 15_000_000;
  const depart = Date.UTC(2024, 0, 1, 8, 0, 0);
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    prix += Math.round((x / 0x7fffffff - 0.5) * 3000);
    const amp = 500 + (x % 900);
    t[i] = depart + i * 60_000;
    o[i] = prix;
    h[i] = prix + amp;
    l[i] = prix - amp;
    c[i] = prix + Math.round((x % 200) - 100);
  }
  return { instrument: "NAS100", tailleTick: 0.001, t, o, h, l, c };
}

function plan(): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 5,
    contexte: { fuseau: "Europe/Paris", debut: "00:00", fin: "23:59", jours: [0, 1, 2, 3, 4, 5, 6] },
    niveau: { type: "liquidite_swing", pivots: 10 },
    declencheur: { type: "balayage_retour" },
    confirmations: [],
    stop: { type: "structurel", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
  };
}

const UT: Dimension = {
  cle: "unite_de_temps",
  valeurs: [5, 15, 30].map((v) => ({
    etiquette: `M${v}`,
    appliquer: (p: PlanExecution) => ({ ...p, uniteDeTemps: v }),
  })),
};

const OBJECTIF: Dimension = {
  cle: "objectif_r",
  valeurs: [1.5, 2, 3].map((r) => ({
    etiquette: `${r} R`,
    appliquer: (p: PlanExecution) => ({ ...p, objectif: { type: "multiple_r" as const, r } }),
  })),
};

describe("la barre monte avec le nombre d'essais", () => {
  /**
   * ⚠️ CE N'EST PAS UN SEUIL CHOISI, c'est le maximum attendu du bruit pur.
   * Tirer n échantillons centrés et garder le plus grand donne environ
   * √(2 ln n) écarts-types, sans qu'aucun avantage n'existe.
   */
  it("vaut le seuil ordinaire pour un seul essai", () => {
    expect(barreDeRecherche(1)).toBe(1.96);
    expect(barreDeRecherche(0)).toBe(1.96);
  });

  it("monte avec le nombre de combinaisons", () => {
    expect(barreDeRecherche(26)).toBeCloseTo(2.552, 2);
    expect(barreDeRecherche(200)).toBeCloseTo(3.256, 2);
    expect(barreDeRecherche(1000)).toBeCloseTo(3.717, 2);
  });

  it("ne descend jamais sous le seuil ordinaire", () => {
    for (const n of [1, 2, 3, 5, 6]) {
      expect(barreDeRecherche(n)).toBeGreaterThanOrEqual(1.96);
    }
  });

  it("croît strictement une fois le seuil ordinaire dépassé", () => {
    expect(barreDeRecherche(500)).toBeGreaterThan(barreDeRecherche(50));
    expect(barreDeRecherche(50)).toBeGreaterThan(barreDeRecherche(10));
  });
});

describe("l'exploration", () => {
  const s = serie(80_000);

  it("essaie chaque valeur de chaque dimension, et les compte toutes", () => {
    const r = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    expect(r.essais).toBe(6);
    expect(r.journal).toHaveLength(6);
  });

  /**
   * ⚠️ RIEN N'EST CACHÉ. Une exploration dont on ne voit que le gagnant est
   * indiscernable d'une exploration truquée : le journal doit rendre TOUS les
   * essais, retenus ou non.
   */
  it("garde au journal les essais écartés, pas seulement le survivant", () => {
    const r = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    expect(r.journal.filter((e) => !e.retenu).length).toBeGreaterThan(0);
    expect(r.journal.every((e) => e.dimension && e.etiquette)).toBe(true);
  });

  it("retient au plus une valeur par dimension", () => {
    const r = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    for (const d of ["unite_de_temps", "objectif_r"]) {
      expect(r.journal.filter((e) => e.dimension === d && e.retenu).length).toBeLessThanOrEqual(1);
    }
  });

  it("rend l'avancement pour que l'attente soit lisible", () => {
    const vus: number[] = [];
    explorer(s, plan(), plan().couts, [UT, OBJECTIF], (faits) => vus.push(faits));
    expect(vus).toEqual([1, 2, 3, 4, 5, 6]);
  });

  /**
   * ⚠️ ON SÉLECTIONNE SUR LE t, PAS SUR L'ESPÉRANCE. Une combinaison qui rend
   * +0,4 R sur 60 trades est moins solide qu'une qui rend +0,08 R sur 900 :
   * trier par espérance retiendrait systématiquement la moins mesurée, donc la
   * plus chanceuse.
   */
  it("ne retient jamais une valeur sans t mesurable", () => {
    const r = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    for (const e of r.journal.filter((x) => x.retenu)) expect(e.t).not.toBeNull();
  });

  it("ne change de valeur que si le t s'améliore", () => {
    const r = explorer(s, plan(), plan().couts, [UT]);
    const retenu = r.journal.find((e) => e.retenu);
    if (retenu) {
      const autres = r.journal.filter((e) => e.dimension === "unite_de_temps" && e.t != null);
      expect(retenu.t!).toBe(Math.max(...autres.map((e) => e.t!)));
    }
  });

  it("rend un plan utilisable même quand rien n'est retenu", () => {
    const r = explorer(serie(2000), plan(), plan().couts, [UT]);
    expect(r.plan).toBeTruthy();
    expect(r.franchitLaBarre).toBe(false);
  });

  /**
   * ⚠️ LE CAS NORMAL EST « NON ». Un « non » qui a essayé six combinaisons et les
   * montre toutes vaut infiniment plus qu'un « non » qui n'a rien tenté : il dit
   * où on a cherché.
   */
  it("ne franchit la barre que si le t la dépasse vraiment", () => {
    const r = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    expect(r.franchitLaBarre).toBe(r.t != null && r.t >= r.barre);
    expect(r.barre).toBeCloseTo(barreDeRecherche(6), 6);
  });

  it("est déterministe : deux explorations identiques rendent la même chose", () => {
    const a = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    const b = explorer(s, plan(), plan().couts, [UT, OBJECTIF]);
    expect(a.journal).toEqual(b.journal);
    expect(a.t).toBe(b.t);
  });
});

/**
 * ⚠️⚠️ LES GARDE-FOUS QUI SÉPARENT CETTE EXPLORATION D'UNE MACHINE À
 * COÏNCIDENCES. Ce module fait exactement ce que la page refusait : il cherche.
 * Ce qui le rend défendable tient dans le code, pas dans les commentaires.
 */
describe("ce que l'exploration s'interdit", () => {
  const source = readFileSync(join(process.cwd(), "lib/backtest/exploration.ts"), "utf8");
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  /**
   * ⚠️ Elle ne reçoit QU'UNE série : celle de la fenêtre d'entraînement. Ne pas
   * lui donner les bougies de confirmation est ce qui rend la triche
   * impossible, plutôt que seulement interdite.
   */
  it("ne connaît qu'une seule série de bougies", () => {
    const signature = source.slice(source.indexOf("export function explorer("));
    expect(signature.slice(0, signature.indexOf(")"))).not.toMatch(/confirmation|horsPeriode/i);
    expect((source.match(/serie: SerieM1/g) ?? []).length).toBeLessThanOrEqual(2);
  });

  it("ne trie jamais par espérance", () => {
    expect(sansCommentaires).not.toMatch(/\.sort\([^)]*esperance/i);
    expect(sansCommentaires).not.toMatch(/esperanceR\s*>\s*meilleur/);
  });

  it("compte toujours les essais dans la barre", () => {
    expect(sansCommentaires).toContain("barreDeRecherche(faits)");
  });
});
