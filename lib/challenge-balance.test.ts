import { describe, it, expect } from "vitest";
import { resolveAccountBalance, LIVE_WINDOW_MS } from "./challenge-balance";

const NOW = Date.parse("2026-07-30T12:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("resolveAccountBalance", () => {
  it("reconstitue depuis le capital initial quand rien n'est synchronisé", () => {
    const r = resolveAccountBalance({ account_size: 50_000 }, 180, NOW);
    expect(r.balance).toBe(50_180);
    expect(r.fromBroker).toBe(false);
    expect(r.live).toBe(false);
    expect(r.curveOffset).toBe(0);
    expect(r.equity).toBeNull();
  });

  it("préfère le solde du broker au capital saisi (le cas qui motive la feature)", () => {
    // L'utilisateur a saisi 50 000 € alors que son compte en vaut 47 500.
    const r = resolveAccountBalance(
      { account_size: 50_000, synced_balance: 47_500, synced_at: iso(60_000) },
      -300,
      NOW,
    );
    expect(r.balance).toBe(47_500);
    expect(r.fromBroker).toBe(true);
    expect(r.live).toBe(true);
    // La courbe reconstituée finissait à 49 700 : on la décale de -2 200.
    expect(r.curveOffset).toBe(-2_200);
  });

  it("affiche le solde du broker tel quel, sans y rajouter les trades connus", () => {
    // Le garde-fou du double comptage : ces trades sont forcément déjà dans le
    // solde annoncé par MT, quel que soit leur chemin d'entrée dans l'app.
    const r = resolveAccountBalance(
      { account_size: 10_000, synced_balance: 10_500, synced_at: iso(60_000) },
      750,
      NOW,
    );
    expect(r.balance).toBe(10_500);
  });

  it("ne dépend d'aucun horodatage broker (heure serveur MT ≠ UTC)", () => {
    // DEAL_TIME / OrderCloseTime() sont en heure serveur du broker. Un compte
    // GMT+3 datait ses trades du jour dans le futur : la version précédente les
    // voyait « après l'instantané » et les ajoutait à un solde qui les contenait
    // déjà. Le solde ne doit dépendre que de synced_balance.
    const gmtPlus3 = resolveAccountBalance(
      { account_size: 10_000, synced_balance: 10_320, synced_at: iso(30_000) },
      320,
      NOW,
    );
    expect(gmtPlus3.balance).toBe(10_320);
  });

  it("expose l'equity seulement quand une position est ouverte et le lien vivant", () => {
    const base = {
      account_size: 10_000,
      synced_balance: 10_000,
      synced_equity: 10_180,
      synced_at: iso(60_000),
    };
    expect(resolveAccountBalance({ ...base, synced_open_positions: 2 }, 0, NOW).equity).toBe(10_180);
    // Aucune position ouverte : l'equity vaut le solde, l'afficher n'apprend rien.
    expect(resolveAccountBalance({ ...base, synced_open_positions: 0 }, 0, NOW).equity).toBeNull();
  });

  it("garde le dernier solde connu mais coupe le direct au-delà de la fenêtre", () => {
    const r = resolveAccountBalance(
      {
        account_size: 10_000,
        synced_balance: 10_400,
        synced_equity: 10_600,
        synced_open_positions: 1,
        synced_at: iso(LIVE_WINDOW_MS + 60_000),
      },
      0,
      NOW,
    );
    expect(r.balance).toBe(10_400);
    expect(r.fromBroker).toBe(true);
    expect(r.live).toBe(false);
    expect(r.equity).toBeNull(); // une equity figée depuis 16 min est un piège
  });

  it("ignore un synced_at illisible plutôt que de produire NaN", () => {
    const r = resolveAccountBalance(
      { account_size: 10_000, synced_balance: 12_000, synced_at: "pas une date" },
      100,
      NOW,
    );
    expect(r.balance).toBe(10_100);
    expect(r.fromBroker).toBe(false);
  });

  it("laisse le drawdown intact : le décalage est uniforme sur toute la courbe", () => {
    // Deux trades : +1 000 puis -400, soit 600 € de P&L cumulé.
    const r = resolveAccountBalance(
      { account_size: 100_000, synced_balance: 100_900, synced_at: iso(60_000) },
      600,
      NOW,
    );
    // Courbe reconstituée : 101 000 puis 100 600. Décalée de +300.
    const curve = [101_000, 100_600].map((p) => p + r.curveOffset);
    expect(r.curveOffset).toBe(300);
    expect(curve).toEqual([101_300, 100_900]);
    // Pic - solde courant = 400 € avant comme après décalage.
    expect(Math.max(...curve) - r.balance).toBe(400);
  });
});
