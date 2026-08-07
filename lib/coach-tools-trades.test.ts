import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachConfirm, executeCoachTool } from "./coach-tools";

const USER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const ID2 = "33333333-3333-4333-8333-333333333333";

/** Client Supabase simulé : enregistre les appels, renvoie une valeur fixée. */
function mockClient(resolved: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => { calls.push({ method, args }); return builder; };
  for (const m of ["select", "eq", "in", "is", "ilike", "gte", "lt", "order", "limit", "insert", "update", "delete", "upsert", "maybeSingle", "single"]) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(resolved);
  const from = vi.fn((table: string) => { calls.push({ method: "from", args: [table] }); return builder; });
  return { client: { from } as unknown as SupabaseClient, calls };
}
const called = (calls: { method: string }[], m: string) => calls.some((c) => c.method === m);
const argsOf = (calls: { method: string; args: unknown[] }[], m: string) => calls.find((c) => c.method === m)?.args;

describe("calculate_position_size", () => {
  it("calcule des lots sur un CFD à partir du risque et du stop", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "calculate_position_size", {
      pair: "EURUSD", risk_amount: 100, sl_pips: 20,
    });
    const res = r.result as { instrument_type: string; lots: number };
    expect(res.instrument_type).toBe("cfd");
    // 100 € / (20 pips × 10 €/pip/lot) = 0,5 lot
    expect(res.lots).toBeCloseTo(0.5, 2);
  });

  it("déduit le stop en pips depuis les prix quand sl_pips manque", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "calculate_position_size", {
      pair: "XAUUSD", risk_amount: 250, entry_price: 2650, sl_price: 2645,
    });
    // XAUUSD : pip = 0,10 → 5 $ d'écart = 50 pips
    expect((r.result as { sl_pips: number }).sl_pips).toBeCloseTo(50, 1);
  });

  it("accepte un pourcentage du capital plutôt qu'un montant", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "calculate_position_size", {
      pair: "EURUSD", risk_pct: 1, account_balance: 10000, sl_pips: 20,
    });
    expect((r.result as { risk_budget: number }).risk_budget).toBeCloseTo(100, 2);
  });

  it("arrondit les contrats futures au plancher, jamais au-dessus du budget", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "calculate_position_size", {
      pair: "NQ", risk_amount: 500, sl_pips: 30,
    });
    const res = r.result as { instrument_type: string; contracts: number; actual_risk: number };
    expect(res.instrument_type).toBe("futures");
    expect(Number.isInteger(res.contracts)).toBe(true);
    expect(res.actual_risk).toBeLessThanOrEqual(500);
  });

  it("le dit franchement quand le budget ne paie pas un seul contrat", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "calculate_position_size", {
      pair: "NQ", risk_amount: 1, sl_pips: 100,
    });
    expect((r.result as { contracts: number }).contracts).toBe(0);
    expect((r.result as { note: string }).note).toContain("ne permet pas");
  });

  it("refuse un appel sans budget de risque exploitable", async () => {
    const { client } = mockClient();
    expect((await executeCoachTool(client, USER, "calculate_position_size", { pair: "EURUSD", sl_pips: 20 })).isError).toBe(true);
  });

  it("refuse un appel sans distance de stop", async () => {
    const { client } = mockClient();
    expect((await executeCoachTool(client, USER, "calculate_position_size", { pair: "EURUSD", risk_amount: 100 })).isError).toBe(true);
  });
});

describe("create_trade", () => {
  it("exige exit_price et pnl pour un trade clôturé", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "create_trade", {
      pair: "XAUUSD", direction: "buy", lot_size: 0.2, entry_price: 2650,
    });
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("accepte une position ouverte sans prix de sortie", async () => {
    const { client, calls } = mockClient({ data: { id: ID }, error: null });
    const r = await executeCoachTool(client, USER, "create_trade", {
      pair: "XAUUSD", direction: "buy", lot_size: 0.2, entry_price: 2650, status: "open",
    });
    expect(r.isError).toBeFalsy();
    const row = (argsOf(calls, "insert")?.[0] ?? {}) as Record<string, unknown>;
    expect(row.status).toBe("open");
    expect(row.exit_price).toBeNull();
    expect(r.undo).toMatchObject({ op: "delete_trade", trade_id: ID });
  });

  it("normalise buy/sell en long/short", async () => {
    const { client, calls } = mockClient({ data: { id: ID }, error: null });
    await executeCoachTool(client, USER, "create_trade", {
      pair: "eurusd", direction: "sell", lot_size: 1, entry_price: 1.1, exit_price: 1.09, pnl: 100,
    });
    const row = (argsOf(calls, "insert")?.[0] ?? {}) as Record<string, unknown>;
    expect(row.direction).toBe("short");
    expect(row.pair).toBe("EURUSD");
  });

  it("rejette un sens inconnu", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(client, USER, "create_trade", {
      pair: "XAUUSD", direction: "peut-être", lot_size: 1, entry_price: 2650,
    });
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("rejette une taille de position absurde", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "create_trade", {
      pair: "XAUUSD", direction: "buy", lot_size: -3, entry_price: 2650, exit_price: 2660, pnl: 10,
    });
    expect(r.isError).toBe(true);
  });
});

