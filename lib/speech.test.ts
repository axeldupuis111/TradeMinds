import { describe, expect, it } from "vitest";
import { stripForSpeech, toBcp47 } from "./speech";

describe("toBcp47", () => {
  it("mappe les 4 langues du produit", () => {
    expect(toBcp47("fr")).toBe("fr-FR");
    expect(toBcp47("en")).toBe("en-US");
    expect(toBcp47("de")).toBe("de-DE");
    expect(toBcp47("es")).toBe("es-ES");
  });

  it("retombe sur l'anglais pour une langue inconnue", () => {
    expect(toBcp47("it")).toBe("en-US");
  });
});

describe("stripForSpeech", () => {
  it("retire le gras et l'italique plutôt que de les faire prononcer", () => {
    expect(stripForSpeech("Tes **3 trades** en *revenge* t'ont coûté 340 €")).toBe(
      "Tes 3 trades en revenge t'ont coûté 340 €",
    );
  });

  it("retire les puces et les titres en gardant les sauts de ligne", () => {
    // Les retours à la ligne sont conservés volontairement : la synthèse vocale
    // les rend par une pause, ce qui découpe l'énumération à l'oral.
    expect(stripForSpeech("## Bilan\n- premier point\n- second point")).toBe(
      "Bilan\npremier point\nsecond point",
    );
  });

  it("garde le libellé d'un lien, pas son URL", () => {
    expect(stripForSpeech("Voir [tes objectifs](/dashboard/goals) maintenant")).toBe(
      "Voir tes objectifs maintenant",
    );
  });

  it("supprime les blocs de code, illisibles à voix haute", () => {
    expect(stripForSpeech("Avant\n```js\nconst x = 1;\n```\nAprès")).toBe("Avant Après");
  });

  it("retire le code inline en gardant son contenu", () => {
    expect(stripForSpeech("La colonne `emotion` est vide")).toBe("La colonne emotion est vide");
  });

  it("rend une chaîne vide sur du markdown pur, pour ne rien prononcer", () => {
    expect(stripForSpeech("**  **")).toBe("");
  });
});
