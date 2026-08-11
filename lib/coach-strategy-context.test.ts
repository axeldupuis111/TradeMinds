import { describe, expect, it } from "vitest";
import {
  MAX_RAW_TEXT_CHARS,
  renderStrategyContext,
  type StrategyRow,
  type StrategyTagRow,
} from "./coach-strategy-context";

/**
 * Le bug : le client n'envoyait au coach qu'un résumé de cinq champs, sans
 * `raw_text`, la stratégie écrite par le trader lui-même. À la question
 * « explique-moi les étapes de ma stratégie », le coach n'avait donc rien à
 * lire et improvisait une méthode générique, contresens compris.
 *
 * L'invariant : ce que le trader a écrit doit arriver jusqu'au prompt, et être
 * présenté comme la source de vérité.
 */
describe("renderStrategyContext", () => {
  const base: StrategyRow = { name: "ICT London", pairs: ["XAUUSD"], sessions: ["London"] };

  it("fait remonter la stratégie écrite par le trader", () => {
    const raw = "1. J'attends le balayage d'une SSL sous le creux de Londres\n2. J'entre sur le FVG";
    const out = renderStrategyContext({ ...base, raw_text: raw });
    expect(out).toContain("balayage d'une SSL");
    expect(out).toContain("J'entre sur le FVG");
  });

  it("annonce le texte libre comme la source de vérité", () => {
    // Les champs structurés sont une lecture automatique : en cas d'écart,
    // c'est le trader qui a raison, pas le parseur.
    const out = renderStrategyContext({ ...base, raw_text: "ma méthode" });
    expect(out).toContain("source de vérité");
  });

  it("borne un texte trop long sans le supprimer", () => {
    const out = renderStrategyContext({ ...base, raw_text: "x".repeat(MAX_RAW_TEXT_CHARS + 5_000) });
    expect(out).toContain("[...]");
    expect(out.length).toBeLessThan(MAX_RAW_TEXT_CHARS + 1_000);
  });

  it("rend les règles chiffrées en une ligne lisible", () => {
    const out = renderStrategyContext({
      ...base,
      risk_reward: 2,
      max_sl_pips: 15,
      max_trades_per_day: 3,
      risk_per_trade_pct: 1,
    });
    expect(out).toContain("RR minimum 2");
    expect(out).toContain("SL max 15 pips");
    expect(out).toContain("3 trades/jour max");
    expect(out).toContain("risque 1 % par trade");
  });

  it("reprend le vocabulaire du trader, groupé par type", () => {
    const tags: StrategyTagRow[] = [
      { tag_type: "setup", label_fr: "Sweep + FVG", sort_order: 0 },
      { tag_type: "setup", label_fr: "Breaker", sort_order: 1 },
      { tag_type: "entry_zone", label_fr: "FVG H1", sort_order: 0 },
      { tag_type: "checklist", label_fr: "Tendance H1 validée", sort_order: 0 },
    ];
    const out = renderStrategyContext(base, tags);
    expect(out).toContain("Setups : Sweep + FVG, Breaker");
    expect(out).toContain("Zones d'entrée : FVG H1");
    expect(out).toContain("Checklist pré-trade : Tendance H1 validée");
  });

  it("ignore un type de tag inconnu au lieu de le rendre en vrac", () => {
    const out = renderStrategyContext(base, [{ tag_type: "inconnu", label_fr: "n'importe quoi" }]);
    expect(out).not.toContain("n'importe quoi");
  });

  it("retombe sur le libellé anglais puis la valeur brute", () => {
    const out = renderStrategyContext(base, [
      { tag_type: "setup", label_en: "Liquidity sweep" },
      { tag_type: "target", value: "previous_high" },
    ]);
    expect(out).toContain("Liquidity sweep");
    expect(out).toContain("previous_high");
  });

  it("ne rend rien quand il n'y a pas de stratégie", () => {
    // L'appelant doit pouvoir dire « ta fiche est vide » plutôt que de
    // présenter un squelette que le coach prendrait pour une stratégie pauvre.
    expect(renderStrategyContext(null)).toBe("");
  });

  it("n'invente aucune ligne pour un champ absent", () => {
    const out = renderStrategyContext({ name: "Scalp" });
    expect(out).toBe("Nom : Scalp");
  });

  it("ignore les entrées vides des listes", () => {
    const out = renderStrategyContext({ ...base, setup_rules: ["", "   ", "RR mini 2"] });
    expect(out).toContain("Règles de setup : RR mini 2");
  });
});
