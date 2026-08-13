import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Test réel du 2026-08-13. Le trader a contredit le coach avec une affirmation
 * FAUSSE (« une BSL rejetée c'est un signal d'achat »). Le coach avait répondu
 * juste deux messages plus tôt ; il a répondu « Tu as raison, je me suis
 * trompé », inversé sa réponse, puis propagé l'inversion à la SSL.
 *
 * Le bloc anti-complaisance existait pourtant. Deux défauts :
 *
 * 1. Il disait « tiens ta position » sans donner d'ARBITRE. Sans procédure de
 *    vérification, « tiens ta position » et « corrige-toi si tu t'es trompé »
 *    se ressemblent, et le modèle prend le chemin poli.
 * 2. Il vivait au milieu d'un prompt système d'environ 7 000 tokens. La
 *    consigne qui doit vaincre un réflexe a besoin d'être en fin de prompt.
 *
 * Ces tests tiennent les deux propriétés. Ils lisent la source plutôt que
 * d'appeler le modèle : ils vérifient ce qu'on lui envoie, pas ce qu'il répond.
 */

const SOURCE = readFileSync(
  join(process.cwd(), "app", "api", "chat-coach", "route.ts"),
  "utf8",
);

/** Le gabarit du prompt système, du backtick ouvrant au backtick fermant. */
function promptSysteme(): string {
  const debut = SOURCE.indexOf("const systemPrompt = `");
  expect(debut, "le prompt système a été renommé").toBeGreaterThan(-1);
  const corps = SOURCE.slice(debut + "const systemPrompt = `".length);
  const fin = corps.indexOf("`;");
  expect(fin, "fin du gabarit introuvable").toBeGreaterThan(0);
  return corps.slice(0, fin);
}

describe("la règle qui doit vaincre un réflexe est en fin de prompt", () => {
  const prompt = promptSysteme();

  it("le prompt est bien celui qu'on croit (garde-fou du test)", () => {
    // Si l'extraction rate, tout le reste passerait à vide.
    expect(prompt.length).toBeGreaterThan(4000);
    expect(prompt).toContain("coach de trading");
  });

  it("le rappel anti-complaisance existe", () => {
    expect(prompt).toContain("DERNIER RAPPEL");
  });

  it("il est dans la dernière portion du prompt, pas au milieu", () => {
    const pos = prompt.indexOf("DERNIER RAPPEL");
    // Il doit tomber dans le dernier quart : c'est la position qui compte,
    // le contenu seul ne suffisait pas et c'est ce qui a échoué en test réel.
    expect(pos / prompt.length).toBeGreaterThan(0.75);
  });

  it("il donne un arbitre, pas seulement une exhortation", () => {
    const rappel = prompt.slice(prompt.indexOf("DERNIER RAPPEL"));
    // « relis le glossaire » est la partie opérante : elle transforme
    // « tiens bon » en une vérification que le modèle peut exécuter.
    expect(rappel).toMatch(/relis le glossaire/i);
    expect(rappel).toMatch(/maintiens/i);
  });

  it("la formule de capitulation est conditionnée, pas seulement interdite", () => {
    // On ne l'interdit pas sèchement : on dit QUAND elle est légitime. Une
    // interdiction pure de la phrase la rendrait impossible même quand le
    // coach s'est réellement trompé, ce qui serait un défaut symétrique.
    const rappel = prompt.slice(prompt.indexOf("DERNIER RAPPEL"));
    expect(rappel).toContain("je me suis trompé");
    expect(rappel).toMatch(/que si tu as vérifié/i);
  });
});

describe("le bloc de contradiction distingue la fiche du chat", () => {
  const prompt = promptSysteme();

  it("une phrase du chat n'a pas l'autorité de la fiche stratégie", () => {
    // La règle de précédence donne le dernier mot à la fiche du trader. Le
    // modèle l'a étendue à ce qu'il tape en conversation, ce qui rendait
    // n'importe quelle affirmation opposable au glossaire.
    const bloc = prompt.slice(prompt.indexOf("QUAND LE TRADER TE CONTREDIT"));
    expect(bloc).toMatch(/n'a PAS l'autorité de sa fiche/i);
  });

  it("l'inversion ne doit pas se propager aux termes voisins", () => {
    // Le coach avait inversé BSL puis, dans la foulée, SSL. Céder sur un point
    // ne doit pas réécrire toute la famille de définitions.
    const bloc = prompt.slice(prompt.indexOf("QUAND LE TRADER TE CONTREDIT"));
    expect(bloc).toMatch(/propages jamais l'inversion/i);
  });
});

describe("les chiffres sortis par le coach sont bornés", () => {
  it("il ne pose un calcul de taille que s'il peut le vérifier", () => {
    // Test réel : « move de 2500 → 2506 (6 pips) » sur XAUUSD (c'est 600), et
    // un calcul de lot incohérent. Un mauvais lot coûte de l'argent réel.
    const prompt = promptSysteme();
    expect(prompt).toContain("CHIFFRES");
    expect(prompt).toMatch(/pip d'or n'est pas un pip/i);
  });
});
