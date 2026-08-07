import { describe, expect, it } from "vitest";
import { pairTimestamps } from "./hooks/useCoachChat";

/**
 * Le bug : question et réponse étaient insérées dans le même appel, donc avec
 * le même created_at. Au rechargement, l'ordre devenait arbitraire et la
 * réponse s'affichait au-dessus de sa question. L'invariant à tenir est
 * simple : la réponse est TOUJOURS strictement postérieure à la question.
 */
describe("pairTimestamps", () => {
  it("place la réponse après la question", () => {
    const { user, assistant } = pairTimestamps(1_700_000_000_000, 1_700_000_004_000);
    expect(new Date(assistant).getTime()).toBeGreaterThan(new Date(user).getTime());
  });

  it("garde l'écart réel quand la réponse a pris du temps", () => {
    const { user, assistant } = pairTimestamps(1_700_000_000_000, 1_700_000_012_500);
    expect(new Date(assistant).getTime() - new Date(user).getTime()).toBe(12_500);
  });

  it("force au moins 1 ms d'écart si la réponse est instantanée", () => {
    const t = 1_700_000_000_000;
    const { user, assistant } = pairTimestamps(t, t);
    expect(new Date(assistant).getTime()).toBe(new Date(user).getTime() + 1);
  });

  it("ne laisse jamais la réponse précéder la question, même si l'horloge recule", () => {
    // Une correction NTP ou un changement d'heure peut faire reculer Date.now().
    const t = 1_700_000_000_000;
    const { user, assistant } = pairTimestamps(t, t - 5_000);
    expect(new Date(assistant).getTime()).toBeGreaterThan(new Date(user).getTime());
  });

  it("rend des dates ISO exploitables par Postgres", () => {
    const { user, assistant } = pairTimestamps(1_700_000_000_000, 1_700_000_001_000);
    for (const iso of [user, assistant]) {
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
    }
  });
});

import { stripEmDashes } from "./hooks/useCoachChat";

/**
 * Le tiret long est proscrit dans la copy du produit. La consigne est dans le
 * prompt, mais une consigne reste probabiliste : le modèle en replaçait à
 * chaque réponse. On l'applique donc de façon déterministe.
 */
describe("stripEmDashes", () => {
  it("remplace un tiret long entre deux propositions par une virgule", () => {
    expect(stripEmDashes("Les 2 trades vont disparaître — clique sur Valider")).toBe(
      "Les 2 trades vont disparaître, clique sur Valider",
    );
  });

  it("traite aussi le tiret demi-cadratin", () => {
    expect(stripEmDashes("un point – puis un autre")).toBe("un point, puis un autre");
  });

  it("garde une puce lisible en tête de ligne", () => {
    expect(stripEmDashes("Bilan :\n— premier point\n— second point")).toBe(
      "Bilan :\n- premier point\n- second point",
    );
  });

  it("gère un tiret collé au texte", () => {
    expect(stripEmDashes("gain—perte")).toBe("gain, perte");
  });

  it("ne double jamais la ponctuation", () => {
    expect(stripEmDashes("attention, — surtout le matin")).toBe("attention, surtout le matin");
  });

  it("laisse intact un texte qui n'en contient pas", () => {
    const propre = "Tes 3 trades du matin t'ont coûté 340 € : arrête avant 9h.";
    expect(stripEmDashes(propre)).toBe(propre);
  });

  it("préserve le trait d'union des mots composés", () => {
    expect(stripEmDashes("un stop-loss bien placé")).toBe("un stop-loss bien placé");
  });
});
