import { describe, expect, it } from "vitest";
import { computeCapitalLeaks } from "./analytics/leaks";
import { demoAccountRow, demoStrategyRow, generateDemoTrades } from "./demo-data";

const NOW = new Date("2026-07-03T12:00:00Z");

describe("generateDemoTrades", () => {
  it("génère un volume raisonnable de trades démo, tous clos et marqués", () => {
    const rows = generateDemoTrades(NOW);
    expect(rows.length).toBeGreaterThanOrEqual(40);
    expect(rows.length).toBeLessThanOrEqual(70);
    for (const r of rows) {
      expect(r.is_demo).toBe(true);
      expect(r.status).toBe("closed");
      // Garde-fou : la contrainte trades_direction_check n'accepte que ces deux
      // valeurs. La démo écrivait "buy"/"sell" et échouait donc systématiquement.
      expect(["long", "short"]).toContain(r.direction);
      expect(Number.isFinite(r.pnl)).toBe(true);
      expect(Number.isFinite(r.entry_price)).toBe(true);
      expect(new Date(r.close_time).getTime()).toBeGreaterThan(new Date(r.open_time).getTime());
    }
  });

  it("est déterministe (même seed → même démo)", () => {
    expect(generateDemoTrades(NOW)).toEqual(generateDemoTrades(NOW));
  });

  it("reste dans le passé récent (≤ 45 jours, jamais dans le futur)", () => {
    const rows = generateDemoTrades(NOW);
    const min = NOW.getTime() - 45 * 86400000;
    for (const r of rows) {
      const t = new Date(r.open_time).getTime();
      expect(t).toBeGreaterThan(min);
      expect(t).toBeLessThan(NOW.getTime());
    }
  });

  it("ne trade jamais le week-end", () => {
    for (const r of generateDemoTrades(NOW)) {
      const day = new Date(r.open_time).getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("raconte une histoire de discipline imparfaite : CapitalLeaks a du grain à moudre", () => {
    const rows = generateDemoTrades(NOW);
    const res = computeCapitalLeaks(rows, { maxTradesPerDay: null });
    expect(res.totalRecoverable).toBeGreaterThan(100);
    const types = res.leaks.map((l) => l.type);
    expect(types).toContain("revenge");
    expect(types).toContain("emotional");
    expect(res.leaks.length).toBeGreaterThanOrEqual(3);
  });

  it("reste globalement crédible : winrate entre 40 et 70 %", () => {
    const rows = generateDemoTrades(NOW);
    const wins = rows.filter((r) => r.pnl > 0).length;
    const wr = wins / rows.length;
    expect(wr).toBeGreaterThan(0.4);
    expect(wr).toBeLessThan(0.7);
  });
});

/**
 * Ces valeurs sont contraintes par des CHECK en base que le code TypeScript ne
 * peut pas voir. Deux échecs d'affilée le 2026-07-30 (trades_direction_check
 * puis prop_challenges_market_type_check) : on les verrouille ici plutôt que de
 * les redécouvrir en production.
 */
describe("lignes démo et contraintes de la base", () => {
  it("le compte démo respecte les énumérations de prop_challenges", () => {
    const a = demoAccountRow("00000000-0000-0000-0000-000000000000");
    expect(["cfd", "futures"]).toContain(a.market_type);
    expect(["prop", "personal"]).toContain(a.type);
    expect(["active", "passed", "failed"]).toContain(a.status);
    expect(a.is_demo).toBe(true);
    // start_date doit être une date seule (colonne date, pas timestamp).
    expect(a.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("la stratégie démo fournit les champs obligatoires et est marquée", () => {
    const st = demoStrategyRow("00000000-0000-0000-0000-000000000000");
    expect(st.is_demo).toBe(true);
    expect(st.user_id).toBeTruthy();
    expect(st.name).toBeTruthy();
    expect(st.pairs.length).toBeGreaterThan(0);
    expect(st.pretrade_checklist.length).toBeGreaterThan(0);
  });

  it("remplit les colonnes text[] avec des tableaux, jamais des phrases", () => {
    // Postgres rejette une chaîne dans une colonne text[] (« malformed array
    // literal ») : troisième echec du 2026-07-30, sur setup_rules.
    const st = demoStrategyRow("u") as unknown as Record<string, unknown>;
    for (const col of ["pairs", "sessions", "setup_rules", "pretrade_checklist"]) {
      expect(Array.isArray(st[col])).toBe(true);
      expect((st[col] as unknown[]).every((v) => typeof v === "string")).toBe(true);
    }
    // raw_text, elle, est bien une colonne texte.
    expect(typeof st.raw_text).toBe("string");
  });

  it("les paires de la démo sont couvertes par la stratégie démo", () => {
    // Sinon l'analyse démo signalerait « paire non autorisée » sur des trades
    // que la démo a elle-même générés.
    const st = demoStrategyRow("u");
    const pairs = Array.from(
      new Set(generateDemoTrades(new Date("2026-07-30T12:00:00Z")).map((t) => t.pair))
    );
    for (const p of pairs) expect(st.pairs).toContain(p);
  });
});
