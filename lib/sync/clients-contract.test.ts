import { describe, it, expect } from "vitest";
import { readAccountSnapshot, accountSnapshotRejectReason, isValidTrade } from "./push-parse";

/**
 * Contrat des clients installés chez l'utilisateur.
 *
 * Ces charges utiles reproduisent, champ pour champ, ce que chaque client
 * concatène réellement (voir public/TradeDiscipline_*). Aucun de ces fichiers
 * n'est compilable ici : ce test est le seul garde-fou contre une divergence
 * entre un client et le rail qui le reçoit.
 */
describe("charges utiles des clients de synchronisation", () => {
  // cTrader : Account.Number (long), Num(x, 2), Positions.Count, Account.Currency
  const ctrader = JSON.parse(
    '{"account":"3012345","balance":10432.5,"equity":10510.25,' +
      '"open_positions":2,"currency":"EUR","source":"ctrader"}',
  );

  // NinjaTrader : account.Name (texte, pas un numéro), Denomination mappée en ISO
  const ninja = JSON.parse(
    '{"account":"Sim101","balance":50000.0,"equity":49875.5,' +
      '"open_positions":1,"currency":"USD","source":"ninjatrader"}',
  );

  // MetaTrader : ACCOUNT_LOGIN, DoubleToString(x, 2), PositionsTotal()
  const metatrader = JSON.parse(
    '{"account":"531066904","balance":85090.96,"equity":85090.96,' +
      '"open_positions":0,"currency":"EUR","source":"mt5"}',
  );

  // Le même EA, terminal déconnecté : AccountInfoDouble ne renvoie plus rien
  // d'utile et l'envoi part quand même. Capturé en vrai le 2026-07-30.
  const metatraderDeconnecte = JSON.parse(
    '{"account":"531066904","balance":0.00,"equity":0.00,' +
      '"open_positions":0,"currency":"EUR","source":"mt5"}',
  );

  it("accepte l'état de compte des trois plateformes", () => {
    for (const [name, payload] of [
      ["cTrader", ctrader],
      ["NinjaTrader", ninja],
      ["MetaTrader", metatrader],
    ] as const) {
      expect(accountSnapshotRejectReason(payload), name).toBeNull();
      expect(readAccountSnapshot(payload), name).not.toBeNull();
    }
  });

  it("refuse l'envoi d'un terminal déconnecté, en disant quoi faire", () => {
    const reason = accountSnapshotRejectReason(metatraderDeconnecte);
    expect(reason).toContain("connecte");
    expect(readAccountSnapshot(metatraderDeconnecte)).toBeNull();
  });

  it("accepte un identifiant de compte non numérique (NinjaTrader nomme ses comptes)", () => {
    expect(readAccountSnapshot(ninja)?.account).toBe("Sim101");
  });

  it("normalise la devise, quelle que soit la plateforme", () => {
    expect(readAccountSnapshot(ctrader)?.currency).toBe("EUR");
    expect(readAccountSnapshot(ninja)?.currency).toBe("USD");
  });

  it("accepte le trade type de chaque client", () => {
    // cTrader : ticket numérique, sl/tp null
    expect(
      isValidTrade({
        account: "3012345", ticket: 88123, symbol: "EURUSD", direction: "buy",
        volume: 1.0, open_price: 1.1, close_price: 1.2,
        open_time: 1_799_000_000, close_time: 1_799_001_000,
        profit: 10, commission: -0.7, swap: 0, sl: null, tp: null, source: "ctrader",
      }),
    ).toBe(true);

    // NinjaTrader : ticket textuel (ExecutionId), volume en contrats entiers
    expect(
      isValidTrade({
        account: "Sim101", ticket: "a1b2c3d4", symbol: "ES 12-26", direction: "short",
        volume: 2, open_price: 5100.25, close_price: 5095.5,
        open_time: 1_799_000_000, close_time: 1_799_001_000,
        profit: 237.5, commission: -4.04, swap: 0, sl: null, tp: null, source: "ninjatrader",
      }),
    ).toBe(true);
  });
});
