import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";

/**
 * Régression du 21 août 2026 : le coach jurait au trader qu'aucune analyse
 * macro n'existait, quatre messages d'affilée, pendant qu'il en avait une
 * affichée sous les yeux.
 *
 * Cause : `macro_analyses` est du contenu premium PARTAGÉ, protégé par une RLS
 * sans aucune policy de lecture. Interrogée avec le client user-scoped du
 * coach, elle rend zéro ligne SANS erreur — un vide que rien ne distingue d'une
 * absence réelle. Le coach lit donc désormais cette table avec le service role,
 * comme /api/macro-analysis, et ces tests l'y tiennent.
 */

const { adminFrom, adminState } = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  adminState: { throws: false },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (adminState.throws) throw new Error("Missing Supabase admin credentials");
    return { from: adminFrom } as unknown as SupabaseClient;
  },
}));

const USER = "11111111-1111-4111-8111-111111111111";

/** Chaîne Supabase simulée : chaque `from()` consomme la réponse suivante. */
function adminReturns(...responses: { data?: unknown; error?: unknown }[]) {
  let i = 0;
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (m: string) => (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
  for (const m of ["select", "eq", "lte", "gte", "order", "limit"]) builder[m] = chain(m);
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve(responses[Math.min(i++, responses.length - 1)] ?? { data: [], error: null });
  adminFrom.mockImplementation((t: string) => { calls.push({ method: "from", args: [t] }); return builder; });
  return calls;
}

/** Client du trader : le briefing macro ne doit JAMAIS passer par lui. */
function userClient() {
  const from = vi.fn(() => { throw new Error("le briefing macro ne doit pas passer par le client RLS"); });
  return { client: { from } as unknown as SupabaseClient, from };
}

const BRIEFING = {
  analysis_date: "2026-08-20",
  headline: "Les PMI dictent la séance",
  tldr: "Journée de données",
  sentiment: "neutral",
  overview: "…",
  themes: [],
  watchlist: [],
  assets: [],
  takeaway: "…",
};

beforeEach(() => {
  adminState.throws = false;
  adminFrom.mockReset();
});

describe("get_macro_briefing", () => {
  it("lit le briefing avec le service role, jamais avec le client du trader", async () => {
    const calls = adminReturns({ data: [BRIEFING], error: null });
    const { client, from } = userClient();

    const r = await executeCoachTool(client, USER, "get_macro_briefing", {}, "Europe/Paris", "premium", "fr");

    expect(r.isError).toBeFalsy();
    expect((r.result as typeof BRIEFING).analysis_date).toBe("2026-08-20");
    expect(from).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({ method: "from", args: ["macro_analyses"] });
  });

  it("filtre sur la date demandée et sur la langue du trader", async () => {
    const calls = adminReturns({ data: [BRIEFING], error: null });
    const { client } = userClient();

    await executeCoachTool(
      client, USER, "get_macro_briefing", { date: "2026-08-20" }, "Europe/Paris", "premium", "de",
    );

    const eqs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["lang", "de"]);
    expect(eqs).toContainEqual(["analysis_date", "2026-08-20"]);
  });

  it("se rabat sur les colonnes de base si les récentes ne sont pas migrées", async () => {
    adminReturns(
      { data: null, error: { code: "42703", message: "column assets does not exist" } },
      { data: [{ analysis_date: "2026-08-20", headline: "Les PMI dictent la séance" }], error: null },
    );
    const { client } = userClient();

    const r = await executeCoachTool(client, USER, "get_macro_briefing", {}, "Europe/Paris", "premium", "fr");

    expect(r.isError).toBeFalsy();
    expect((r.result as { headline: string }).headline).toBe("Les PMI dictent la séance");
  });

  it("nomme le briefing le plus proche quand la date demandée n'en a pas", async () => {
    adminReturns(
      { data: [], error: null },
      { data: [{ analysis_date: "2026-08-19" }], error: null },
    );
    const { client } = userClient();

    const r = await executeCoachTool(
      client, USER, "get_macro_briefing", { date: "2026-08-20" }, "Europe/Paris", "premium", "fr",
    );

    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toContain("2026-08-19");
  });

  it("dit qu'il ne sait pas lire plutôt que d'affirmer une absence si le service role manque", async () => {
    adminState.throws = true;
    const { client } = userClient();

    const r = await executeCoachTool(client, USER, "get_macro_briefing", {}, "Europe/Paris", "premium", "fr");

    expect(r.isError).toBe(true);
    // Le message doit interdire au modèle de conclure à l'inexistence.
    expect((r.result as { error: string }).error).toMatch(/Ne conclus pas/i);
  });

  it("reste réservé au premium", async () => {
    adminReturns({ data: [BRIEFING], error: null });
    const { client } = userClient();

    const r = await executeCoachTool(client, USER, "get_macro_briefing", {}, "Europe/Paris", "plus", "fr");

    expect(r.isError).toBe(true);
    expect(adminFrom).not.toHaveBeenCalled();
  });
});
