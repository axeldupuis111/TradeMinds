import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAN_DE_SYNCHRO, synchroAutorisee } from "./plan-de-synchro";

/**
 * LES DEUX RAILS DE SYNCHRO PASSENT PAR LA MÊME PORTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE RAIL PUSH VÉRIFIAIT LE PLAN À CHAQUE ENVOI, LE RAIL PULL NE LE
 * VÉRIFIAIT JAMAIS. Le produit a deux chemins vers la même promesse (« tes
 * trades arrivent tout seuls »), vendue premium et elle seule :
 *
 *   - le PUSH (MetaTrader, cTrader, NinjaTrader, TradingView) s'authentifie par
 *     `mt_sync_token` et refuse tout payload d'un compte non premium ;
 *   - le PULL (Tradovate) gardait la CRÉATION de la connexion, puis un cron la
 *     rejouait toutes les heures sans plus jamais regarder le plan, et
 *     `/api/broker/sync-now` la rejouait à la demande de la même façon.
 *
 * ⚠️ ET RIEN NE FERME UNE CONNEXION QUAND L'ABONNEMENT S'ARRÊTE : aucune
 * désactivation dans le webhook Stripe ni au changement de plan. Un compte
 * passé de Premium à gratuit gardait donc la synchronisation automatique, à
 * vie. C'est la fonctionnalité la plus chère du produit et, pour une partie des
 * abonnés, la seule raison de payer Premium.
 *
 * ⚠️ LA PORTE GARDÉE ÉTAIT CELLE QU'ON VOIT (le bouton « connecter »), pas
 * celle qui travaille tous les jours en silence. C'est la forme habituelle des
 * défauts de ce dépôt : une règle écrite, appliquée à une porte sur deux.
 */

const RACINE = process.cwd();

describe("le droit à la synchro automatique", () => {
  it("est réservé au plan qui le vend", () => {
    expect(synchroAutorisee(PLAN_DE_SYNCHRO)).toBe(true);
    expect(synchroAutorisee("plus")).toBe(false);
    expect(synchroAutorisee("free")).toBe(false);
  });

  /** ⚠️ Un plan absent ou inconnu est un refus, pas un bénéfice du doute. */
  it("refuse ce qu'il ne reconnaît pas", () => {
    expect(synchroAutorisee(null)).toBe(false);
    expect(synchroAutorisee(undefined)).toBe(false);
    expect(synchroAutorisee("")).toBe(false);
    expect(synchroAutorisee("premium_annual")).toBe(false);
  });
});

describe("les trois surfaces qui synchronisent", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  /**
   * ⚠️⚠️ LE CŒUR DU DÉFAUT : le cron horaire. C'est lui qui rejouait la
   * synchro d'un ancien abonné, toutes les heures, indéfiniment.
   */
  it("le cron horaire lit le plan du propriétaire", () => {
    const src = nu("app/api/sync/brokers/route.ts");
    expect(src, "le cron ne lit toujours pas le plan des propriétaires").toContain("synchroAutorisee(");
    // La lecture des plans doit précéder la boucle, sinon elle ne sert à rien.
    const lecture = src.indexOf('.select("id, plan")');
    const boucle = src.indexOf("for (const conn of all)");
    expect(lecture, "la lecture des plans a disparu").toBeGreaterThan(0);
    expect(lecture, "les plans sont lus après la boucle qui devait s'en servir").toBeLessThan(boucle);
  });

  it("la synchro à la demande garde la même porte que la création", () => {
    const src = nu("app/api/broker/sync-now/route.ts");
    expect(src, "n'importe quel plan peut encore déclencher une synchro").toContain("synchroAutorisee(auth.plan)");
    // Et le refus tombe AVANT la lecture des connexions.
    expect(src.indexOf("synchroAutorisee(auth.plan)")).toBeLessThan(src.indexOf("broker_connections"));
  });

  it("le rail push lit le même prédicat que les deux autres", () => {
    const src = nu("lib/sync/push-handler.ts");
    expect(src, "le rail push a repris une règle de plan à lui").toContain("synchroAutorisee(");
    expect(src, "deux définitions du droit à la synchro").not.toContain('profile.plan !== "premium"');
  });
});

/** Connexions réellement passées au synchroniseur pendant le rejeu du cron. */
const synchronisees: string[] = [];

process.env.CRON_SECRET = "secret-de-test";

vi.mock("@/lib/sync/broker-sync", () => ({
  BROKER_CONNECTION_COLUMNS: "id, user_id, broker, status, last_synced_at",
  syncBrokerConnection: async (_admin: unknown, conn: { id: string }) => {
    synchronisees.push(conn.id);
    return { synced: 1, insertedNetPnl: 0, challengeId: null };
  },
}));
vi.mock("@/lib/alerts/daily-loss", () => ({
  checkDailyLossAlert: async () => {},
  checkDrawdownAlert: async () => {},
}));
vi.mock("@/lib/cron-alert", () => ({ alertCronFailure: async () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const donnees =
        table === "broker_connections"
          ? [
              { id: "premium", user_id: "u-premium", broker: "tradovate", status: "active", last_synced_at: null },
              { id: "ancien", user_id: "u-ancien", broker: "tradovate", status: "active", last_synced_at: null },
            ]
          : [
              { id: "u-premium", plan: "premium" },
              { id: "u-ancien", plan: "free" },
            ];
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order"]) b[m] = () => b;
      b.single = () => Promise.resolve({ data: donnees[0], error: null });
      b.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: donnees, error: null }).then(resolve);
      return b;
    },
  }),
}));

/**
 * ⚠️ LE CRON EST REJOUÉ POUR DE VRAI : un garde qui ne lit que la source ne
 * prouve pas qu'une connexion non premium est réellement SAUTÉE. Ce qu'on
 * mesure ici, c'est que `syncBrokerConnection` n'est jamais appelée pour elle.
 */
describe("le cron rejoué", () => {
  it("ne synchronise que les connexions des abonnés", async () => {
    const { POST } = await import("@/app/api/sync/brokers/route");
    const req = new Request("https://x/api/sync/brokers", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const res = await POST(req);
    const corps = (await res.json()) as { synced: number; processed: number; withoutPlan: number };
    expect(corps.withoutPlan, "la connexion de l'ancien abonné a été synchronisée").toBe(1);
    expect(corps.processed, "la connexion de l'abonné n'a pas été traitée").toBe(1);
    expect(synchronisees, "la connexion sautée est passée par le synchroniseur").toEqual(["premium"]);
  });
});
