import { describe, it, expect } from "vitest";
import {
  getDefaultPipValuePerLot,
  getUnitsPerLot,
  computeMaxRiskEur,
  computeLotSize,
  computeContracts,
  actualRiskForContracts,
} from "./position-sizing";

describe("getDefaultPipValuePerLot / getUnitsPerLot", () => {
  it("returns known defaults for forex and metals", () => {
    expect(getDefaultPipValuePerLot("EURUSD")).toBe(10);
    expect(getDefaultPipValuePerLot("USDJPY")).toBe(9);
    expect(getDefaultPipValuePerLot("XAUUSD")).toBe(10);
    expect(getDefaultPipValuePerLot("XAGUSD")).toBe(50);
    expect(getUnitsPerLot("EURUSD")).toBe(100000);
    expect(getUnitsPerLot("XAUUSD")).toBe(100);
  });

  it("returns null where contract specs vary by broker", () => {
    expect(getDefaultPipValuePerLot("NAS100")).toBeNull();
    expect(getDefaultPipValuePerLot("BTCUSD")).toBeNull();
    expect(getUnitsPerLot("WTIUSD")).toBeNull();
  });
});

describe("computeMaxRiskEur", () => {
  it("uses the strategy risk_pct when no DD ceilings are given", () => {
    const r = computeMaxRiskEur({ riskPct: 1, accountSize: 50_000 });
    expect(r).toEqual({ riskEur: 500, cappedBy: "risk_pct" });
  });

  it("returns null when nothing constrains the risk", () => {
    expect(computeMaxRiskEur({ riskPct: null, accountSize: 50_000 })).toBeNull();
    expect(computeMaxRiskEur({ riskPct: 0, accountSize: 50_000 })).toBeNull();
  });

  it("picks the most restrictive ceiling", () => {
    const r = computeMaxRiskEur({
      riskPct: 2, // 1_000
      accountSize: 50_000,
      dailyDdRemainingEur: 300,
      totalDdRemainingEur: 800,
    });
    expect(r).toEqual({ riskEur: 300, cappedBy: "daily_dd" });
  });

  it("treats a remaining DD of 0 as a real ceiling (limit reached)", () => {
    const r = computeMaxRiskEur({
      riskPct: 2,
      accountSize: 50_000,
      dailyDdRemainingEur: 0,
    });
    expect(r).toEqual({ riskEur: 0, cappedBy: "daily_dd" });
  });

  it("never returns a negative risk even if a margin is overshot", () => {
    const r = computeMaxRiskEur({
      accountSize: 50_000,
      totalDdRemainingEur: -200,
    });
    expect(r).toEqual({ riskEur: 0, cappedBy: "total_dd" });
  });
});

describe("computeLotSize", () => {
  it("converts risk € into a lot size rounded to 0.01", () => {
    // 200 € / (20 pips * 10 €/pip/lot) = 1.0 lot
    expect(computeLotSize({ riskEur: 200, slPips: 20, pipValuePerLot: 10 })).toEqual({
      lots: 1,
      raw: 1,
    });
    // 150 € / (30 * 10) = 0.5 lot
    expect(computeLotSize({ riskEur: 150, slPips: 30, pipValuePerLot: 10 })).toEqual({
      lots: 0.5,
      raw: 0.5,
    });
  });

  it("rounds to 0.01 while keeping the raw value", () => {
    const r = computeLotSize({ riskEur: 100, slPips: 33, pipValuePerLot: 10 })!;
    expect(r.lots).toBe(0.3); // 0.303... → 0.30
    expect(r.raw).toBeCloseTo(0.30303, 4);
  });

  it("returns null for invalid inputs", () => {
    expect(computeLotSize({ riskEur: 0, slPips: 20, pipValuePerLot: 10 })).toBeNull();
    expect(computeLotSize({ riskEur: 200, slPips: 0, pipValuePerLot: 10 })).toBeNull();
    expect(computeLotSize({ riskEur: 200, slPips: 20, pipValuePerLot: 0 })).toBeNull();
  });
});

