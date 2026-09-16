import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";
import { computeChallengeRules } from "./challenge-rules";

/**
 * LE COACH ET L'ÉCRAN RÉPONDENT LE MÊME CHIFFRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA SEULE QUESTION QUI ARRÊTE UN TRADER, IL Y AVAIT DEUX RÉPONSES.
 * « Combien me reste-t-il de drawdown ? » se mesure sur le SOLDE, parce que
 * c'est ce que mesure la prop firm. La page (`computeChallengeRules`) et le
 * veilleur qui déclenche l'alerte d'arrêt (`ChallengeGuardian`) le faisaient
 * déjà, et le veilleur porte même le commentaire qui dit pourquoi. L'outil
 * `get_challenge_status` du coach, lui, mesurait la règle sur la somme des
 * trades ENREGISTRÉS chez nous.
 *
 * Les deux coïncident tant qu'aucun courtier ne pousse son solde. Dès qu'il en
 * pousse un, l'écart vaut tout ce que notre journal ignore : dépôts, retraits,
 * trades passés hors synchro. Mesuré le 2026-09-17 sur un compte réel :
 * 570 $ d'écart, soit +120,64 $ pour l'écran et -449,36 $ pour le coach, sur le
 * même compte, le même jour.
 *
 * ⚠️ ET LE DRAWDOWN GLISSANT ÉTAIT ABSENT de l'outil : `trailing_drawdown`
 * n'était même pas lu. Sur un compte à drawdown glissant, la marge se mesure
 * depuis le PLUS HAUT atteint ; l'annoncer pleine pousse le trader dans le sens
 * qui grille le compte.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une règle de prop firm se calcule à UN endroit, `lib/challenge-rules.ts`, et
 * tout ce qui la cite passe par lui.
 */

const USER = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";