describe("close_trade", () => {
  it("refuse de re-clôturer un trade déjà fermé", async () => {
    const { client, calls } = mockClient({ data: { id: ID, status: "closed" }, error: null });
    const r = await executeCoachTool(client, USER, "close_trade", { trade_id: ID, exit_price: 2660, pnl: 120 });
    expect(r.isError).toBe(true);
    expect(called(calls, "update")).toBe(false);
  });

  it("clôture une position ouverte et propose la réouverture en annulation", async () => {
    const { client, calls } = mockClient({ data: { id: ID, status: "open" }, error: null });
    const r = await executeCoachTool(client, USER, "close_trade", { trade_id: ID, exit_price: 2660, pnl: 120 });
    expect(r.isError).toBeFalsy();
    expect(called(calls, "update")).toBe(true);
    expect(r.action).toEqual({ type: "trade_closed" });
    expect((r.undo as { fields: Record<string, unknown> }).fields.status).toBe("open");
  });

  it("rejette un P&L non numérique", async () => {
    const { client } = mockClient({ data: { id: ID, status: "open" }, error: null });
    const r = await executeCoachTool(client, USER, "close_trade", { trade_id: ID, exit_price: 2660, pnl: "beaucoup" });
    expect(r.isError).toBe(true);
  });
});

describe("delete_trades", () => {
  it("NE SUPPRIME PAS : renvoie une demande de confirmation", async () => {
    const { client, calls } = mockClient({
      data: [{ id: ID, pair: "XAUUSD", open_time: "2026-08-05T09:00:00Z", pnl: -120 }],
      error: null,
    });
    const r = await executeCoachTool(client, USER, "delete_trades", { trade_ids: [ID] });
    expect(called(calls, "delete")).toBe(false);
    expect(r.confirm).toMatchObject({ op: "delete_trades", trade_ids: [ID] });
    expect((r.result as { requires_confirmation: boolean }).requires_confirmation).toBe(true);
    expect((r.confirm as { label: string }).label).toContain("XAUUSD");
  });

  it("borne le nombre de suppressions demandées d'un coup", async () => {
    const { client } = mockClient();
    const many = Array.from({ length: 40 }, () => ID);
    const r = await executeCoachTool(client, USER, "delete_trades", { trade_ids: many });
    expect(r.isError).toBe(true);
  });

  it("supprime réellement après validation du trader", async () => {
    const { client, calls } = mockClient({ data: [{ id: ID }, { id: ID2 }], error: null });
    const r = await executeCoachConfirm(client, USER, { op: "delete_trades", trade_ids: [ID, ID2], label: "2 trades" });
    expect(r.ok).toBe(true);
    expect(called(calls, "delete")).toBe(true);
    expect(r.action).toEqual({ type: "trades_deleted", count: 2 });
  });

  it("refuse la suppression si le plan ne la couvre pas", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachConfirm(client, USER, { op: "delete_trades", trade_ids: [ID], label: "x" }, "plus");
    expect(r.ok).toBe(false);
    expect(called(calls, "delete")).toBe(false);
  });
});

describe("reassign_trades", () => {
  it("détache quand on passe \"none\"", async () => {
    const { client, calls } = mockClient({ data: [{ id: ID, challenge_id: ID2, strategy_id: null }], error: null });
    const r = await executeCoachTool(client, USER, "reassign_trades", { trade_ids: [ID], account_id: "none" });
    expect(r.isError).toBeFalsy();
    const patch = (argsOf(calls, "update")?.[0] ?? {}) as Record<string, unknown>;
    expect(patch.challenge_id).toBeNull();
    // L'annulation doit pouvoir remettre le rattachement d'origine.
    expect(r.undo).toMatchObject({ op: "restore_trade_links" });
  });

  it("refuse un appel qui ne change rien", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(client, USER, "reassign_trades", { trade_ids: [ID] });
    expect(r.isError).toBe(true);
  });
});

describe("gating par plan sur les outils d'écriture", () => {
  it("bloque create_trade pour un plan Plus", async () => {
    const { client, calls } = mockClient();
    const r = await executeCoachTool(
      client, USER, "create_trade",
      { pair: "XAUUSD", direction: "buy", lot_size: 1, entry_price: 2650, exit_price: 2660, pnl: 10 },
      undefined, "plus",
    );
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("laisse le calcul de lot accessible au gratuit", async () => {
    const { client } = mockClient();
    const r = await executeCoachTool(
      client, USER, "calculate_position_size",
      { pair: "EURUSD", risk_amount: 100, sl_pips: 20 },
      undefined, "free",
    );
    expect(r.isError).toBeFalsy();
  });
});
