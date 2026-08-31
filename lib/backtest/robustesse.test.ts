import { describe, expect, it } from "vitest";
import { concentration, MIN_TRADES_TRANCHE } from "./robustesse";
import type { TradeSimule } from "./types";

/** Un trade réduit à ce que la décomposition regarde : sa date de sortie et son R. */
function trade(sortie: string, r: number): TradeSimule {
  return {
    signalMs: Date.parse(sortie),
    niveauSignal: 0,
    entreeMs: Date.parse(sortie),
    sortieMs: Date.parse(sortie),
    sens: "long",
    entreeTicks: 0,
    sortieTicks: 0,
    risqueTicks: 100,
    r,
    rBrut: r,
    motif: "objectif",
    collisionMemeBarre: false,
  };
}

/** `n` trades étalés sur un mois, tous au même R. */
function mois(aaaaMm: string, n: number, r: number): TradeSimule[] {
  return Array.from({ length: n }, (_, i) =>
    trade(`${aaaaMm}-${String((i % 27) + 1).padStart(2, "0")}T12:00:00Z`, r),
  );
}

describe("d'où vient le résultat dans le temps", () => {
  it("ne décompose pas un échantillon trop petit", () => {
    expect(concentration(mois("2024-01", MIN_TRADES_TRANCHE - 1, 1))).toBeNull();
  });

  it("range les trades par année et par trimestre", () => {
    const trades = [...mois("2024-02", 15, 0.1), ...mois("2025-08", 15, 0.2)];
    const c = concentration(trades)!;
    expect(c.annees.map((a) => a.cle)).toEqual(["2024", "2025"]);
    expect(c.trimestres.map((t) => t.cle)).toEqual(["2024-T1", "2025-T3"]);
    expect(c.annees[0].trades).toBe(15);
  });

  /**
   * ⚠️ LE CAS QUI JUSTIFIE TOUT LE FICHIER. Quatre ans de rien plus un mois où
   * tout est arrivé donnent le même chiffre global qu'un avantage régulier, et
   * ce n'est pas la même chose : le premier était une occasion, le second se
   * retrade.
   */
  it("voit qu'un seul mois porte tout le résultat", () => {
    const trades = [...mois("2024-01", 30, 0), ...mois("2024-03", 30, 1)];
    const c = concentration(trades)!;
    expect(c.meilleurMois).toBe("2024-03");
    expect(c.partDuMeilleurMois).toBeCloseTo(100, 6);
    expect(c.totalSansLeMeilleurMoisR).toBeCloseTo(0, 6);
    expect(c.tientSansSonMeilleurMois).toBe(false);
  });

  it("voit aussi qu'un résultat est réparti", () => {
    const trades = [
      ...mois("2024-01", 25, 0.3),
      ...mois("2024-06", 25, 0.3),
      ...mois("2025-02", 25, 0.3),
    ];
    const c = concentration(trades)!;
    expect(c.tientSansSonMeilleurMois).toBe(true);
    expect(c.partDuMeilleurMois).toBeLessThan(40);
  });

  /**
   * ⚠️ LA PART PEUT DÉPASSER 100 %, et il ne faut surtout pas la plafonner :
   * quand le reste de la période perd, un unique mois porte plus que le total,
   * et c'est exactement le cas qu'il faut voir.
   */
  it("laisse la part dépasser cent pour cent quand le reste perd", () => {
    const trades = [...mois("2024-01", 30, -0.5), ...mois("2024-03", 30, 1)];
    const c = concentration(trades)!;
    expect(c.partDuMeilleurMois).toBeGreaterThan(100);
    expect(c.totalSansLeMeilleurMoisR).toBeLessThan(0);
  });

  /**
   * ⚠️ Un plan qui perd partout ne « tient » pas parce qu'il perdrait un peu
   * moins sans son meilleur mois. La question posée est « méthode ou accident »,
   * pas « rentable ou non ».
   */
  it("ne dit pas qu'un plan perdant tient sans son meilleur mois", () => {
    const trades = [...mois("2024-01", 30, -1), ...mois("2024-03", 30, 0.1)];
    expect(concentration(trades)!.tientSansSonMeilleurMois).toBe(false);
  });

  it("compte les années positives", () => {
    const trades = [
      ...mois("2023-05", 20, 0.5),
      ...mois("2024-05", 20, -0.5),
      ...mois("2025-05", 20, 0.5),
    ];
    expect(concentration(trades)!.anneesPositives).toBe(2);
  });

  /**
   * ⚠️ ON RANGE SUR LA SORTIE, PAS SUR LE SIGNAL. Un trade ouvert le 30
   * décembre et fermé le 3 janvier se solde en janvier ; le compter en décembre
   * mettrait un gain dans le mois qui ne l'a pas produit.
   */
  it("range un trade sur sa date de sortie", () => {
    const trades = mois("2024-05", 25, 0.2);
    const aCheval = trade("2025-01-03T10:00:00Z", 5);
    aCheval.signalMs = Date.parse("2024-12-30T10:00:00Z");
    const c = concentration([...trades, aCheval])!;
    expect(c.annees.map((a) => a.cle)).toEqual(["2024", "2025"]);
    expect(c.annees[1].totalR).toBeCloseTo(5, 6);
  });

  it("ne divise pas par un total nul", () => {
    const trades = [...mois("2024-01", 15, 1), ...mois("2024-02", 15, -1)];
    const c = concentration(trades)!;
    expect(c.totalR).toBeCloseTo(0, 6);
    expect(Number.isFinite(c.partDuMeilleurMois)).toBe(true);
  });
});
