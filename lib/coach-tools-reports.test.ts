import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachConfirm, executeCoachTool } from "./coach-tools";

const USER = "11111111-1111-4111-8111-111111111111";

function mockClient(seq: { data?: unknown; error?: unknown; count?: number }[]) {
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

describe("run_ai_report", () => {
  it("NE LANCE RIEN et annonce que ça consomme un crédit", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "run_ai_report", { kind: "weekly_plan" }, "Europe/Paris", "premium");
    const res = r.result as { requires_confirmation: boolean; costs_credit: boolean; instruction: string };
    expect(res.requires_confirmation).toBe(true);
    expect(res.costs_credit).toBe(true);
    expect(res.instruction).toContain("crédit");
    expect(r.confirm).toMatchObject({ op: "run_ai_report", kind: "weekly_plan" });
  });

  it("refuse un débrief sans session ouverte, plutôt que de brûler un crédit", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "run_ai_report", { kind: "session_debrief" }, undefined, "premium");
    expect(r.isError).toBe(true);
    const msg = (r.result as { error: string }).error;
    expect(msg).toContain("AUCUN bouton");
    expect(msg).toContain("start_session");
  });

  it("porte l'identifiant de la session ouverte dans la demande", async () => {
    const { client } = mockClient([{ data: { id: "sess-1" }, error: null }]);
    const r = await executeCoachTool(client, USER, "run_ai_report", { kind: "session_debrief" }, undefined, "premium");
    expect((r.confirm as { session_id: string }).session_id).toBe("sess-1");
  });

  it("retombe sur le mois en cours quand aucun mois n'est donné", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachTool(client, USER, "run_ai_report", { kind: "monthly_review" }, "Europe/Paris", "premium");
    expect((r.confirm as { month: string }).month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("rejette un type de rapport inconnu", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    expect((await executeCoachTool(client, USER, "run_ai_report", { kind: "horoscope" }, undefined, "premium")).isError).toBe(true);
  });

  it("reste fermé au plan gratuit", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    expect((await executeCoachTool(client, USER, "run_ai_report", { kind: "weekly_plan" }, undefined, "free")).isError).toBe(true);
  });
});

describe("export_pdf", () => {
  it("NE GÉNÈRE RIEN, annonce le volume et précise que c'est gratuit", async () => {
    const { client } = mockClient([{ data: null, error: null, count: 84 }]);
    const r = await executeCoachTool(client, USER, "export_pdf", {}, "Europe/Paris", "premium", "fr");
    const res = r.result as { requires_confirmation: boolean; costs_credit: boolean; what: string };
    expect(res.requires_confirmation).toBe(true);
    expect(res.costs_credit).toBe(false);
    expect(res.what).toContain("84 trades");
    expect(r.confirm).toMatchObject({ op: "export_pdf", count: 84 });
  });

  it("refuse une période vide plutôt que de produire un PDF vide", async () => {
    const { client } = mockClient([{ data: null, error: null, count: 0 }]);
    const r = await executeCoachTool(client, USER, "export_pdf", { date_from: "2020-01-01", date_to: "2020-02-01" });
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toContain("AUCUN bouton");
  });

  it("écrit les dates en clair dans le libellé", async () => {
    const { client } = mockClient([{ data: null, error: null, count: 12 }]);
    const r = await executeCoachTool(
      client, USER, "export_pdf", { date_from: "2026-07-01", date_to: "2026-08-01" }, "Europe/Paris", "premium", "fr",
    );
    expect((r.confirm as { label: string }).label).toContain("juillet 2026");
  });
});

describe("aiguillage des opérations exécutées par le client", () => {
  it("la route de confirmation refuse un rapport IA au lieu de l'exécuter", async () => {
    const { client, calls } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachConfirm(client, USER, {
      op: "run_ai_report", kind: "weekly_plan", month: "2026-08", session_id: null, label: "x",
    });
    expect(r.ok).toBe(false);
    // Aucune écriture : cette route n'est pas censée traiter cette opération.
    expect(calls.some((c) => c.method === "insert" || c.method === "update")).toBe(false);
  });

  it("elle refuse aussi la génération de PDF", async () => {
    const { client } = mockClient([{ data: null, error: null }]);
    const r = await executeCoachConfirm(client, USER, {
      op: "export_pdf", from: "2026-07-01T00:00:00Z", to: "2026-08-01T00:00:00Z", label: "x", count: 3,
    });
    expect(r.ok).toBe(false);
  });
});
