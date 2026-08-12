import { describe, expect, it } from "vitest";
import { freeMessagesRemaining, type ChatMessage } from "./hooks/useCoachChat";
import { FREE_LIFETIME_CHAT_MESSAGES } from "./plan-limits";

/**
 * Le forfait découverte se compte sur `chat_messages`, où chaque échange écrit
 * DEUX lignes : la question et la réponse. Compter les lignes brutes
 * n'accorderait que la moitié du forfait annoncé — c'est le piège principal du
 * passage de 1 à 5 messages, et il est invisible tant qu'on ne compte pas.
 */
describe("freeMessagesRemaining", () => {
  const user = (n: number): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => ({ role: "user" as const, content: `q${i}` }));
  const echange = (n: number): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => [
      { role: "user" as const, content: `q${i}` },
      { role: "assistant" as const, content: `r${i}` },
    ]).flat();

  it("accorde le forfait entier à un nouvel inscrit", () => {
    expect(freeMessagesRemaining(0, [])).toBe(FREE_LIFETIME_CHAT_MESSAGES);
  });

  it("NE COMPTE PAS les réponses du coach", () => {
    // 3 échanges = 6 lignes en base, mais seulement 3 messages consommés.
    expect(freeMessagesRemaining(0, echange(3))).toBe(FREE_LIFETIME_CHAT_MESSAGES - 3);
  });

  it("épuise le forfait au bon nombre d'échanges, pas à la moitié", () => {
    expect(freeMessagesRemaining(0, echange(FREE_LIFETIME_CHAT_MESSAGES))).toBe(0);
    expect(freeMessagesRemaining(0, echange(FREE_LIFETIME_CHAT_MESSAGES - 1))).toBe(1);
  });

  it("additionne l'historique d'avant aujourd'hui et le fil courant", () => {
    // 2 messages les jours précédents + 1 aujourd'hui = 3 consommés.
    expect(freeMessagesRemaining(2, echange(1))).toBe(FREE_LIFETIME_CHAT_MESSAGES - 3);
  });

  it("compte le message envoyé à l'instant, pas encore persisté", () => {
    // Le client ajoute la question à `messages` AVANT la réponse : sans ça, le
    // compteur ne bougerait qu'au rechargement de la page.
    expect(freeMessagesRemaining(0, user(1))).toBe(FREE_LIFETIME_CHAT_MESSAGES - 1);
  });

  it("ne descend jamais sous zéro", () => {
    expect(freeMessagesRemaining(99, echange(3))).toBe(0);
  });
});
