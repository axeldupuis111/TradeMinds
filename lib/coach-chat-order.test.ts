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
