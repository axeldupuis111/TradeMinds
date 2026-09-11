import { describe, expect, it } from "vitest";
import { CAPITAL_NOMINAL, projeterLeBacktest } from "./projection-backtest";
import { MIN_TRADES } from "../projection";
import type { TradeSimule } from "./types";

function trade(jour: number, r: number): TradeSimule {
  const ms = Date.UTC(2024, 0, 1) + jour * 86_400_000;
  return {
    signalMs: ms,
    niveauSignal: 0,
    entreeMs: ms,
    sortieMs: ms + 3_600_000,
    sens: "long",
    entreeTicks: 0,
    sortieTicks: 0,
    risqueTicks: 100,
    r,
    rBrut: r,
    mfeR: Math.max(0, r),
    maeR: Math.min(0, r),
    motif: "objectif",
    collisionMemeBarre: false,
  };
}

/** Une série alternée : deux perdants pour un gagnant à 2R, donc espérance nulle. */
function serie(n: number): TradeSimule[] {
  return Array.from({ length: n }, (_, i) => trade(i, i % 3 === 0 ? 2 : -1));
}

describe("projeter un backtest", () => {
  /**
   * ⚠️ SANS RISQUE PAR TRADE, UN R N'A PAS DE VALEUR EN ARGENT. Poser 1 % à la
   * place du trader produirait un risque de ruine qui n'est pas le sien, sur un
   * écran dont c'est justement le chiffre le plus alarmant.
   */
  it("ne projette rien sans risque par trade", () => {
    expect(projeterLeBacktest(serie(300), undefined)).toBeNull();
    expect(projeterLeBacktest(serie(300), 0)).toBeNull();
  });

  it("ne projette rien sous le seuil de conclusion", () => {
    expect(projeterLeBacktest(serie(MIN_TRADES - 1), 1)).toBeNull();
  });

  it("projette au-dessus du seuil", () => {
    const r = projeterLeBacktest(serie(400), 1);
    expect(r).not.toBeNull();
    expect(r!.projection.trades).toBe(400);
    expect(r!.risquePct).toBe(1);
  });

  /**
   * ⚠️ LE CAPITAL VAUT 100 POUR QUE TOUT SE LISE EN POURCENTS. Doubler le risque
   * par trade doit donc doubler l'échelle des montants rendus, sans qu'on ait
   * jamais demandé son capital au trader.
   */
  it("rend des montants proportionnels au risque par trade", () => {
    const un = projeterLeBacktest(serie(400), 1)!.projection;
    const deux = projeterLeBacktest(serie(400), 2)!.projection;
    expect(deux.esperance).toBeCloseTo(un.esperance * 2, 6);
  });

  it("garde un capital nominal de 100, donc des montants en pourcentage", () => {
    expect(CAPITAL_NOMINAL).toBe(100);
  });

  /**
   * ⚠️ Le rythme se déduit des dates d'OUVERTURE. Une série d'un trade par jour
   * doit donner de l'ordre de trois cents trades par an, pas le double parce
   * que les positions durent une heure.
   */
  it("déduit le rythme des dates d'ouverture", () => {
    const p = projeterLeBacktest(serie(400), 1)!.projection;
    expect(p.tradesParAn).toBeGreaterThan(200);
    expect(p.tradesParAn).toBeLessThan(500);
  });

  /**
   * ⚠️ Le déterminisme est une règle dure de `projection.ts` : un verdict qui
   * bouge à chaque rafraîchissement ne vaut rien. Le brancher sur le backtest ne
   * doit pas l'abîmer.
   */
  it("rend deux fois le même résultat sur la même série", () => {
    const a = projeterLeBacktest(serie(400), 1)!.projection;
    const b = projeterLeBacktest(serie(400), 1)!.projection;
    expect(a).toEqual(b);
  });
});
