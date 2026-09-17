import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachConfirm, executeCoachTool } from "./coach-tools";

const USER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

type Reponse = { data?: unknown; error?: unknown; count?: number };

/**
 * Client simulé rendant une réponse différente à chaque requête enchaînée.
 *
 * ⚠️⚠️ UN CLIENT SIMULÉ NE VÉRIFIE NI LA TABLE NI LES COLONNES : il rend ce
 * qu'on lui a préparé, quoi qu'on lui demande. C'est ainsi que les deux tests
 * de `get_leaderboard_standing` ci-dessous ont certifié pendant des semaines
 * une lecture qui échouait en production à CHAQUE appel — elle demandait
 * `profiles.current_streak`, une colonne qui n'existe pas, et PostgREST refuse
 * alors la requête entière. Le test, lui, voyait un profil complet.
 *
 * D'où la forme par TABLE ci-dessous : la réponse est choisie d'après la table
 * réellement interrogée. Un outil qui change de table le fait voir, au lieu de
 * consommer en silence la réponse préparée pour la précédente.
 */
function mockClient(reponses: Reponse[] | Record<string, Reponse | Reponse[]>) {
  let i = 0;
  const restes: Record<string, Reponse[]> = {};
  const calls: { method: string; args: unknown[] }[] = [];

  /**
   * ⚠️ UN CONSTRUCTEUR PAR APPEL, et ce n'est pas un détail de style : plusieurs
   * lectures partent ensemble dans un `Promise.all`. Avec un constructeur
   * partagé, la dernière table demandée décidait de la réponse des trois, et le
   * test se mettait à mesurer l'ordre d'exécution au lieu de l'outil.
   */
  const construire = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = (m: string) => (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
    for (const m of ["select", "eq", "neq", "in", "is", "ilike", "gte", "lte", "lt", "gt", "or", "range", "order", "limit", "insert", "update", "delete", "upsert", "maybeSingle", "single"]) {
      builder[m] = chain(m);
    }
    builder.then = (resolve: (v: unknown) => unknown) => {
      if (Array.isArray(reponses)) return resolve(reponses[Math.min(i++, reponses.length - 1)]);
      const prete = reponses[table];
      if (prete === undefined) {
        throw new Error(`Table « ${table} » interrogée sans réponse préparée.`);
      }
      if (!Array.isArray(prete)) return resolve(prete);
      const file = (restes[table] ??= [...prete]);
      return resolve(file.length > 1 ? file.shift() : file[0]);
    };
    return builder;
  };

  const from = vi.fn((t: string) => { calls.push({ method: "from", args: [t] }); return construire(t); });
  return { client: { from } as unknown as SupabaseClient, calls };
}
const called = (calls: { method: string }[], m: string) => calls.some((c) => c.method === m);
const tables = (calls: { method: string; args: unknown[] }[]) =>
  calls.filter((c) => c.method === "from").map((c) => c.args[0]);

describe("log_emotional_check", () => {
  it("exige une session ouverte et oriente vers start_session sinon", async () => {
    const { client, calls } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "log_emotional_check", { emotion: "frustrated" }, undefined, "plus");
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toContain("start_session");
    expect(called(calls, "insert")).toBe(false);
  });

  it("signale une émotion à risque pour que le coach conseille une pause", async () => {
    const { client } = mockClient([{ data: { id: "s1" }, error: null }, { data: { id: ID }, error: null }]);
    const r = await executeCoachTool(client, USER, "log_emotional_check", { emotion: "revenge" }, undefined, "plus");
    const res = r.result as { risky: boolean; instruction: string };
    expect(res.risky).toBe(true);
    expect(res.instruction).toContain("pause");
  });

  it("ne dramatise pas une émotion neutre", async () => {
    const { client } = mockClient([{ data: { id: "s1" }, error: null }, { data: { id: ID }, error: null }]);
    const r = await executeCoachTool(client, USER, "log_emotional_check", { emotion: "confident" }, undefined, "plus");
    expect((r.result as { risky: boolean }).risky).toBe(false);
  });

  it("rejette une émotion hors liste", async () => {
    const { client } = mockClient([{ data: { id: "s1" }, error: null }]);
    expect((await executeCoachTool(client, USER, "log_emotional_check", { emotion: "bof" }, undefined, "plus")).isError).toBe(true);
  });
});

