import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";
import { computeTradeStats, deviseUniqueDuSeau, type InsightTrade } from "./analysis-insights";

/**
 * UNE PERFORMANCE PAR SEGMENT N'ADDITIONNE PAS DEUX MONNAIES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'OUTIL `get_performance` DU COACH ADDITIONNAIT DES EUROS ET DES DOLLARS.
 * Trouvé en le REJOUANT sur un compte réel le 2026-09-17 : « XAUUSD : 78
 * trades, net -7 162 » pour des lignes qui valent -6 619,77 € et -449,36 $. Ce
 * nombre n'est aucune somme d'argent.
 *
 * ⚠️ ET L'OUTIL VOISIN L'INTERDISAIT DÉJÀ, dix lignes plus haut :
 * `get_journal_summary` ventile par devise et attache la note « ne les
 * additionne jamais entre elles ». La règle était écrite, appliquée à un outil
 * sur deux — et celui qui ne l'appliquait pas ne lisait même pas
 * `challenge_id`, donc ne pouvait pas connaître la devise d'un trade.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Chaque segment porte `net_pnl_par_devise`. Le total unique `net_pnl` n'existe
 * que si le segment tient dans une seule devise.
 */

const RACINE = process.cwd();
const USER = "11111111-1111-4111-8111-111111111111";
const CPT_EUR = "22222222-2222-4222-8222-222222222222";
const CPT_USD = "33333333-3333-4333-8333-333333333333";

/**
 * Client simulé : comptes puis trades, comme l'outil les lit.
 *
 * ⚠️⚠️ IL NE REND QUE LES COLONNES DEMANDÉES. Un mock qui ignore le `select()`
 * CERTIFIE une requête cassée : sans ça, retirer `challenge_id` de la lecture
 * laissait ces tests tout verts alors que l'outil ne pouvait plus connaître la
 * devise d'un seul trade. Ce piège a déjà été payé ailleurs dans ce dépôt.
 */
function client(comptes: unknown[], trades: unknown[]): SupabaseClient {
  const builder: Record<string, unknown> = {};
  let table = "";
  let colonnes: string[] | null = null;
  for (const m of ["eq", "gte", "lt", "in", "order", "limit", "range"]) {
    builder[m] = () => builder;
  }
  builder.select = (cols?: string) => {
    colonnes = typeof cols === "string" && cols !== "*" ? cols.split(",").map((c) => c.trim()) : null;
    return builder;
  };
  builder.then = (resolve: (v: unknown) => unknown) => {
    const brut = (table === "prop_challenges" ? comptes : trades) as Record<string, unknown>[];
    const data = colonnes
      ? brut.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => colonnes!.includes(k))))
      : brut;
    return resolve({ data, error: null });
  };
  return {
    from: vi.fn((t: string) => {
      table = t;
      colonnes = null;
      return builder;
    }),
  } as unknown as SupabaseClient;
}

function trade(challengeId: string, pnl: number): Record<string, unknown> {
  return {
    open_time: "2026-09-01T09:00:00Z",
    close_time: "2026-09-01T10:00:00Z",
    pair: "XAUUSD",
    direction: "long",
    lot_size: 1,
    pnl,
    commission: 0,
    swap: 0,
    challenge_id: challengeId,
  };
}

const COMPTES = [
  { id: CPT_EUR, currency: "EUR", synced_currency: null },
  { id: CPT_USD, currency: "USD", synced_currency: null },
];

