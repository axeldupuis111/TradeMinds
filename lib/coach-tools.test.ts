import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachConfirm, executeCoachTool, executeCoachUndo, COACH_TOOLS, type CoachUndo } from "./coach-tools";
import { CHALLENGE_POOL, challengesForWeek, isoWeekKey } from "./community-challenges";

const USER = "11111111-1111-1111-1111-111111111111";
const TRADE = "22222222-2222-2222-2222-222222222222";

/**
 * Mock Supabase chaînable minimal : chaque méthode de query renvoie le builder
 * lui-même, et le builder est « thenable » (résout `resolved`). `insert`/`update`/
 * `delete`/`upsert` enregistrent leurs args pour les assertions.
 */
function mockClient(resolved: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "eq", "in", "is", "ilike", "gte", "lt", "order", "limit", "insert", "update", "delete", "upsert", "maybeSingle", "single"]) {
    builder[m] = chain(m);
  }
  // Rend le builder awaitable.
  builder.then = (resolve: (v: unknown) => unknown) => resolve(resolved);
  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    return builder;
  });
  const client = { from } as unknown as SupabaseClient;
  return { client, calls, from };
}

function called(calls: { method: string }[], method: string): boolean {
  return calls.some((c) => c.method === method);
}

describe("COACH_TOOLS schema", () => {
  it("expose des outils bien formés (name + input_schema objet)", () => {
    expect(COACH_TOOLS.length).toBeGreaterThan(0);
    for (const t of COACH_TOOLS) {
      expect(typeof t.name).toBe("string");
      expect(t.input_schema.type).toBe("object");
    }
  });
});

describe("create_goal — validation", () => {
  it("rejette une period invalide sans écrire", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "create_goal", { kind: "metric", period: "decade", metric: "win_rate", target: 50 });
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("rejette une metric inconnue", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "create_goal", { kind: "metric", period: "month", metric: "sharpe", target: 1 });
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("rejette une target hors bornes", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "create_goal", { kind: "metric", period: "month", metric: "win_rate", target: -5 });
    expect(r.isError).toBe(true);
  });

  it("crée un objectif mesuré valide et émet l'action", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const r = await executeCoachTool(client, USER, "create_goal", { kind: "metric", period: "month", metric: "discipline_score", target: 85 });
    expect(r.isError).toBeFalsy();
    expect(r.action).toEqual({ type: "goal_created", kind: "metric" });
    const insert = calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({ user_id: USER, metric: "discipline_score", target: 85, comparator: "gte", period: "month" });
  });

  it("exige un title pour un objectif personnel", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "create_goal", { kind: "custom", period: "week", title: "   " });
    expect(r.isError).toBe(true);
  });
});

describe("update_goal / delete_goal — validation", () => {
  it("rejette un goal_id non-UUID", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "update_goal", { goal_id: "not-a-uuid", target: 80 });
    expect(r.isError).toBe(true);
    expect(called(calls, "update")).toBe(false);
  });

  it("rejette une mise à jour vide", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "update_goal", { goal_id: TRADE });
    expect(r.isError).toBe(true);
  });

  it("signale un objectif introuvable (0 ligne)", async () => {
    // maybeSingle renvoie null quand l'objectif n'existe pas : rien à confirmer.
    const { client } = mockClient({ data: null, error: null });
    const r = await executeCoachTool(client, USER, "delete_goal", { goal_id: TRADE });
    expect(r.isError).toBe(true);
  });

  it("NE SUPPRIME PAS : delete_goal demande une confirmation", async () => {
    const { client, calls } = mockClient({ data: { id: TRADE, title: "Zéro trade avant 9h" }, error: null });
    const r = await executeCoachTool(client, USER, "delete_goal", { goal_id: TRADE });
    expect(r.isError).toBeFalsy();
    // Aucune suppression déclenchée par l'outil : c'est le clic qui l'exécute.
    expect(called(calls, "delete")).toBe(false);
    expect(r.confirm).toMatchObject({ tone: "destructive" as const, op: "delete_goal", goal_id: TRADE });
    expect(r.confirm?.label).toBe("Zéro trade avant 9h");
    expect((r.result as { requires_confirmation?: boolean }).requires_confirmation).toBe(true);
  });

  it("rejette un goal_id non-UUID sans rien lire", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "delete_goal", { goal_id: "nope" });
    expect(r.isError).toBe(true);
    expect(called(calls, "from")).toBe(false);
  });
});

