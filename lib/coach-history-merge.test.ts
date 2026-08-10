import { describe, expect, it } from "vitest";
import { mergeCoachHistory, type ChatMessage } from "./hooks/useCoachChat";

/**
 * Le bug : le dock du coach vit dans le layout du dashboard, donc il reste
 * monté d'une page à l'autre et gardait la conversation figée à son premier
 * rendu. Pendant ce temps la page Analyse écrivait dans la MÊME table. On
 * parlait au coach en grand écran, il créait une stratégie, on revenait, et le
 * raccourci affichait encore l'état d'avant.
 *
 * La relecture répare ça, mais la base ne stocke que le rôle et le texte : tout
 * l'invariant est de rattraper le fil sans faire disparaître ce qui n'existe
 * qu'en mémoire (chips d'action, demandes de confirmation, erreurs).
 */
describe("mergeCoachHistory", () => {
  const user = (content: string): ChatMessage => ({ role: "user", content });
  const bot = (content: string): ChatMessage => ({ role: "assistant", content });

  it("adopte les messages dits sur l'autre surface", () => {
    const local = [user("salut"), bot("bonjour")];
    const remote = [user("salut"), bot("bonjour"), user("fais-moi une stratégie"), bot("c'est fait")];
    expect(mergeCoachHistory(local, remote).map((m) => m.content)).toEqual([
      "salut", "bonjour", "fais-moi une stratégie", "c'est fait",
    ]);
  });

  it("garde les chips d'action des messages déjà connus", () => {
    const withChip: ChatMessage = {
      role: "assistant",
      content: "c'est fait",
      actions: [{ action: { type: "strategy_created" } }],
    };
    const local = [user("crée ma stratégie"), withChip];
    const remote = [user("crée ma stratégie"), bot("c'est fait"), user("merci"), bot("de rien")];

    const merged = mergeCoachHistory(local, remote);
    expect(merged[1].actions).toHaveLength(1);
    expect(merged[1].actions?.[0].action.type).toBe("strategy_created");
    expect(merged).toHaveLength(4);
  });

  it("garde une demande de confirmation en attente", () => {
    const pending: ChatMessage = {
      role: "assistant",
      content: "je supprime ces 2 trades ?",
      confirms: [{ confirm: { op: "delete_trades" }, state: "idle" }],
    };
    const merged = mergeCoachHistory([user("nettoie"), pending], [user("nettoie"), bot("je supprime ces 2 trades ?")]);
    expect(merged[1].confirms?.[0].state).toBe("idle");
  });

  it("ne recolle pas un chip sur un message différent", () => {
    // Décalage possible si la base porte une conversation qu'on n'a pas vue :
    // recoller à l'aveugle mettrait « stratégie créée » sous une autre réponse.
    const withChip: ChatMessage = {
      role: "assistant",
      content: "c'est fait",
      actions: [{ action: { type: "strategy_created" } }],
    };
    const merged = mergeCoachHistory([user("a"), withChip], [user("b"), bot("autre chose")]);
    expect(merged[1].actions).toBeUndefined();
  });

  it("conserve un message local jamais persisté (erreur réseau)", () => {
    // Le message d'erreur n'est pas écrit en base : sans ce cas, relire la
    // conversation effacerait sous les yeux du trader l'erreur qu'il lit.
    const local = [user("salut"), bot("bonjour"), user("et ça ?"), bot("Erreur : réseau indisponible")];
    const remote = [user("salut"), bot("bonjour")];
    const merged = mergeCoachHistory(local, remote);
    expect(merged).toHaveLength(4);
    expect(merged[3].content).toContain("Erreur");
  });

  it("ne touche à rien quand la base n'a rien pour aujourd'hui", () => {
    // Cas du mode démo, où aucune ligne n'est persistée.
    const local = [user("salut"), bot("bonjour")];
    expect(mergeCoachHistory(local, [])).toBe(local);
  });

  it("part de la base quand la mémoire est vide", () => {
    const remote = [user("salut"), bot("bonjour")];
    expect(mergeCoachHistory([], remote)).toEqual(remote);
  });

  it("est stable si rien n'a changé ailleurs", () => {
    const local = [user("salut"), bot("bonjour")];
    const remote = [user("salut"), bot("bonjour")];
    expect(mergeCoachHistory(local, remote).map((m) => m.content)).toEqual(["salut", "bonjour"]);
  });
});
