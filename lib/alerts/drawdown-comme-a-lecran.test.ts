import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'ALERTE DE DRAWDOWN MESURE CE QUE L'ÉCRAN MESURE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ ELLE COMPTAIT SUR NOTRE JOURNAL, L'ÉCRAN COMPTE SUR LE SOLDE. La page
 * Comptes, le veilleur de challenge et (depuis aujourd'hui) le coach mesurent
 * la règle sur le SOLDE, parce que c'est ce que mesure la prop firm. Cette
 * notification-ci cumulait les trades enregistrés chez nous.
 *
 * Les deux coïncident tant qu'aucun courtier ne pousse son solde. Dès qu'il en
 * pousse un, l'écart vaut tout ce que le journal ignore : dépôts, retraits,
 * trades passés hors synchro. Mesuré le 2026-09-17 sur un compte réel : 570 $.
 *
 * ⚠️ ET SEULE LA MOITIÉ STATIQUE ÉTAIT FAUSSE. Le décalage s'annule entre le
 * pic et le solde, donc le drawdown GLISSANT tombait déjà juste ; c'est le
 * drawdown mesuré depuis le capital qui partait à côté. Une règle appliquée à
 * une partie seulement de ce qu'elle vise, encore.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une notification qui dit « tu as percé ton drawdown » dit la même chose que
 * la page vers laquelle elle renvoie.
 */

const pushEnvoyes: unknown[] = [];

vi.mock("@/lib/push", () => ({
  sendPushToUser: (...args: unknown[]) => {
    pushEnvoyes.push(args);
    return Promise.resolve();
  },
}));

vi.mock("@/lib/cron-alert", () => ({
  alertGardeFouMuet: () => Promise.resolve(),
}));

import { checkDrawdownAlert } from "./daily-loss";

/**
 * ⚠️⚠️ CE CLIENT SIMULÉ NE REND QUE LES COLONNES DEMANDÉES. Un mock qui ignore
 * le `select()` CERTIFIE une requête cassée : sans ça, retirer `synced_balance`
 * de la lecture laissait ce test tout vert, alors que la fonction n'aurait plus
 * jamais vu le solde du courtier. C'est un piège déjà payé ailleurs dans ce
 * dépôt.
 */
function clientQuiRend(reponses: Record<string, { data: unknown; error: unknown }>) {
  function requete(table: string) {
    const reponse = reponses[table] ?? { data: [], error: null };
    let colonnes: string[] | null = null;
    const chainable: Record<string, unknown> = {};
    for (const m of ["eq", "gte", "lte", "in", "order", "range", "not", "ilike"]) {
      chainable[m] = () => chainable;
    }
    chainable.select = (cols?: string) => {
      if (typeof cols === "string" && cols !== "*") {
        colonnes = cols.split(",").map((c) => c.trim());
      }
      return chainable;
    };
    const taillee = () => {
      if (!colonnes || reponse.data == null || typeof reponse.data !== "object") return reponse;
      const garder = (o: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(o).filter(([k]) => colonnes!.includes(k)));
      const data = Array.isArray(reponse.data)
        ? (reponse.data as Record<string, unknown>[]).map(garder)
        : garder(reponse.data as Record<string, unknown>);
      return { data, error: reponse.error };
    };
    chainable.maybeSingle = () => Promise.resolve(taillee());
    chainable.single = () => Promise.resolve(taillee());
    chainable.then = (resolve: (v: unknown) => unknown) => Promise.resolve(taillee()).then(resolve);
    return chainable;
  }
  return { from: (table: string) => requete(table) } as never;
}

const PROFIL = { data: { push_notif_alerts: true }, error: null };

/** Capital 10 000, drawdown total 10 % : la limite est à 1 000. */
function compte(extra: Record<string, unknown> = {}) {
  return {
    data: {
      account_size: 10_000,
      max_total_dd_pct: 10,
      trailing_drawdown: false,
      synced_balance: null,
      synced_equity: null,
      synced_at: null,
      ...extra,
    },
    error: null,
  };
}

beforeEach(() => {
  pushEnvoyes.length = 0;
});

describe("l'alerte de drawdown", () => {
  it("prévient quand la limite est franchie, compte non synchronisé", async () => {
    // Le journal cumule -1 100 : la limite de 1 000 est dépassée.
    await checkDrawdownAlert(
      clientQuiRend({
        profiles: PROFIL,
        prop_challenges: compte(),
        trades: { data: [{ pnl: -1_100, commission: 0, swap: 0, close_time: "2026-09-01T10:00:00Z" }], error: null },
      }),
      "u1",
      "fr",
      "c1",
      -1_100,
    );
    expect(pushEnvoyes.length, "aucun push : le test ne prouve plus rien").toBe(1);
  });

  /**
   * ⚠️⚠️ LE CAS QUI DIVERGEAIT. Le courtier annonce 9 400 sur un compte de
   * 10 000 : 600 de drawdown, sous la limite de 1 000. Notre journal, lui, ne
   * connaît que -1 100 de trades et criait « percé ». La page, elle, affichait
   * un compte à 600 de sa limite.
   */
  it("ne crie pas quand le solde du courtier dit le contraire du journal", async () => {
    await checkDrawdownAlert(
      clientQuiRend({
        profiles: PROFIL,
        prop_challenges: compte({
          synced_balance: 9_400,
          synced_equity: 9_400,
          synced_at: "2026-09-17T08:00:00Z",
        }),
        trades: { data: [{ pnl: -1_100, commission: 0, swap: 0, close_time: "2026-09-01T10:00:00Z" }], error: null },
      }),
      "u1",
      "fr",
      "c1",
      -1_100,
    );
    expect(pushEnvoyes, "l'alerte parle encore au nom du journal").toEqual([]);
  });

  /**
   * ⚠️ ET L'INVERSE COMPTE AUTANT : un journal rassurant pendant que le
   * courtier annonce un compte percé. C'est le sens dangereux.
   */
  it("crie quand le solde du courtier est percé et que le journal ne l'est pas", async () => {
    await checkDrawdownAlert(
      clientQuiRend({
        profiles: PROFIL,
        prop_challenges: compte({
          synced_balance: 8_900,
          synced_equity: 8_900,
          synced_at: "2026-09-17T08:00:00Z",
        }),
        trades: { data: [{ pnl: -300, commission: 0, swap: 0, close_time: "2026-09-01T10:00:00Z" }], error: null },
      }),
      "u1",
      "fr",
      "c1",
      -300,
    );
    expect(pushEnvoyes.length, "le trader n'apprend pas que son compte est percé").toBe(1);
  });

  /**
   * Le drawdown glissant se mesure depuis le plus haut : le décalage s'annule
   * entre le pic et le solde, ce cas tombait donc déjà juste et doit le rester.
   */
  it("mesure toujours le drawdown glissant depuis le plus haut", async () => {
    await checkDrawdownAlert(
      clientQuiRend({
        profiles: PROFIL,
        prop_challenges: compte({ trailing_drawdown: true }),
        trades: {
          data: [
            { pnl: 2_000, commission: 0, swap: 0, close_time: "2026-09-01T10:00:00Z" },
            { pnl: -1_100, commission: 0, swap: 0, close_time: "2026-09-02T10:00:00Z" },
          ],
          error: null,
        },
      }),
      "u1",
      "fr",
      "c1",
      -1_100,
    );
    // Pic à 12 000, solde à 10 900 : 1 100 de recul, limite 1 000, percée.
    expect(pushEnvoyes.length).toBe(1);
  });

  it("se tait quand le lot est gagnant", async () => {
    await checkDrawdownAlert(clientQuiRend({}), "u1", "fr", "c1", 500);
    expect(pushEnvoyes).toEqual([]);
  });
});
