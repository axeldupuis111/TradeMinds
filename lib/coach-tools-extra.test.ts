import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";

const USER = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";

/** Client simulé qui rend une réponse différente à chaque requête enchaînée. */
function mockClient(seq: { data?: unknown; error?: unknown }[]) {
  let i = 0;
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (m: string) => (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
  for (const m of ["select", "eq", "in", "is", "ilike", "gte", "lt", "order", "limit", "insert", "update", "delete", "upsert", "maybeSingle", "single"]) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(seq[Math.min(i++, seq.length - 1)]);
  const from = vi.fn((t: string) => { calls.push({ method: "from", args: [t] }); return builder; });
  return { client: { from } as unknown as SupabaseClient, calls };
}
const called = (calls: { method: string }[], m: string) => calls.some((c) => c.method === m);

describe("get_challenge_status", () => {
  const account = {
    id: ACC, type: "prop", firm: "FTMO", account_size: 100000, currency: "EUR",
    profit_target_pct: 8, max_daily_dd_pct: 5, max_total_dd_pct: 10,
    start_date: "2026-08-01", status: "active",
    synced_balance: null, synced_equity: null, synced_at: null,
  };
  const perte = [{ pnl: -2000, commission: -20, swap: 0, open_time: "2026-08-02T09:00:00Z" }];

  it("calcule ce qui reste d'objectif et de drawdown", async () => {
    const { client } = mockClient([{ data: [account], error: null }, { data: perte, error: null }]);
    const r = await executeCoachTool(client, USER, "get_challenge_status", {}, "Europe/Paris");
    const res = r.result as Record<string, number | boolean>;
    expect(res.profit_target).toBe(8000);
    // Performance de -2020 : il reste 10 020 à aller chercher pour l'objectif.
    expect(res.profit_remaining).toBeCloseTo(10020, 2);
    // Drawdown total autorisé 10 000, dont 2 020 déjà consommés.
    expect(res.total_dd_remaining).toBeCloseTo(7980, 2);
    expect(res.balance_from_broker).toBe(false);
  });

  it("laisse le solde du courtier faire autorité quand il existe", async () => {
    const synced = { ...account, synced_balance: 97500, synced_equity: 97500, synced_at: new Date().toISOString() };
    const { client } = mockClient([{ data: [synced], error: null }, { data: perte, error: null }]);
    const r = await executeCoachTool(client, USER, "get_challenge_status", {}, "Europe/Paris");
    const res = r.result as Record<string, number | boolean>;
    // Règle dure du produit : le solde synchronisé s'affiche tel quel, on ne
    // lui rajoute jamais les trades par-dessus.
    expect(res.balance).toBe(97500);
    expect(res.balance_from_broker).toBe(true);
  });

  it("oriente vers list_accounts quand aucun challenge n'existe", async () => {
    const { client } = mockClient([{ data: [], error: null }]);
    const r = await executeCoachTool(client, USER, "get_challenge_status", {});
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toContain("list_accounts");
  });
});

describe("get_performance", () => {
  const trades = [
    { open_time: "2026-08-03T09:00:00Z", close_time: "2026-08-03T10:00:00Z", pair: "XAUUSD", direction: "long", lot_size: 1, pnl: 100, commission: 0, swap: 0 },
    { open_time: "2026-08-03T14:00:00Z", close_time: "2026-08-03T15:00:00Z", pair: "EURUSD", direction: "short", lot_size: 1, pnl: -60, commission: 0, swap: 0 },
  ];

  it("ventile par instrument, le plus déficitaire en tête", async () => {
    const { client } = mockClient([{ data: trades, error: null }]);
    const r = await executeCoachTool(client, USER, "get_performance", { dimension: "pair" }, "Europe/Paris");
    const res = r.result as { segments: { key: string; net_pnl: number }[] };
    expect(res.segments[0].key).toBe("EURUSD");
    expect(res.segments.at(-1)?.key).toBe("XAUUSD");
  });

  it("rappelle qu'un petit échantillon ne prouve rien", async () => {
    const { client } = mockClient([{ data: trades, error: null }]);
    const r = await executeCoachTool(client, USER, "get_performance", { dimension: "direction" });
    expect((r.result as { note: string }).note).toContain("5 trades");
  });

  it("rejette une dimension inconnue", async () => {
    const { client } = mockClient([{ data: trades, error: null }]);
    expect((await executeCoachTool(client, USER, "get_performance", { dimension: "humeur" })).isError).toBe(true);
  });

  it("ne prétend rien quand la période est vide", async () => {
    const { client } = mockClient([{ data: [], error: null }]);
    const r = await executeCoachTool(client, USER, "get_performance", { dimension: "pair" });
    expect((r.result as { count: number }).count).toBe(0);
  });
});

describe("sessions", () => {
  it("refuse d'en ouvrir une seconde si une session tourne déjà", async () => {
    const { client, calls } = mockClient([{ data: { id: "s1" }, error: null }]);
    const r = await executeCoachTool(client, USER, "start_session", { emotion: "confident" }, undefined, "plus");
    expect(r.isError).toBe(true);
    expect(called(calls, "insert")).toBe(false);
  });

  it("rejette une émotion hors liste", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    expect((await executeCoachTool(client, USER, "start_session", { emotion: "vener" }, undefined, "plus")).isError).toBe(true);
  });

  it("refuse de clôturer quand rien n'est ouvert", async () => {
    const { client, calls } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "end_session", {}, undefined, "plus");
    expect(r.isError).toBe(true);
    expect(called(calls, "update")).toBe(false);
  });

  it("reste fermée au plan gratuit", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    expect((await executeCoachTool(client, USER, "start_session", { emotion: "confident" }, undefined, "free")).isError).toBe(true);
  });
});

describe("open_page", () => {
  it("construit un lien avec les filtres de la page trades", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "open_page", {
      page: "trades", pair: "xauusd", result: "loss", date_from: "2026-07-01", date_to: "2026-08-01",
    });
    const href = (r.action as { href: string }).href;
    expect(href).toContain("/dashboard/trades?");
    expect(href).toContain("pair=XAUUSD");
    expect(href).toContain("result=loss");
    expect(href).toContain("from=2026-07-01");
  });

  it("rend la racine du dashboard sans double barre", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "open_page", { page: "dashboard" });
    expect((r.action as { href: string }).href).toBe("/dashboard");
  });

  it("ignore les filtres sur une page qui n'en lit pas", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "open_page", { page: "macro", pair: "XAUUSD" });
    expect((r.action as { href: string }).href).toBe("/dashboard/macro");
  });

  it("refuse une destination hors du site", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    expect((await executeCoachTool(client, USER, "open_page", { page: "/etc/passwd" })).isError).toBe(true);
    expect((await executeCoachTool(client, USER, "open_page", { page: "https://ailleurs.example" })).isError).toBe(true);
  });

  it("ne déplace jamais le trader de force : il pose un lien", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "open_page", { page: "goals" });
    expect(r.action).toMatchObject({ type: "navigate" });
    expect((r.result as { instruction: string }).instruction).toContain("clique");
  });
});
