import { describe, expect, it } from "vitest";
import { costEur, sumUsage } from "./ai-cost-log";

describe("costEur", () => {
  it("facture l'entrée et la sortie au tarif du modèle", () => {
    // Haiku 4.5 : 1 $/M en entrée, 5 $/M en sortie → (1 + 5) / 1M $ ×0,92
    const c = costEur("claude-haiku-4-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(c).toBeCloseTo(6 * 0.92, 5);
  });

  it("applique 0,1x sur la lecture de cache et 1,25x sur l'écriture", () => {
    const lecture = costEur("claude-sonnet-5", { cache_read_input_tokens: 1_000_000 });
    const ecriture = costEur("claude-sonnet-5", { cache_creation_input_tokens: 1_000_000 });
    expect(lecture).toBeCloseTo(3 * 0.1 * 0.92, 5);
    expect(ecriture).toBeCloseTo(3 * 1.25 * 0.92, 5);
  });

  it("rend 0 sur un modèle inconnu plutôt qu'un faux coût", () => {
    expect(costEur("un-modele-jamais-vu", { input_tokens: 999_999 })).toBe(0);
  });

  it("tolère des compteurs absents ou nuls", () => {
    expect(costEur("claude-sonnet-5", {})).toBe(0);
    expect(costEur("claude-sonnet-5", { cache_read_input_tokens: null })).toBe(0);
  });

  it("chiffre un appel d'analyse réaliste après restructuration", () => {
    // ~12k tokens d'entrée (40 trades détaillés + stats) et ~5k de sortie
    const c = costEur("claude-sonnet-5", { input_tokens: 12_000, output_tokens: 5_000 });
    expect(c).toBeGreaterThan(0.08);
    expect(c).toBeLessThan(0.12);
  });
});

describe("sumUsage", () => {
  it("additionne les compteurs de plusieurs tours d'outils", () => {
    const total = sumUsage([
      { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 5_000 },
      { input_tokens: 20, output_tokens: 200, cache_creation_input_tokens: 800 },
    ]);
    expect(total).toEqual({
      input_tokens: 30,
      output_tokens: 300,
      cache_read_input_tokens: 5_000,
      cache_creation_input_tokens: 800,
    });
  });

  it("rend des zéros sur une liste vide", () => {
    expect(sumUsage([])).toEqual({});
  });
});
