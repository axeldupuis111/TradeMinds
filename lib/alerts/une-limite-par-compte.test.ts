import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkDailyLossAlert } from "./daily-loss";

/**
 * UNE LIMITE DE PERTE APPARTIENT À UN COMPTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'ALERTE PRENAIT LA LIMITE LA PLUS STRICTE DE TOUS LES COMPTES ACTIFS,
 * puis la comparait à la SOMME de tous les trades du jour, tous comptes
 * confondus. Deux défauts dans la même ligne :
 *
 *   - elle ADDITIONNAIT DES DEVISES. Un trader avec un compte prop en euros et
 *     un compte en dollars (le cas d'au moins un compte réel du produit) voyait
 *     ses pertes en dollars comptées contre une limite en euros. Le reste du
 *     produit refuse ce mélange depuis longtemps ; cette alerte, la plus
 *     importante de toutes puisqu'elle dit « arrête-toi », le faisait encore.
 *   - elle appliquait la limite d'UN compte aux trades d'un AUTRE : perdre sur
 *     son compte perso déclenchait l'alerte du challenge prop.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Chaque compte est comparé à SA limite, sur SES trades. Les trades sans compte
 * reviennent au compte actif s'il est seul, comme le fait déjà le rail de
 * synchro. Et il ne part qu'UN push, même avec trois comptes.
 */

const pushEnvoyes: { title: string }[] = [];
vi.mock("@/lib/push", () => ({
  sendPushToUser: async (_u: string, p: { title: string }) => {
    pushEnvoyes.push(p);
    return 1;
  },
}));
vi.mock("@/lib/cron-alert", () => ({ alertGardeFouMuet: async () => {} }));

type Reponse = { data: unknown; error: unknown };

function client(reponses: Record<string, Reponse>): SupabaseClient {
  const construire = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "in", "order", "range", "not"]) b[m] = () => b;
    const r = reponses[table] ?? { data: [], error: null };
    b.maybeSingle = () => Promise.resolve(r);
    b.single = () => Promise.resolve(r);
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(r).then(resolve);
    return b;
  };
  return { from: (t: string) => construire(t) } as never;
}

const PROFIL = { data: { push_notif_alerts: true, timezone: "UTC" }, error: null };

/** Deux comptes actifs : un prop à 10 000 (5 % = 500), un perso à 1 000 (10 % = 100). */
const DEUX_COMPTES = {
  data: [
    { id: "prop", account_size: 10000, max_daily_loss_pct: 5, max_daily_dd_pct: null },
    { id: "perso", account_size: 1000, max_daily_loss_pct: 10, max_daily_dd_pct: null },
  ],
  error: null,
};

beforeEach(() => {
  pushEnvoyes.length = 0;
});

describe("l'alerte de perte journalière", () => {
  /**
   * ⚠️⚠️ LE CŒUR DU DÉFAUT : 300 perdus sur le compte prop, qui autorise 500.
   * L'ancienne version comparait ces 300 à la limite la plus stricte des deux
   * (100, celle du compte perso) et criait au dépassement.
   */
  it("ne reproche pas à un compte la limite d'un autre", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: DEUX_COMPTES,
        trades: { data: [{ pnl: -300, commission: 0, swap: 0, challenge_id: "prop" }], error: null },
      }),
      "u1",
      "fr",
      { prop: -300 },
    );
    expect(pushEnvoyes.length, "l'alerte d'un autre compte s'est déclenchée").toBe(0);
  });

  it("prévient quand le compte concerné dépasse VRAIMENT sa limite", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: DEUX_COMPTES,
        trades: { data: [{ pnl: -600, commission: 0, swap: 0, challenge_id: "prop" }], error: null },
      }),
      "u1",
      "fr",
      { prop: -600 },
    );
    expect(pushEnvoyes.length).toBe(1);
  });

  /** ⚠️ Et le petit compte garde SA limite, qui est plus basse. */
  it("prévient aussi sur le petit compte, à son propre seuil", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: DEUX_COMPTES,
        trades: { data: [{ pnl: -120, commission: 0, swap: 0, challenge_id: "perso" }], error: null },
      }),
      "u1",
      "fr",
      { perso: -120 },
    );
    expect(pushEnvoyes.length).toBe(1);
  });

  /**
   * ⚠️ TROIS COMPTES QUI FRANCHISSENT EN MÊME TEMPS N'ENVOIENT QU'UN PUSH :
   * trois notifications identiques à la seconde près se lisent comme un bogue.
   */
  it("n'envoie qu'une notification", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: DEUX_COMPTES,
        trades: {
          data: [
            { pnl: -600, commission: 0, swap: 0, challenge_id: "prop" },
            { pnl: -120, commission: 0, swap: 0, challenge_id: "perso" },
          ],
          error: null,
        },
      }),
      "u1",
      "fr",
      { prop: -600, perso: -120 },
    );
    expect(pushEnvoyes.length).toBe(1);
  });

  /**
   * ⚠️ LES TRADES SANS COMPTE REVIENNENT AU SEUL COMPTE ACTIF. Sans cette
   * reprise, un trader dont les trades ne sont pas rattachés (42 % des trades
   * du produit) n'aurait plus d'alerte du tout.
   */
  it("compte les trades orphelins sur le compte actif quand il est seul", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: {
          data: [{ id: "seul", account_size: 10000, max_daily_loss_pct: 5, max_daily_dd_pct: null }],
          error: null,
        },
        trades: { data: [{ pnl: -600, commission: 0, swap: 0, challenge_id: null }], error: null },
      }),
      "u1",
      "fr",
      { "": -600 },
    );
    expect(pushEnvoyes.length, "les trades sans compte ne comptent plus nulle part").toBe(1);
  });

  /** ⚠️ Mais avec DEUX comptes, un trade orphelin n'appartient à personne. */
  it("n'attribue pas un trade orphelin quand deux comptes sont actifs", async () => {
    await checkDailyLossAlert(
      client({
        profiles: PROFIL,
        prop_challenges: DEUX_COMPTES,
        trades: { data: [{ pnl: -600, commission: 0, swap: 0, challenge_id: null }], error: null },
      }),
      "u1",
      "fr",
      { "": -600 },
    );
    expect(pushEnvoyes.length, "un trade sans compte a été prêté à un compte au hasard").toBe(0);
  });

  it("ne dit rien quand le lot est gagnant", async () => {
    await checkDailyLossAlert(
      client({ profiles: PROFIL, prop_challenges: DEUX_COMPTES, trades: { data: [], error: null } }),
      "u1",
      "fr",
      { prop: 200 },
    );
    expect(pushEnvoyes.length).toBe(0);
  });
});
