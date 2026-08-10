/**
 * Mesure RÉELLE de la taille des prompts, via l'API count_tokens.
 *
 * Ce n'est pas un test de régression : c'est un instrument. Il sert à chiffrer
 * la rentabilité sur des tokens comptés par Anthropic, pas sur une estimation
 * en caractères / 4. Ignoré par défaut (il fait des appels réseau) ; à lancer
 * à la main avec : npx vitest run lib/measure-ai-cost.test.ts --mode=development
 */

import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { coachToolsForPlan, COACH_TOOLS } from "./coach-tools";

const KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const run = KEY ? describe : describe.skip;

const client = new Anthropic({ apiKey: KEY });

/** Compte les tokens d'une requête telle qu'elle partirait vraiment. */
async function count(params: {
  system?: string;
  tools?: unknown[];
  text: string;
  model?: string;
}): Promise<number> {
  const r = await client.messages.countTokens({
    model: (params.model ?? "claude-haiku-4-5") as never,
    system: params.system,
    tools: params.tools as never,
    messages: [{ role: "user", content: params.text }],
  });
  return r.input_tokens;
}

run("taille réelle des prompts", () => {
  it("mesure le catalogue d'outils du coach, par plan", async () => {
    const base = await count({ text: "x" });
    const rows: Record<string, number> = {};
    for (const plan of ["free", "plus", "premium"] as const) {
      const tools = coachToolsForPlan(plan);
      const withTools = await count({ tools, text: "x" });
      rows[plan] = withTools - base;
      console.log(`  outils ${plan.padEnd(8)} : ${tools.length} outils = ${rows[plan]} tokens`);
    }
    console.log(`  (catalogue complet : ${COACH_TOOLS.length} outils)`);
    expect(rows.premium).toBeGreaterThan(rows.plus);
  }, 60_000);

  it("mesure le prompt système du coach", async () => {
    // Portion statique du prompt système, extraite de la route telle quelle.
    const src = readFileSync("app/api/chat-coach/route.ts", "utf8");
    const start = src.indexOf("PONCTUATION :");
    const end = src.indexOf("TRADER STRATEGY:");
    const staticPrompt = src.slice(start, end);
    const n = await count({ system: staticPrompt, text: "x" });
    const base = await count({ text: "x" });
    console.log(`  prompt système statique : ${n - base} tokens`);
    expect(n).toBeGreaterThan(base);
  }, 60_000);

  it("mesure le prompt d'analyse pour des journaux de tailles différentes", async () => {
    // Journal synthetique : on veut la COURBE cout / nombre de trades, car
    // c'est le point qui a ete restructure (avant, elle explosait).
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        open_time: new Date(Date.UTC(2026, 6, 1 + (i % 28), 9 + (i % 8))).toISOString(),
        close_time: new Date(Date.UTC(2026, 6, 1 + (i % 28), 10 + (i % 8))).toISOString(),
        pair: ["XAUUSD", "EURUSD", "GBPUSD"][i % 3],
        direction: i % 2 ? "long" : "short",
        lot_size: 0.5, pnl: i % 3 ? 120 : -95, commission: -4, swap: 0,
        emotion: ["confident", "frustrated", "neutral"][i % 3],
        ict_setup: "liquidity_sweep", ict_confluence_score: 3, checklist_total: 5,
        notes: "Entree sur balayage de liquidite, retour vers le FVG H1.",
      }));

    for (const size of [30, 100, 500]) {
      const trades = mk(size);
      const { selectSignificantTrades, computeMechanicalViolations, renderMechanicalBlock } =
        await import("./analysis-selection");
      const strategy = { pairs: ["XAUUSD", "EURUSD"], sessions: ["london"], max_lot: 1, max_daily_trades: 3, max_sl_pips: 60, min_rr: 2 };
      const violations = computeMechanicalViolations(trades as never, strategy as never);
      const selected = selectSignificantTrades(trades as never, violations as never);
      const block = renderMechanicalBlock(violations as never, trades.length);
      const payload = `${block}\n${JSON.stringify(selected)}`;
      const n = await count({ text: payload, model: "claude-sonnet-5" });
      console.log(`  analyse ${String(size).padStart(3)} trades : ${n} tokens envoyes`);
    }
    expect(true).toBe(true);
  }, 120_000);

  it("mesure les instructions fixes de l'analyse et de la vision", async () => {
    const base = await count({ text: "x", model: "claude-sonnet-5" });
    for (const [label, file] of [
      ["analyse", "app/api/analyze/route.ts"],
      ["vision ", "app/api/analyze-trade-vision/route.ts"],
    ] as const) {
      const src = readFileSync(file, "utf8");
      // Les gabarits de prompt sont les litteraux template du fichier.
      const literals = Array.from(src.matchAll(/`([^`]{400,})`/g), (m) => m[1]).join("\n");
      const n = await count({ text: literals || "x", model: "claude-sonnet-5" });
      console.log(`  instructions ${label} : ${n - base} tokens fixes`);
    }
    expect(true).toBe(true);
  }, 60_000);
});
