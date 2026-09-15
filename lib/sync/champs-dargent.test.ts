import { describe, expect, it } from "vitest";
import {
  avertissementsDuTrade,
  isValidTrade,
  nombreLisible,
  tradeRejectReason,
  type PushTrade,
} from "./push-parse";

/**
 * LES CHAMPS D'ARGENT DU RAIL PUSH.
 *
 * ── LE DÉFAUT, REJOUÉ CONTRE LA PRODUCTION LE 2026-09-15 ────────────────────
 *
 * ⚠️⚠️ HUIT CHAMPS DE FORME ÉTAIENT VALIDÉS (ticket, symbole, sens, volume,
 * prix, heures) ET AUCUN DES CINQ QUI PORTENT LE RÉSULTAT. Mesuré en envoyant
 * de vraies requêtes sur `/api/sync/push` :
 *
 *   - `profit` ABSENT ou `null` → HTTP 200, `synced: 1`, et un trade écrit en
 *     base avec `pnl: null`. En JavaScript `null + 0` vaut 0 : ce trade compte
 *     comme un break-even sur les écrans qui somment et disparaît de ceux qui
 *     filtrent `pnl not null`. Deux chiffres pour le même journal.
 *   - `profit: "1.#INF"` ou `"-nan(ind)"` → **HTTP 500**. Ce sont exactement
 *     les chaînes que `DoubleToString` (MQL) écrit pour un double non
 *     initialisé, terminal déconnecté : l'état déjà capturé pour l'état de
 *     compte dans clients-contract.test.ts.
 *   - `commission`, `swap` ou `sl` illisible → **HTTP 500**, avec « Erreur lors
 *     de l'enregistrement des trades. » pour seule explication, alors que tous
 *     les autres refus rendent un motif imprimable dans le journal de l'EA.
 *   - ET UN SEUL MAUVAIS TRADE EMPORTAIT TOUT LE LOT : un envoi de deux trades
 *     dont un corrompu perdait aussi le bon.
 */
describe("les champs d'argent d'un trade poussé", () => {
  const bon: PushTrade = {
    ticket: 12345,
    symbol: "EURUSD",
    direction: "buy",
    volume: 0.1,
    open_price: 1.085,
    close_price: 1.0865,
    open_time: 1789500000,
    close_time: 1789503600,
    profit: 15,
    commission: -0.7,
    swap: 0,
    source: "mt5",
  };

  it("accepte le trade de référence", () => {
    expect(tradeRejectReason(bon)).toBeNull();
  });

  it("refuse un trade sans résultat, au lieu de l'écrire à vide", () => {
    const sansProfit = { ...bon } as Record<string, unknown>;
    delete sansProfit.profit;
    expect(tradeRejectReason(sansProfit)).toBe("profit absent");
    expect(tradeRejectReason({ ...bon, profit: null })).toBe("profit absent");
  });

  /**
   * ⚠️ CE SONT LES CHAÎNES RÉELLES DE MQL, pas des cas inventés : un `double`
   * non initialisé s'écrit ainsi, et l'envoi part quand même.
   */
  it("refuse les nombres que MetaTrader écrit quand il n'a pas la donnée", () => {
    for (const valeur of ["1.#INF", "-1.#IND", "-nan(ind)", "nan", "inf"]) {
      expect(tradeRejectReason({ ...bon, profit: valeur }), valeur).toBe(
        `profit illisible : ${valeur}`,
      );
    }
    expect(tradeRejectReason({ ...bon, profit: Infinity })).toContain("profit illisible");
    expect(tradeRejectReason({ ...bon, profit: NaN })).toContain("profit illisible");
  });

  it("refuse des frais illisibles : ils changent le résultat net", () => {
    expect(tradeRejectReason({ ...bon, commission: "x" })).toBe("commission illisible : x");
    expect(tradeRejectReason({ ...bon, swap: "1.#INF" })).toBe("swap illisible : 1.#INF");
    // Absents ou nuls, ils restent optionnels.
    expect(tradeRejectReason({ ...bon, commission: undefined, swap: null })).toBeNull();
  });

  /**
   * ⚠️ UN STOP ILLISIBLE NE FAIT PAS PERDRE LE TRADE. Il ne change aucun
   * montant ; le trade est enregistré sans, et l'envoi le SIGNALE.
   */
  it("garde le trade quand c'est le stop qui est illisible, et le dit", () => {
    const t = { ...bon, sl: "abc" as unknown as number };
    expect(tradeRejectReason(t)).toBeNull();
    expect(avertissementsDuTrade(t)).toEqual([
      "sl illisible (abc), trade enregistré sans",
    ]);
    expect(avertissementsDuTrade(bon)).toEqual([]);
  });

  it("accepte une chaîne numérique : plusieurs clients citent leurs nombres", () => {
    expect(nombreLisible("7.50")).toBe(7.5);
    expect(nombreLisible(" -12 ")).toBe(-12);
    expect(tradeRejectReason({ ...bon, profit: "7.50" })).toBeNull();
  });

  it("nombreLisible ne rend jamais un nombre qui casserait la base", () => {
    for (const v of ["1.#INF", "-nan(ind)", "", "  ", "abc", null, undefined, {}, [], NaN, Infinity]) {
      expect(nombreLisible(v), String(v)).toBeNull();
    }
  });

  /**
   * ⚠️ LE LOT ENTIER NE TOMBE PLUS POUR UN SEUL TRADE. C'était la conséquence
   * la plus chère : les clients envoient des lots, et le bon trade partait avec
   * le mauvais.
   */
  it("un mauvais trade dans un lot laisse passer les bons", () => {
    const lot = [bon, { ...bon, ticket: 12346, profit: "abc" }, { ...bon, ticket: 12347 }];
    const acceptes = lot.filter(isValidTrade);
    const refuses = lot.filter((t) => !isValidTrade(t));
    expect(acceptes).toHaveLength(2);
    expect(refuses).toHaveLength(1);
    expect(tradeRejectReason(refuses[0])).toBe("profit illisible : abc");
  });
});