describe("computeContracts (futures) — floors so risk never exceeds budget", () => {
  it("floors the contract count", () => {
    // 1000 $ / (10 pts * 50 $/pt) = 2.0 → 2 contracts
    expect(computeContracts({ riskAmount: 1000, slPoints: 10, pointValue: 50 })).toBe(2);
    // 1000 $ / (12 * 50) = 1.66 → 1 contract (never round up)
    expect(computeContracts({ riskAmount: 1000, slPoints: 12, pointValue: 50 })).toBe(1);
  });

  it("returns 0 when the budget cannot cover a single contract or inputs are invalid", () => {
    expect(computeContracts({ riskAmount: 100, slPoints: 10, pointValue: 50 })).toBe(0);
    expect(computeContracts({ riskAmount: 0, slPoints: 10, pointValue: 50 })).toBe(0);
    expect(computeContracts({ riskAmount: 1000, slPoints: 0, pointValue: 50 })).toBe(0);
  });

  it("actualRiskForContracts reflects the post-floor exposure", () => {
    const contracts = computeContracts({ riskAmount: 1000, slPoints: 12, pointValue: 50 });
    const risk = actualRiskForContracts({ contracts, slPoints: 12, pointValue: 50 });
    expect(risk).toBe(600); // 1 * 12 * 50, ≤ 1000 budget
    expect(risk).toBeLessThanOrEqual(1000);
  });
});

/**
 * UN LOT NE DÉPASSE JAMAIS LE RISQUE DEMANDÉ.
 *
 * ⚠️⚠️ VU À L'ÉCRAN SUR LE CALCULATEUR DE LOT : « RISQUE MAX 500,00 € ·
 * plafonné par ta règle de risque par trade », puis six lignes plus bas « LOT
 * RECOMMANDÉ 0.67 » et « FONDS À RISQUE 502,50 € ». L'outil dont le métier est
 * de risquer EXACTEMENT ce que le trader a décidé lui en proposait 2,50 € de
 * plus que son propre plafond, sur le même écran que le plafond.
 *
 * ⚠️ LA RÈGLE ÉTAIT DÉJÀ ÉCRITE DOUZE LIGNES PLUS BAS, pour les futures :
 * « FLOOR (never round up) — must never exceed riskAmount ». Un contrat est
 * indivisible, donc l'auteur y avait pensé ; un lot se divise par centièmes, et
 * l'arrondi a semblé inoffensif. Sur un compte prop avec une perte journalière
 * plafonnée, il ne l'est pas.
 */
describe("le lot ne dépasse jamais le risque demandé", () => {
  it("descend au centième inférieur plutôt que d'arrondir au plus proche", () => {
    // 500 € / (75 pips × 10 €) = 0,6667 → 0,66 et non 0,67.
    const r = computeLotSize({ riskEur: 500, slPips: 75, pipValuePerLot: 10 })!;
    expect(r.lots).toBe(0.66);
    expect(r.lots * 75 * 10).toBeLessThanOrEqual(500);
  });

  /**
   * ⚠️ SUR MILLE COMBINAISONS, PAS SUR UN EXEMPLE. Un cas choisi à la main
   * prouve qu'il marche une fois ; c'est l'invariant qui compte.
   */
  it("ne dépasse jamais, quelles que soient les valeurs", () => {
    const fautes: string[] = [];
    for (let risque = 10; risque <= 2000; risque += 37) {
      for (let pips = 1; pips <= 200; pips += 7) {
        for (const valeur of [1, 9, 10, 12.5]) {
          const r = computeLotSize({ riskEur: risque, slPips: pips, pipValuePerLot: valeur });
          if (!r) continue;
          const engage = r.lots * pips * valeur;
          // Une tolérance d'un millième d'euro pour les flottants, rien de plus.
          if (engage > risque + 0.001) {
            fautes.push(`${risque}€ / ${pips} pips / ${valeur} → ${engage.toFixed(2)}€`);
          }
        }
      }
    }
    expect(fautes.slice(0, 5), `${fautes.length} dépassements`).toEqual([]);
  });

  /** ⚠️ Et il reste le plus grand lot possible sous le plafond, pas un plus petit. */
  it("prend le plus grand lot qui tienne sous le plafond", () => {
    const r = computeLotSize({ riskEur: 500, slPips: 75, pipValuePerLot: 10 })!;
    expect((r.lots + 0.01) * 75 * 10).toBeGreaterThan(500);
  });
});