function mockClient(seq: { data?: unknown; error?: unknown }[]) {
  let i = 0;
  const builder: Record<string, unknown> = {};
  const chain = () => () => builder;
  for (const m of ["select", "eq", "in", "is", "ilike", "gte", "lt", "order", "limit", "range", "maybeSingle", "single"]) {
    builder[m] = chain();
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(seq[Math.min(i++, seq.length - 1)]);
  return { from: vi.fn(() => builder) } as unknown as SupabaseClient;
}

const BASE = {
  id: ACC,
  type: "prop",
  firm: "Tradovate",
  account_size: 50_000,
  currency: "USD",
  synced_currency: "USD",
  profit_target_pct: 8,
  max_daily_dd_pct: 5,
  max_total_dd_pct: 10,
  trailing_drawdown: false,
  start_date: "2026-08-18",
  status: "active",
  synced_balance: null as number | null,
  synced_equity: null as number | null,
  synced_open_positions: 0,
  synced_at: null as string | null,
};

async function statut(compte: Record<string, unknown>, trades: unknown[]) {
  const client = mockClient([{ data: [compte], error: null }, { data: trades, error: null }]);
  const r = await executeCoachTool(client, USER, "get_challenge_status", {}, "Europe/Paris");
  return r.result as Record<string, number | boolean | string | null>;
}

describe("l'état du challenge vu par le coach", () => {
  /**
   * Le compte réel qui a révélé l'écart : le courtier annonce 50 120,64 $ et
   * notre journal ne connaît que -449,36 $ de trades. 570 $ d'écart.
   */
  const TRADES_REELS = [
    { pnl: -449.36, commission: 0, swap: 0, open_time: "2026-08-20T09:00:00Z" },
  ];
  const SYNCHRONISE = {
    ...BASE,
    synced_balance: 50_120.64,
    synced_equity: 50_120.64,
    synced_at: "2026-09-17T08:00:00Z",
  };

  it("mesure la règle sur le solde du courtier, pas sur notre journal", async () => {
    const res = await statut(SYNCHRONISE, TRADES_REELS);
    expect(res.balance).toBeCloseTo(50_120.64, 2);
    // ⚠️ LE CHIFFRE QUI DIFFÈRE : +120,64 et non -449,36.
    expect(res.performance).toBeCloseTo(120.64, 2);
    // Le journal reste lisible, mais sous son propre nom.
    expect(res.performance_journal).toBeCloseTo(-449.36, 2);
  });

  it("donne exactement ce que la page calcule", async () => {
    const res = await statut(SYNCHRONISE, TRADES_REELS);
    // La même fonction, appelée ici à la main : si l'outil s'en écarte d'un
    // centime, c'est que quelqu'un a réécrit la règle au lieu de l'appeler.
    const attendu = computeChallengeRules(
      {
        account_size: 50_000,
        profit_target_pct: 8,
        max_daily_dd_pct: 5,
        max_total_dd_pct: 10,
        trailing_drawdown: false,
      },
      50_120.64,
      0,
      [50_120.64],
    );
    expect(res.total_dd_remaining).toBeCloseTo(attendu.totalDdRemainingEur, 2);
    expect(res.profit_target).toBeCloseTo(attendu.profitMax, 2);
    expect(res.performance).toBeCloseTo(attendu.currentPnl, 2);
  });

  /**
   * ⚠️ CE QUE L'ANCIEN CODE RÉPONDAIT, pour que l'écart soit une valeur et non
   * une opinion : il retranchait le journal au lieu du solde.
   */
  it("ne répond plus les chiffres de l'ancienne formule", async () => {
    const res = await statut(SYNCHRONISE, TRADES_REELS);
    const ancienTotalDd = 5_000 + Math.min(0, -449.36); // 4 550,64
    const ancienProfitRestant = 4_000 - -449.36; // 4 449,36
    expect(res.total_dd_remaining).not.toBeCloseTo(ancienTotalDd, 2);
    expect(res.profit_remaining).not.toBeCloseTo(ancienProfitRestant, 2);
    expect(res.total_dd_remaining).toBeCloseTo(5_000, 2);
    expect(res.profit_remaining).toBeCloseTo(3_879.36, 2);
  });

  /**
   * ⚠️⚠️ LE DRAWDOWN GLISSANT SE MESURE DEPUIS LE PLUS HAUT. Un compte monté à
   * +2 000 puis redescendu à +1 000 a consommé 1 000 de marge, pas zéro.
   */
  it("tient compte du drawdown glissant", async () => {
    const trades = [
      { pnl: 2_000, commission: 0, swap: 0, open_time: "2026-08-19T09:00:00Z" },
      { pnl: -1_000, commission: 0, swap: 0, open_time: "2026-08-20T09:00:00Z" },
    ];
    const glissant = { ...BASE, max_total_dd_pct: 4, trailing_drawdown: true };
    const res = await statut(glissant, trades);
    expect(res.trailing_drawdown).toBe(true);
    // Plafond 2 000, plus haut atteint 52 000, solde 51 000 : il reste 1 000.
    expect(res.total_dd_remaining).toBeCloseTo(1_000, 2);
    // L'ancienne formule ignorait le plus haut et annonçait la marge pleine.
    expect(res.total_dd_remaining).not.toBeCloseTo(2_000, 2);
  });

  it("le compte sans courtier ne bouge pas d'un centime", async () => {
    // Rien ne change pour les vingt et un comptes qui ne synchronisent pas :
    // sans solde poussé, le solde EST la taille plus les trades.
    const trades = [{ pnl: -2_000, commission: -20, swap: 0, open_time: "2026-08-02T09:00:00Z" }];
    const res = await statut({ ...BASE, account_size: 100_000 }, trades);
    expect(res.performance).toBeCloseTo(-2_020, 2);
    expect(res.profit_remaining).toBeCloseTo(10_020, 2);
    expect(res.total_dd_remaining).toBeCloseTo(7_980, 2);
  });

  /**
   * ⚠️ UN COMPTE PERCÉ N'A PAS « -300 » DE MARGE, IL EN A ZÉRO. Un nombre
   * négatif se lit comme une marge dans une phrase générée.
   */
  it("une marge dépassée vaut zéro, jamais un négatif", async () => {
    const trades = [{ pnl: -6_000, commission: 0, swap: 0, open_time: "2026-08-02T09:00:00Z" }];
    const res = await statut(BASE, trades);
    expect(res.total_dd_remaining).toBe(0);
  });
});

/**
 * ⚠️⚠️ `prop_challenges.balance` EST UN CACHE, PAS UN SOLDE. Il n'est réécrit
 * que par l'instantané du courtier et par la page Comptes QUAND ON L'OUVRE :
 * un compte alimenté par import ou saisie reste figé sur la dernière visite.
 * Mesuré le 2026-09-17 en production : trois comptes actifs portaient un cache
 * faux, dont un compte réel à 668 $ près. `DashboardContent` porte déjà le
 * commentaire qui énonce la règle ; le coach, lui, citait le cache.
 */
describe("la liste des comptes vue par le coach", () => {
  async function lister(comptes: Record<string, unknown>[], trades: unknown[]) {
    const client = mockClient([{ data: comptes, error: null }, { data: trades, error: null }]);
    const r = await executeCoachTool(client, USER, "list_accounts", {});
    return (r.result as { accounts: Record<string, unknown>[] }).accounts;
  }

  it("recalcule le solde au lieu de citer la colonne figée", async () => {
    const perime = { ...BASE, balance: 50_000, synced_balance: null, synced_at: null };
    const [a] = await lister([perime], [
      { id: "1", challenge_id: ACC, pnl: 668, commission: 0, swap: 0 },
    ]);
    expect(a.balance, "le coach cite encore le cache").toBe(50_668);
    expect(a.balance_source).toBe("trades");
  });

  it("laisse le courtier faire autorité quand il a poussé un solde", async () => {
    const synchro = {
      ...BASE,
      balance: 50_000,
      synced_balance: 50_120.64,
      synced_equity: 50_120.64,
      synced_at: "2026-09-17T08:00:00Z",
    };
    const [a] = await lister([synchro], [
      { id: "1", challenge_id: ACC, pnl: -449.36, commission: 0, swap: 0 },
    ]);
    expect(a.balance).toBeCloseTo(50_120.64, 2);
    expect(a.balance_source).toBe("courtier");
  });

  /**
   * ⚠️ ET LE SOLDE NE DISPARAÎT PAS DE LA LISTE. Mesuré au banc d'essai le
   * 2026-08-14 : sans solde ici, le modèle abandonne au milieu d'un calcul de
   * taille de position, parce qu'il vient le chercher dans cet outil.
   */
  it("un solde reste présent sur chaque compte", async () => {
    const [a] = await lister([{ ...BASE, balance: 50_000 }], []);
    expect(Object.keys(a)).toContain("balance");
    expect(typeof a.balance).toBe("number");
  });
});