describe("get_performance", () => {
  it("ventile un segment qui mêle deux devises", async () => {
    const c = client(COMPTES, [trade(CPT_EUR, -100), trade(CPT_USD, -50)]);
    const r = await executeCoachTool(c, USER, "get_performance", { dimension: "pair" }, "UTC");
    const res = r.result as { segments: Record<string, unknown>[]; devise_unique: string | null; note: string };
    const seg = res.segments[0];

    expect(seg.net_pnl_par_devise).toEqual({ EUR: -100, USD: -50 });
    expect(
      seg.net_pnl,
      "un total unique est de nouveau annoncé sur un segment qui mêle deux devises",
    ).toBeUndefined();
    expect(res.devise_unique).toBeNull();
    expect(res.note, "rien n'avertit le modèle").toContain("plusieurs devises");
  });

  it("garde un total unique quand il n'y a qu'une devise", async () => {
    const c = client(COMPTES, [trade(CPT_EUR, -100), trade(CPT_EUR, 40)]);
    const r = await executeCoachTool(c, USER, "get_performance", { dimension: "pair" }, "UTC");
    const res = r.result as { segments: Record<string, unknown>[]; devise_unique: string | null; note: string };
    expect(res.segments[0].net_pnl).toBe(-60);
    expect(res.segments[0].devise).toBe("EUR");
    expect(res.devise_unique).toBe("EUR");
    expect(res.note, "l'avertissement s'affiche alors qu'il n'y a rien à mêler").not.toContain(
      "plusieurs devises",
    );
  });

  /** ⚠️ Sans `challenge_id`, l'outil ne PEUT PAS connaître la devise d'un trade. */
  it("lit la colonne qui porte le compte", () => {
    const src = readFileSync(join(RACINE, "lib/coach-tools.ts"), "utf8");
    const i = src.indexOf('case "get_performance"');
    const bloc = src.slice(i, src.indexOf("case \"get_macro_briefing\"", i));
    expect(bloc, "l'outil ne lit plus le compte de chaque trade").toContain("challenge_id");
  });
});

describe("les seaux de statistiques", () => {
  it("retiennent le net par devise", () => {
    const rows: InsightTrade[] = [
      { ...trade(CPT_EUR, -100), devise: "EUR" } as unknown as InsightTrade,
      { ...trade(CPT_USD, -50), devise: "USD" } as unknown as InsightTrade,
    ];
    const stats = computeTradeStats(rows, "UTC");
    const seau = stats.byPair["XAUUSD"];
    expect(seau.netParDevise).toEqual({ EUR: -100, USD: -50 });
    expect(deviseUniqueDuSeau(seau), "un seau mêlé désigne quand même une devise").toBeNull();
  });

  it("désignent la devise quand il n'y en a qu'une", () => {
    const rows: InsightTrade[] = [{ ...trade(CPT_EUR, -100), devise: "EUR" } as unknown as InsightTrade];
    expect(deviseUniqueDuSeau(computeTradeStats(rows, "UTC").byPair["XAUUSD"])).toBe("EUR");
  });

  /** ⚠️ Et sans devise renseignée, rien ne change : c'est le cas courant. */
  it("ne cassent rien quand la devise est absente", () => {
    const rows: InsightTrade[] = [trade(CPT_EUR, -100) as unknown as InsightTrade];
    const seau = computeTradeStats(rows, "UTC").byPair["XAUUSD"];
    expect(seau.netPnl).toBe(-100);
    expect(deviseUniqueDuSeau(seau)).toBeNull();
  });
});

describe("le bloc de statistiques envoyé au modèle", () => {
  /**
   * ⚠️ ON NE RECOMPOSE PAS LE BLOC PAR DEVISE : il porte aussi des moyennes, un
   * profit factor et une espérance, qui n'ont pas de sens ventilés sur de
   * petits effectifs. On DIT au modèle que ces totaux ne sont pas des montants.
   */
  it("avertit quand les devises se mêlent", () => {
    const src = readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8");
    expect(src, "le bloc de statistiques ne dit plus quand ses totaux ne sont pas des montants")
      .toContain("CE JOURNAL MÊLE PLUSIEURS DEVISES");
    // Et l'avertissement est conditionné, sinon il crierait sur tout le monde.
    const i = src.indexOf("const statsBlock");
    expect(src.slice(i, i + 400)).toContain("devisesMelangees");
  });
});