describe("get_leaderboard_standing", () => {
  it("dit clairement qu'un trader sans pseudo n'apparaît pas au classement", async () => {
    const { client } = mockClient({
      profiles: { data: { username: null, plan: "plus" }, error: null },
      badge_awards: { data: [], error: null },
      trades: { data: [], error: null },
      streak_freezes: { data: [], error: null },
      challenge_awards: { data: [], error: null },
    });
    const r = await executeCoachTool(client, USER, "get_leaderboard_standing", {});
    const res = r.result as { listed: boolean; note: string };
    expect(res.listed).toBe(false);
    expect(res.note).toContain("pseudo");
  });

  it("remonte les badges obtenus", async () => {
    const { client } = mockClient({
      profiles: { data: { username: "axel", plan: "plus" }, error: null },
      badge_awards: { data: [{ badge_key: "streak_7", awarded_at: "2026-08-01" }, { badge_key: "regular", awarded_at: "2026-07-01" }], error: null },
      trades: { data: [], error: null },
      streak_freezes: { data: [], error: null },
      challenge_awards: { data: [], error: null },
    });
    const r = await executeCoachTool(client, USER, "get_leaderboard_standing", {});
    const res = r.result as { listed: boolean; badges_earned: string[]; badges_count: number };
    expect(res.listed).toBe(true);
    expect(res.badges_earned).toContain("streak_7");
    expect(res.badges_count).toBe(2);
  });

  /**
   * ⚠️ LA SÉRIE VIENT DES TRADES, PAS DU PROFIL. Le test ne se contente pas de
   * lire le chiffre rendu : il vérifie QUELLES TABLES l'outil interroge. Sans
   * cela, un retour à `profiles.current_streak` repasserait au vert ici tout en
   * ne renvoyant que des zéros à tous les traders, comme avant.
   */
  it("calcule la série depuis les trades, jamais depuis une colonne de profil", async () => {
    const jour = (d: string) => `${d}T10:00:00.000Z`;
    const { client, calls } = mockClient({
      profiles: { data: { username: "axel", plan: "plus" }, error: null },
      badge_awards: { data: [], error: null },
      trades: {
        data: [
          { emotion: null, open_time: jour("2026-09-09") },
          { emotion: null, open_time: jour("2026-09-10") },
          { emotion: "revenge", open_time: jour("2026-09-11") },
        ],
        error: null,
      },
      streak_freezes: { data: [], error: null },
      challenge_awards: { data: [], error: null },
    });
    const r = await executeCoachTool(client, USER, "get_leaderboard_standing", {});
    const res = r.result as { current_streak: number; best_streak: number };
    expect(tables(calls)).toContain("trades");
    expect(res.best_streak).toBeGreaterThan(0);
    expect(res.current_streak).toBe(0); // la journée fautive coupe la série
  });
});

describe("list_communities", () => {
  it("le dit quand le trader n'appartient à aucune communauté", async () => {
    const { client } = mockClient([{ data: [], error: null }]);
    const r = await executeCoachTool(client, USER, "list_communities", {});
    expect((r.result as { count: number }).count).toBe(0);
    expect((r.result as { note: string }).note).toContain("aucune communauté");
  });
});

describe("delete_strategy", () => {
  it("NE SUPPRIME PAS et annonce combien de trades perdront leur rattachement", async () => {
    const { client, calls } = mockClient([
      { data: { id: ID, name: "ICT Liquidité" }, error: null },
      { data: null, error: null, count: 42 },
    ]);
    const r = await executeCoachTool(client, USER, "delete_strategy", { strategy_id: ID });
    expect(called(calls, "delete")).toBe(false);
    expect(r.confirm).toMatchObject({ op: "delete_strategy", strategy_id: ID });
    const res = r.result as { requires_confirmation: boolean; linked_trades: number };
    expect(res.requires_confirmation).toBe(true);
    expect(res.linked_trades).toBe(42);
  });

  it("oriente vers list_strategies quand l'id est inconnu", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "delete_strategy", { strategy_id: ID });
    expect(r.isError).toBe(true);
    const msg = (r.result as { error: string }).error;
    expect(msg).toContain("AUCUN bouton");
    expect(msg).toContain("list_strategies");
  });

  it("détache les trades au lieu de les supprimer, une fois validé", async () => {
    const { client, calls } = mockClient([{ data: [{ id: ID }], error: null }]);
    const r = await executeCoachConfirm(client, USER, { op: "delete_strategy", strategy_id: ID, label: "x", tone: "destructive" });
    expect(r.ok).toBe(true);
    // Les trades sont la mémoire du trader : on les détache, on ne les efface pas.
    expect(called(calls, "update")).toBe(true);
    expect(tables(calls)).toContain("trades");
    expect(r.action).toEqual({ type: "strategy_deleted" });
  });

  it("reste fermée au plan Plus", async () => {
    const { client, calls } = mockClient([{ data: [{ id: ID }], error: null }]);
    const r = await executeCoachConfirm(client, USER, { op: "delete_strategy", strategy_id: ID, label: "x", tone: "destructive" }, "plus");
    expect(r.ok).toBe(false);
    expect(called(calls, "delete")).toBe(false);
  });
});

describe("delete_account", () => {
  it("NE SUPPRIME PAS et compte les trades rattachés", async () => {
    const { client, calls } = mockClient([
      { data: { id: ID, firm: "FTMO", type: "prop", account_number: "12345" }, error: null },
      { data: null, error: null, count: 7 },
    ]);
    const r = await executeCoachTool(client, USER, "delete_account", { account_id: ID });
    expect(called(calls, "delete")).toBe(false);
    expect((r.confirm as { label: string }).label).toContain("FTMO");
    expect((r.result as { linked_trades: number }).linked_trades).toBe(7);
  });

  it("détache les trades une fois validé", async () => {
    const { client, calls } = mockClient([{ data: [{ id: ID }], error: null }]);
    const r = await executeCoachConfirm(client, USER, { op: "delete_account", account_id: ID, label: "x", tone: "destructive" });
    expect(r.ok).toBe(true);
    expect(tables(calls)).toContain("trades");
    expect(r.action).toEqual({ type: "account_deleted" });
  });
});
