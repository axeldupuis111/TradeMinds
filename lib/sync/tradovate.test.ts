import { describe, it, expect } from "vitest";
import { buildTradovateSnapshot } from "./tradovate";

/**
 * Tradovate est un rail *pull* : aucun fichier client à installer, mais aussi
 * aucun moyen de le tester sans compte réel. Ces tests couvrent le seul endroit
 * où la forme supposée de l'API est interprétée, et surtout sa dégradation :
 * face à une réponse inattendue, la règle est de ne RIEN écrire.
 */
describe("buildTradovateSnapshot", () => {
  const account = { id: 12345, name: "DEMO4815162" };
  const cash = { totalCashValue: 50_000, openPnL: -125.5 };

  it("compose le solde et l'equity d'un compte à terme", () => {
    const snap = buildTradovateSnapshot(account, cash, [], null);
    expect(snap).toEqual({
      account: "DEMO4815162",
      balance: 50_000,
      // Sur un compte à terme, l'equity est la valeur en espèces plus le latent.
      equity: 49_874.5,
      open_positions: 0,
      currency: null,
    });
  });

  it("compte les positions réellement ouvertes du compte", () => {
    const positions = [
      { accountId: 12345, netPos: 2 },
      { accountId: 12345, netPos: 0 }, // soldée
      { accountId: 99999, netPos: 3 }, // un autre compte
      { accountId: 12345, netPos: -1 }, // short : ouverte aussi
    ];
    expect(buildTradovateSnapshot(account, cash, positions, null)?.open_positions).toBe(2);
  });

  it("retombe sur l'identifiant numérique quand le compte n'est pas nommé", () => {
    expect(buildTradovateSnapshot({ id: 12345 }, cash, [], null)?.account).toBe("12345");
    expect(buildTradovateSnapshot({ id: 12345, name: "  " }, cash, [], null)?.account).toBe("12345");
  });

  it("traite un latent absent comme nul plutôt que d'abandonner le solde", () => {
    const snap = buildTradovateSnapshot(account, { totalCashValue: 50_000 }, [], null);
    expect(snap?.balance).toBe(50_000);
    expect(snap?.equity).toBe(50_000);
  });

  it("accepte un compte à zéro, comme les autres rails", () => {
    expect(buildTradovateSnapshot(account, { totalCashValue: 0, openPnL: 0 }, [], null)?.balance).toBe(0);
  });

  it("n'écrit RIEN si le solde manque ou n'est pas un nombre", () => {
    expect(buildTradovateSnapshot(account, {}, [], null)).toBeNull();
    expect(buildTradovateSnapshot(account, { totalCashValue: NaN }, [], null)).toBeNull();
    expect(
      buildTradovateSnapshot(account, { totalCashValue: "50000" } as never, [], null),
    ).toBeNull();
    expect(buildTradovateSnapshot(account, null, [], null)).toBeNull();
  });

  it("n'écrit RIEN sans compte exploitable", () => {
    expect(buildTradovateSnapshot(null, cash, [], null)).toBeNull();
    expect(buildTradovateSnapshot({} as never, cash, [], null)).toBeNull();
  });

  it("survit à une liste de positions absente ou malformée", () => {
    expect(buildTradovateSnapshot(account, cash, null, null)?.open_positions).toBe(0);
    expect(buildTradovateSnapshot(account, cash, undefined, null)?.open_positions).toBe(0);
    expect(
      buildTradovateSnapshot(account, cash, [{ accountId: 12345 }], null)?.open_positions,
    ).toBe(0);
  });
});