describe("executeCoachConfirm", () => {
  it("supprime réellement l'objectif une fois validé, et rend l'annulation", async () => {
    const { client, calls } = mockClient({ data: [{ id: TRADE }], error: null });
    const r = await executeCoachConfirm(client, USER, { tone: "destructive" as const, op: "delete_goal", goal_id: TRADE, label: "x" });
    expect(r.ok).toBe(true);
    expect(called(calls, "delete")).toBe(true);
    expect(r.action).toEqual({ type: "goal_deleted" });
  });

  it("refuse un identifiant invalide", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachConfirm(client, USER, { tone: "destructive" as const, op: "delete_goal", goal_id: "nope", label: "x" });
    expect(r.ok).toBe(false);
    expect(called(calls, "delete")).toBe(false);
  });

  it("refuse quand le plan ne couvre pas l'action", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachConfirm(client, USER, { tone: "destructive" as const, op: "delete_goal", goal_id: TRADE, label: "x" }, "free");
    expect(r.ok).toBe(false);
    expect(called(calls, "delete")).toBe(false);
  });

  it("signale un objectif déjà disparu au lieu de prétendre l'avoir supprimé", async () => {
    const { client } = mockClient({ data: [], error: null });
    const r = await executeCoachConfirm(client, USER, { tone: "destructive" as const, op: "delete_goal", goal_id: TRADE, label: "x" });
    expect(r.ok).toBe(false);
  });
});

describe("annotate_trades — validation", () => {
  it("rejette une liste d'ids vide/invalide", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "annotate_trades", { trade_ids: ["nope"], emotion: "fomo" });
    expect(r.isError).toBe(true);
    expect(called(calls, "update")).toBe(false);
  });

  it("rejette un setup_quality hors 1-5", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "annotate_trades", { trade_ids: [TRADE], setup_quality: 9 });
    expect(r.isError).toBe(true);
  });

  it("rejette une émotion inconnue", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "annotate_trades", { trade_ids: [TRADE], emotion: "euphoric" });
    expect(r.isError).toBe(true);
  });

  it("annote et compte les trades mis à jour", async () => {
    const { client } = mockClient({ data: [{ id: TRADE }], error: null });
    const r = await executeCoachTool(client, USER, "annotate_trades", { trade_ids: [TRADE], emotion: "confident" });
    expect(r.isError).toBeFalsy();
    expect(r.action).toEqual({ type: "trades_annotated", count: 1 });
  });
});

describe("manage_challenge — validation", () => {
  it("rejette un challenge inconnu", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "manage_challenge", { challenge_key: "ghost", action: "join" });
    expect(r.isError).toBe(true);
  });

  it("rejette un challenge du pool absent du tirage de la semaine", async () => {
    const week = challengesForWeek(isoWeekKey()).map((c) => c.key);
    const offDraw = CHALLENGE_POOL.find((c) => !week.includes(c.key));
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "manage_challenge", { challenge_key: offDraw!.key, action: "join" });
    expect(r.isError).toBe(true);
    expect(called(calls, "upsert")).toBe(false);
  });

  it("rejoint un challenge du tirage en cours", async () => {
    const key = challengesForWeek(isoWeekKey())[0].key;
    const { client } = mockClient({ data: null, error: null });
    const r = await executeCoachTool(client, USER, "manage_challenge", { challenge_key: key, action: "join" });
    expect(r.isError).toBeFalsy();
    expect(r.action).toEqual({ type: "challenge_joined" });
  });
});

describe("save_coach_note", () => {
  it("rejette un texte vide", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "save_coach_note", { text: "  " });
    expect(r.isError).toBe(true);
  });
});

describe("outil inconnu", () => {
  it("renvoie une erreur", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "drop_database", {});
    expect(r.isError).toBe(true);
  });
});

