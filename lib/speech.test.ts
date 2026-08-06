import { describe, expect, it } from "vitest";
import { pickVoice, splitIntoUtterances, stripForSpeech, toBcp47 } from "./speech";

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

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

  it("retire les émojis, que la synthèse décrirait à voix haute", () => {
    expect(stripForSpeech("Bien joué 👏 ton score monte 📈")).toBe("Bien joué ton score monte");
    expect(stripForSpeech("Salut ! 👋")).toBe("Salut !");
    expect(stripForSpeech("Attention ⚠️ au revenge trading")).toBe("Attention au revenge trading");
  });

  it("garde les caractères accentués et la ponctuation française", () => {
    expect(stripForSpeech("Résultat : -2 083 € — c'est net.")).toBe("Résultat : -2 083 € — c'est net.");
  });
});

describe("splitIntoUtterances", () => {
  it("découpe sur la ponctuation forte sans dépasser la limite", () => {
    const parts = splitIntoUtterances("Première phrase. Deuxième phrase ! Troisième ?", 30);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(30);
    expect(parts.join(" ")).toBe("Première phrase. Deuxième phrase ! Troisième ?");
  });

  it("regroupe les phrases courtes sous la limite", () => {
    expect(splitIntoUtterances("Un. Deux. Trois.", 200)).toEqual(["Un. Deux. Trois."]);
  });

  it("coupe une phrase trop longue sur la ponctuation faible, jamais en plein mot", () => {
    const long = "premier segment assez long, deuxième segment assez long, troisième segment assez long";
    const parts = splitIntoUtterances(long, 40);
    expect(parts.length).toBeGreaterThan(1);
    // Aucun mot coupé : recoller les morceaux doit redonner le texte d'origine,
    // et chaque morceau doit finir sur une frontière de mot ou de ponctuation.
    expect(parts.join(" ")).toBe(long);
    for (const p of parts) expect(p).toMatch(/[\wà-ÿ,;:.!?…]$/i);
  });

  it("ne rend aucun fragment vide", () => {
    expect(splitIntoUtterances("Texte.\n\n\nAutre texte.", 200).every((p) => p.trim().length > 0)).toBe(true);
  });
});

describe("pickVoice", () => {
  it("préfère une voix neuronale à une voix compacte", () => {
    const chosen = pickVoice(
      [voice("Thomas (compact)", "fr-FR"), voice("Microsoft Denise Natural", "fr-FR")],
      "fr",
    );
    expect(chosen?.name).toBe("Microsoft Denise Natural");
  });

  it("préfère Google à une voix historique", () => {
    const chosen = pickVoice([voice("eSpeak français", "fr-FR"), voice("Google français", "fr-FR", false)], "fr");
    expect(chosen?.name).toBe("Google français");
  });

  it("accepte une variante régionale quand la langue exacte manque", () => {
    expect(pickVoice([voice("Amélie", "fr-CA")], "fr")?.name).toBe("Amélie");
  });

  it("ignore les voix d'une autre langue", () => {
    expect(pickVoice([voice("Samantha", "en-US")], "fr")).toBeNull();
  });

  it("rend null quand aucune voix n'est disponible", () => {
    expect(pickVoice([], "fr")).toBeNull();
  });
});
