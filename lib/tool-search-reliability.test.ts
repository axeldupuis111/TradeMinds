/**
 * VERDICT : chargement différé des outils ÉCARTÉ. Ne pas réessayer sans
 * relancer cette mesure d'abord.
 *
 * Le contexte : les 39 outils du coach pèsent 9 213 tokens envoyés à chaque
 * message, y compris pour « comment je vais ? ». Marquer les outils d'écriture
 * `defer_loading` et les faire retrouver par `tool_search_tool_regex` fait
 * tomber ce coût à 3 502 tokens, soit 62 % d'économie, mesurée sur un appel
 * réel (count_tokens refuse les outils serveur).
 *
 * Mesuré le 2026-08-10 sur claude-haiku-4-5, six demandes d'action réelles :
 *
 *   sans consigne dans le prompt système : 0 / 6 réussites
 *   avec une consigne explicite          : 3 / 6 réussites
 *
 * Et le mode d'échec est le pire imaginable : au lieu d'agir, le modèle
 * appelle `open_page` et renvoie le trader vers la page pour qu'il le fasse
 * lui-même. C'est exactement le comportement que le produit a éliminé et que
 * la landing promet d'avoir dépassé. 62 % d'économie ne valent pas la moitié
 * des actions perdues en silence.
 *
 * À rejouer si le coach change de modèle : un modèle plus fort pourrait
 * franchir la barre, et l'économie reste très intéressante.
 */

import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { coachToolsForPlan } from "./coach-tools";

const KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const run = KEY ? describe : describe.skip;
const client = new Anthropic({ apiKey: KEY });

const MODEL = "claude-haiku-4-5-20251001";
const ALWAYS = new Set(coachToolsForPlan("free").map((t) => t.name));
const SEARCH_TOOL = { type: "tool_search_tool_regex_20251119", name: "tool_search_tool_regex" };
const TOOLS = [
  SEARCH_TOOL,
  ...coachToolsForPlan("premium").map((t) => (ALWAYS.has(t.name) ? t : { ...t, defer_loading: true })),
];

/** Consigne qui dit au modèle que son catalogue est incomplet par défaut. */
const HINT =
  "Ton catalogue d'outils est chargé à la demande : seuls les outils de LECTURE sont " +
  "visibles d'emblée. Tous les outils d'ÉCRITURE (créer, modifier, annoter, supprimer, " +
  "lancer un rapport, gérer un compte ou un objectif) existent mais doivent être trouvés " +
  "avec tool_search_tool_regex avant d'être appelés. Si une demande exige d'agir et que " +
  "tu ne vois pas l'outil, CHERCHE-LE. Ne réponds jamais que tu ne peux pas agir sans " +
  "avoir cherché d'abord.";

/** Demandes réelles nécessitant chacune un outil différé. */
const CASES: { ask: string; want: string }[] = [
  { ask: "Annote mes trades perdants d'hier en frustration.", want: "annotate_trades" },
  { ask: "Crée-moi un objectif de discipline à 85 pour ce mois.", want: "create_goal" },
  { ask: "Ajoute un trade XAUUSD long 0.5 lot entré à 2650 sorti à 2665, +180 €.", want: "create_trade" },
  { ask: "Supprime le trade d'identifiant 11111111-1111-4111-8111-111111111111.", want: "delete_trades" },
  { ask: "Lance mon plan de la semaine.", want: "run_ai_report" },
  { ask: "Ouvre une session de trading, je suis confiant.", want: "start_session" },
];

async function reaches(ask: string, want: string, system?: string): Promise<string[]> {
  const msgs: Anthropic.MessageParam[] = [{ role: "user", content: ask }];
  const seen: string[] = [];
  for (let round = 0; round < 4; round++) {
    const r: Anthropic.Message = await client.messages.create({
      model: MODEL, max_tokens: 1200, tools: TOOLS as never,
      ...(system ? { system } : {}), messages: msgs,
    });
    const calls = r.content.filter((b) => b.type === "tool_use" || b.type === "server_tool_use");
    calls.forEach((b) => seen.push((b as { name: string }).name));
    if (seen.includes(want)) return seen;
    if (r.stop_reason !== "tool_use") return seen;
    const results = calls
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ type: "tool_result" as const, tool_use_id: (b as { id: string }).id, content: "OK, 2 résultats." }));
    if (results.length === 0) return seen;
    msgs.push({ role: "assistant", content: r.content });
    msgs.push({ role: "user", content: results });
  }
  return seen;
}

run("fiabilité du chargement différé", () => {
  it("mesure le taux de réussite, avec et sans consigne", async () => {
    for (const [label, sys] of [["SANS consigne", undefined], ["AVEC consigne", HINT]] as const) {
      let ok = 0;
      const fails: string[] = [];
      for (const c of CASES) {
        const seen = await reaches(c.ask, c.want, sys);
        if (seen.includes(c.want)) ok++;
        else fails.push(`${c.want} (a fait : ${seen.join("→") || "rien"})`);
      }
      console.log(`  ${label} : ${ok}/${CASES.length} réussites`);
      fails.forEach((f) => console.log(`      échec → ${f}`));
    }
    expect(true).toBe(true);
  }, 300_000);
});