describe("stratégies — validation", () => {
  it("create_strategy exige un nom", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "create_strategy", { name: "  " });
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("create_strategy rejette une règle numérique hors bornes", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "create_strategy", { name: "Scalp", risk_reward: 999 });
    expect(r.isError).toBe(true);
  });

  it("create_strategy valide crée et émet l'action", async () => {
    const { client, calls } = mockClient({ data: { id: TRADE }, error: null });
    const r = await executeCoachTool(client, USER, "create_strategy", { name: "ICT Silver Bullet", risk_reward: 2, setup_rules: ["Attendre la killzone"] });
    expect(r.isError).toBeFalsy();
    expect(r.action).toEqual({ type: "strategy_created" });
    const insert = calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({ user_id: USER, name: "ICT Silver Bullet", risk_reward: 2 });
  });

  it("update_strategy rejette un id non-UUID", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "update_strategy", { strategy_id: "x", name: "Y" });
    expect(r.isError).toBe(true);
  });

  it("update_strategy sans champ échoue", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "update_strategy", { strategy_id: TRADE });
    expect(r.isError).toBe(true);
  });

  it("add_checklist_item exige un label", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "add_checklist_item", { strategy_id: TRADE, label: "" });
    expect(r.isError).toBe(true);
  });
});

describe("export_trades", () => {
  it("génère un CSV et l'action export_ready", async () => {
    const rows = [
      { open_time: "2026-07-01T09:00:00Z", close_time: "2026-07-01T10:00:00Z", pair: "EURUSD", direction: "long", lot_size: 1, entry_price: 1.1, exit_price: 1.2, sl: 1.0, tp: 1.3, pnl: 100, commission: -2, swap: 0, emotion: "confident", setup_quality: 4, tags: ["a", "b"], notes: "clean, tidy" },
    ];
    const { client } = mockClient({ data: rows, error: null });
    const r = await executeCoachTool(client, USER, "export_trades", {});
    expect(r.action?.type).toBe("export_ready");
    if (r.action?.type === "export_ready") {
      expect(r.action.count).toBe(1);
      expect(r.action.csv).toContain("open_time,close_time,pair");
      expect(r.action.csv).toContain("EURUSD");
      // net_pnl = 100 + (-2) = 98 ; note avec virgule → quotée.
      expect(r.action.csv).toContain("98");
      expect(r.action.csv).toContain('"clean, tidy"');
    }
  });

  it("signale l'absence de résultat", async () => {
    const { client } = mockClient({ data: [], error: null });
    const r = await executeCoachTool(client, USER, "export_trades", { pair: "GBPJPY" });
    expect(r.action).toBeUndefined();
    expect((r.result as { count: number }).count).toBe(0);
  });
});

describe("executeCoachUndo", () => {
  it("supprime un objectif recréé (undo de create_goal)", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const undo: CoachUndo = { op: "delete_goal", goal_id: TRADE };
    const r = await executeCoachUndo(client, USER, undo);
    expect(r.ok).toBe(true);
    expect(called(calls, "delete")).toBe(true);
  });

  it("réinsère un objectif supprimé en forçant user_id et en filtrant les colonnes", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const undo: CoachUndo = { op: "insert_goal", row: { id: TRADE, user_id: "someone-else", metric: "win_rate", target: 50, comparator: "gte", period: "month", evil_col: "x" } };
    const r = await executeCoachUndo(client, USER, undo);
    expect(r.ok).toBe(true);
    const insert = calls.find((c) => c.method === "insert");
    const row = insert?.args[0] as Record<string, unknown>;
    expect(row.user_id).toBe(USER); // jamais l'utilisateur du payload
    expect(row).not.toHaveProperty("evil_col"); // colonne non whitelistée retirée
    expect(row.metric).toBe("win_rate");
  });

  it("restaure les champs de trades (undo d'annotation)", async () => {
    const { client, calls } = mockClient({ data: null, error: null });
    const undo: CoachUndo = { op: "restore_trades", trades: [{ id: TRADE, fields: { emotion: null, hacker_col: "x" } }] };
    const r = await executeCoachUndo(client, USER, undo);
    expect(r.ok).toBe(true);
    const update = calls.find((c) => c.method === "update");
    expect(update?.args[0]).toEqual({ emotion: null }); // hacker_col ignoré
  });

  it("rejette une opération inconnue", async () => {
    const { client } = mockClient();
    const r = await executeCoachUndo(client, USER, { op: "rm_rf" } as unknown as CoachUndo);
    expect(r.ok).toBe(false);
  });
});

