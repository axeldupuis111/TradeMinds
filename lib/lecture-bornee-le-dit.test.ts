import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";

/**
 * UNE LECTURE BORNÉE PREND LES TRADES LES PLUS RÉCENTS, ET ELLE LE DIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `read_projection` GARDAIT LES CINQ MILLE PREMIERS TRADES DU JOURNAL.
 * Trié en ascendant puis coupé à 5 000, un trader qui importe l'historique
 * complet de son compte MT5 se voyait projeter son avenir sur ses DÉBUTS, et
 * ses derniers mois n'entraient pas du tout dans le calcul. C'est l'outil qui
 * annonce un risque de ruine : le tromper d'échantillon, c'est le tromper de
 * conclusion, et dans le sens le plus rassurant qui soit pour un trader qui a
 * appris depuis.
 *
 * ⚠️ ET LES DEUX LECTURES SE TAISAIENT. `get_performance` coupe à 1 000 trades,
 * `read_projection` à 5 000 ; ni l'une ni l'autre ne le signalait au modèle,
 * qui présentait donc un échantillon comme un bilan complet.
 *
 * ── LA MESURE ───────────────────────────────────────────────────────────────
 *
 * Personne n'atteint ces plafonds aujourd'hui : compté le 2026-09-17 en
 * production, 447 trades pour dix traders, le plus fourni en a 157. C'est une
 * synchronisation d'historique qui les franchira, et elle passe d'un coup.
 *
 * ── CE QUE CE GARDE PEUT ET NE PEUT PAS ─────────────────────────────────────
 *
 * ⚠️ LA COUPE SE FAIT DANS LA BASE. Aucune réponse ne montre les lignes qu'elle
 * n'a pas rendues : le SENS DU TRI est donc le seul endroit observable, et
 * c'est lui qu'on épingle. Le reste (le signalement) se vérifie, lui, sur le
 * résultat rendu.
 */

const USER = "11111111-1111-4111-8111-111111111111";

type Appel = { table: string; method: string; args: unknown[] };

function client(reponses: Record<string, unknown[]>) {
  const appels: Appel[] = [];
  const construire = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "lt", "gt", "in", "is", "order", "limit", "range", "maybeSingle", "single"]) {
      b[m] = (...args: unknown[]) => { appels.push({ table, method: m, args }); return b; };
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      const prete = reponses[table];
      if (prete === undefined) throw new Error(`Table « ${table} » interrogée sans réponse préparée.`);
      return resolve({ data: prete, error: null });
    };
    return b;
  };
  return { client: { from: vi.fn((t: string) => construire(t)) } as unknown as SupabaseClient, appels };
}

function trade(i: number) {
  const jour = String((i % 27) + 1).padStart(2, "0");
  return {
    open_time: `2026-03-${jour}T09:00:00.000Z`,
    close_time: `2026-03-${jour}T10:00:00.000Z`,
    pair: "EURUSD",
    direction: "long",
    lot_size: 1,
    pnl: i % 3 === 0 ? -50 : 30,
    commission: 0,
    swap: 0,
    ict_setup: null,
    emotion: null,
    ict_confluence_score: null,
    challenge_id: null,
  };
}

describe("get_performance", () => {
  const PLAFOND = 1000;

  it("signale au modèle que sa lecture est coupée", async () => {
    const { client: c } = client({
      trades: Array.from({ length: PLAFOND }, (_, i) => trade(i)),
      prop_challenges: [],
    });
    const r = await executeCoachTool(c, USER, "get_performance", { dimension: "pair" }, "UTC");
    const res = r.result as { echantillon_tronque?: boolean; note: string };
    expect(res.echantillon_tronque, "l'échantillon coupé passe pour un bilan complet").toBe(true);
    expect(res.note, "rien n'avertit le modèle dans la note qu'il lit").toContain("coupée");
  });

  it("ne crie pas au loup sur un journal entier", async () => {
    const { client: c } = client({
      trades: Array.from({ length: PLAFOND - 1 }, (_, i) => trade(i)),
      prop_challenges: [],
    });
    const res = (await executeCoachTool(c, USER, "get_performance", { dimension: "pair" }, "UTC")).result as {
      echantillon_tronque?: boolean; note: string;
    };
    expect(res.echantillon_tronque).toBeUndefined();
    expect(res.note).not.toContain("coupée");
  });
});

describe("read_projection", () => {
  /**
   * ⚠️⚠️ LE SENS DU TRI EST LE DÉFAUT LUI-MÊME. `ascending: true` + `limit`,
   * c'est garder les plus VIEUX trades ; le reste du code ne peut plus rien y
   * faire, la base a déjà jeté les autres.
   */
  it("lit les trades les plus récents, pas les plus anciens", async () => {
    const { client: c, appels } = client({
      trades: Array.from({ length: 12 }, (_, i) => trade(i)),
      prop_challenges: [],
      strategies: [],
    });
    await executeCoachTool(c, USER, "read_projection", {}, "UTC");

    const tris = appels.filter((a) => a.table === "trades" && a.method === "order");
    expect(tris.length, "la lecture des trades ne trie plus : la coupe devient arbitraire").toBeGreaterThan(0);
    const surLaDate = tris.filter((a) => a.args[0] === "open_time");
    expect(surLaDate.length).toBeGreaterThan(0);
    for (const a of surLaDate) {
      expect(
        (a.args[1] as { ascending?: boolean })?.ascending,
        "la lecture repart en ascendant : bornée, elle garde alors les PREMIERS " +
          "trades du journal et projette l'avenir du trader sur ses débuts",
      ).toBe(false);
    }
  });
});
