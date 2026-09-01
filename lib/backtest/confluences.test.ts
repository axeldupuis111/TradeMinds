import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FILTRES_MAX, mesurerConfluences } from "./confluences";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution, SerieM1 } from "./types";

const NAS = instrumentParCode("NAS100")!;

function serie(n: number): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  let x = 7;
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

function plan(confirmations: PlanExecution["confirmations"] = []): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 5,
    contexte: { fuseau: "Europe/Paris", debut: "00:00", fin: "23:59", jours: [0, 1, 2, 3, 4, 5, 6] },
    niveau: { type: "liquidite_swing", pivots: 10 },
    declencheur: { type: "balayage_retour" },
    confirmations,
    stop: { type: "structurel", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
  };
}

describe("les confluences", () => {
  const s = serie(80_000);

  it("mesure tous les filtres du catalogue quand le plan n'en a aucun", () => {
    const r = mesurerConfluences(s, plan(), plan().couts, NAS);
    expect(r.length).toBeGreaterThan(3);
    expect(r.every((x) => !x.deja)).toBe(true);
  });

  /**
   * ⚠️ CE QU'IL A DÉJÀ PASSE EN PREMIER, et c'est toute la différence avec une
   * optimisation. Lui dire que SON RSI ne trie rien est un fait sur sa méthode ;
   * lui proposer d'en ajouter un est une suggestion. Les deux n'ont pas le même
   * poids et ne se lisent pas dans le même ordre.
   */
  it("examine d'abord les filtres que le trader a déjà", () => {
    const avecRsi = plan([{ type: "rsi", periode: 14, seuil: 55, mode: "momentum" }]);
    const r = mesurerConfluences(s, avecRsi, avecRsi.couts, NAS);
    expect(r[0].deja).toBe(true);
    expect(r[0].type).toBe("rsi");
  });

  it("ne propose pas d'ajouter un filtre déjà présent", () => {
    const avecRsi = plan([{ type: "rsi", periode: 14, seuil: 55, mode: "momentum" }]);
    const r = mesurerConfluences(s, avecRsi, avecRsi.couts, NAS);
    expect(r.filter((x) => x.type === "rsi")).toHaveLength(1);
  });

  /**
   * ⚠️ Un filtre n'ajoute JAMAIS de trade, il en écarte. Si « sans » n'en a pas
   * plus que « avec », c'est que la mesure s'est trompée de sens quelque part.
   */
  it("un filtre n'ajoute jamais de trades", () => {
    for (const c of mesurerConfluences(s, plan(), plan().couts, NAS)) {
      expect(c.tradesAvec).toBeLessThanOrEqual(c.tradesSans);
      expect(c.partEcarteePct).toBeGreaterThanOrEqual(0);
    }
  });

  it("borne le nombre de filtres essayés", () => {
    expect(mesurerConfluences(s, plan(), plan().couts, NAS).length).toBeLessThanOrEqual(
      FILTRES_MAX,
    );
  });

  it("rend l'avancement pour que l'attente soit lisible", () => {
    const vus: number[] = [];
    mesurerConfluences(s, plan(), plan().couts, NAS, (faits) => vus.push(faits));
    expect(vus[vus.length - 1]).toBe(vus.length);
  });

  /**
   * ⚠️ Un filtre qui laisse trop peu de trades ne « ne trie rien » pas : il
   * empêche la stratégie d'être démontrable du tout, et c'est une information
   * différente, plus grave, qui mérite son propre mot.
   */
  it("distingue « n'assèche » de « ne trie rien »", () => {
    const courte = serie(4000);
    const r = mesurerConfluences(courte, plan(), plan().couts, NAS);
    for (const c of r) {
      if (c.esperanceAvecR == null) expect(c.effet).toBe("assechele");
    }
  });

  it("ne rend jamais un effet inconnu", () => {
    const connus = ["ne_trie_rien", "ecarte_des_perdants", "ecarte_des_gagnants", "assechele"];
    for (const c of mesurerConfluences(s, plan(), plan().couts, NAS)) {
      expect(connus).toContain(c.effet);
    }
  });
});

/**
 * ⚠️⚠️ LE GARDE-FOU. Essayer sept filtres et garder celui qui sort le mieux est
 * un balayage, exactement ce que cette page refuse partout ailleurs. Ce qui rend
 * celui-ci défendable, c'est qu'il rend TOUT et ne désigne rien.
 */
describe("aucun filtre n'est mis en avant", () => {
  const source = readFileSync(join(process.cwd(), "lib/backtest/confluences.ts"), "utf8");
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("ne trie jamais les filtres par ce qu'ils rapportent", () => {
    expect(sansCommentaires).not.toMatch(/\.sort\([^)]*esperance/i);
    expect(sansCommentaires).not.toMatch(/meilleurFiltre|recommand/i);
  });

  it("rend l'ordre du catalogue, pas un ordre calculé", () => {
    const s = serie(80_000);
    const deux = mesurerConfluences(s, plan(), plan().couts, NAS).map((c) => c.type);
    const encore = mesurerConfluences(s, plan(), plan().couts, NAS).map((c) => c.type);
    expect(deux).toEqual(encore);
  });
});