/**
 * ⚠️ LE BUG QUE CE BLOC EMPÊCHE DE REVENIR.
 *
 * Jusqu'au 2026-08-26, CHACUNE des seize annulations s'écrivait
 * `await supabase.from(...).delete()...` sans lire `error`, puis retournait
 * `{ ok: true }`. Le client Supabase ne jette pas : une table absente, une
 * politique RLS ou une panne réseau produisaient exactement le même succès.
 *
 * Ce que ça donnait à l'écran : le trader clique « Annuler », le chip passe à
 * « annulé », le coach confirme, et la donnée n'a pas bougé d'un octet. Le pire
 * cas est `delete_trade` (undo de création) : un trade fantôme reste dans le
 * journal, et fausse toutes les statistiques calculées dessus.
 *
 * Chaque op est donc jouée deux fois : contre une base saine, et contre une
 * base qui refuse d'écrire.
 */
describe("une annulation qui échoue ne doit JAMAIS se déclarer réussie", () => {
  const STRAT = "33333333-3333-3333-3333-333333333333";
  const DEFI = CHALLENGE_POOL[0].key;

  const TOUTES: CoachUndo[] = [
    { op: "delete_goal", goal_id: TRADE },
    { op: "insert_goal", row: { metric: "win_rate", target: 50, comparator: "gte", period: "month" } },
    { op: "update_goal", goal_id: TRADE, patch: { target: 60 } },
    { op: "join_challenge", key: DEFI },
    { op: "leave_challenge", key: DEFI },
    { op: "restore_trades", trades: [{ id: TRADE, fields: { emotion: "calm" } }] },
    { op: "delete_checklist_item", strategy_id: STRAT, value: "fvg" },
    { op: "insert_checklist_item", row: { strategy_id: STRAT, tag_type: "checklist", value: "fvg" } },
    { op: "delete_trade", trade_id: TRADE },
    { op: "restore_trade_fields", trade_id: TRADE, fields: { pnl: 12 } },
    { op: "restore_trade_links", trades: [{ id: TRADE, challenge_id: null, strategy_id: STRAT }] },
    { op: "delete_account", account_id: TRADE },
    { op: "restore_account", account_id: TRADE, fields: { account_size: 10000 } },
    { op: "delete_session", session_id: TRADE },
    { op: "reopen_session", session_id: TRADE },
    { op: "delete_emotional_check", check_id: TRADE },
  ];

  it("le tableau ci-dessus couvre TOUTES les opérations du type CoachUndo", () => {
    // ⚠️ Sans ça, une dix-septième opération ajoutée demain retomberait dans le
    // silence sans qu'aucun test ne bronche. On lit le type à la source.
    const src = readFileSync(new URL("./coach-tools.ts", import.meta.url), "utf-8");
    const debut = src.indexOf("export type CoachUndo =");
    // ⚠️ On coupe à la ligne vide, pas au premier « ; » : le type en contient
    // un dans chaque membre de l'union (`{ op: "delete_goal"; goal_id: string }`).
    const union = src.slice(debut, src.indexOf("\n\n", debut));
    const declarees = (union.match(/op: "[a-z_]+"/g) ?? []).map((m) => m.slice(5, -1)).sort();
    const couvertes = TOUTES.map((u) => u.op).sort();
    expect(couvertes).toEqual(declarees);
  });

  for (const undo of TOUTES) {
    it(`${undo.op} : réussit sur une base saine, échoue quand l'écriture est refusée`, async () => {
      const sain = mockClient({ data: [{ id: TRADE }], error: null });
      expect((await executeCoachUndo(sain.client, USER, undo)).ok).toBe(true);

      const casse = mockClient({ data: null, error: { message: "permission denied for table" } });
      const r = await executeCoachUndo(casse.client, USER, undo);
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    });
  }
});
