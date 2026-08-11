import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_CHARS,
  MAX_HISTORY_TOTAL_CHARS,
  MAX_MESSAGE_CHARS,
  TRUNCATION_MARK,
  trimConversation,
  truncateTurn,
  type CoachTurn,
} from "./coach-conversation";

/**
 * Le bug : le garde-fou de taille rejetait la requête entière dès qu'UN message
 * dépassait 4 000 caractères, historique compris. Le coach écrit largement plus
 * long dès qu'il rédige une stratégie complète : sa propre réponse condamnait
 * la conversation, chaque message suivant repartant en 413. L'invariant à tenir
 * est qu'un long message du coach ne doit JAMAIS bloquer la suite du fil.
 */
describe("trimConversation", () => {
  const user = (content: string): CoachTurn => ({ role: "user", content });
  const bot = (content: string): CoachTurn => ({ role: "assistant", content });
  const long = (n: number) => "x".repeat(n);

  it("laisse une conversation ordinaire intacte", () => {
    const messages = [user("salut"), bot("bonjour"), user("et ma stratégie ?")];
    expect(trimConversation(messages)).toEqual(messages);
  });

  it("ne bloque plus sur une longue réponse du coach", () => {
    // Le cas remonté : stratégie complète rédigée par le coach, puis question
    // de suivi. Avant, cette question partait en 413 et le fil était mort.
    const strategie = long(12_000);
    const out = trimConversation([user("détaille ma stratégie"), bot(strategie), user("et la tendance ?")]);
    expect(out).toHaveLength(3);
    expect(out[2].content).toBe("et la tendance ?");
    expect(out[1].content.length).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
  });

  it("marque le texte coupé pour que le modèle sache qu'il en manque", () => {
    const out = trimConversation([bot(long(12_000)), user("suite ?")]);
    expect(out[0].content.endsWith(TRUNCATION_MARK)).toBe(true);
  });

  it("ne touche jamais au dernier message", () => {
    // Il vient d'être validé contre MAX_MESSAGE_CHARS : le tronquer ferait
    // répondre le coach à une question amputée, sans que personne le voie.
    const question = long(MAX_MESSAGE_CHARS);
    const out = trimConversation([bot(long(12_000)), user(question)]);
    expect(out[out.length - 1].content).toBe(question);
  });

  it("garde le dernier message même seul", () => {
    const out = trimConversation([user("bonjour")]);
    expect(out).toEqual([user("bonjour")]);
  });

  it("tient le budget total de l'historique", () => {
    const messages = [...Array(9)].map(() => bot(long(MAX_HISTORY_CHARS)));
    const out = trimConversation([...messages, user("et maintenant ?")]);
    const historyChars = out.slice(0, -1).reduce((n, m) => n + m.content.length, 0);
    expect(historyChars).toBeLessThanOrEqual(MAX_HISTORY_TOTAL_CHARS);
  });

  it("sacrifie les tours les plus anciens, pas les plus récents", () => {
    // C'est la fin de la conversation qui porte le sujet en cours. Cinq tours
    // pleins dépassent le budget, quatre le remplissent pile : il faut donc
    // cinq pour que l'élagage se déclenche réellement.
    const out = trimConversation([
      bot("le plus ancien" + long(MAX_HISTORY_CHARS)),
      bot("deuxième" + long(MAX_HISTORY_CHARS)),
      bot("troisième" + long(MAX_HISTORY_CHARS)),
      bot("quatrième" + long(MAX_HISTORY_CHARS)),
      bot("juste avant ma question" + long(MAX_HISTORY_CHARS)),
      user("alors ?"),
    ]);
    expect(out.some((m) => m.content.startsWith("le plus ancien"))).toBe(false);
    expect(out[out.length - 2].content.startsWith("juste avant ma question")).toBe(true);
  });

  it("ne garde que ce qui tient dans le budget, dernier message exclu", () => {
    const out = trimConversation([
      ...[...Array(5)].map(() => bot(long(MAX_HISTORY_CHARS))),
      user("alors ?"),
    ]);
    // 5 tours pleins = 30 000 caractères, budget 24 000 : le plus ancien saute.
    expect(out).toHaveLength(5);
  });

  it("ne renvoie rien de plus que ce qu'on lui donne", () => {
    expect(trimConversation([])).toEqual([]);
  });

  it("preserve les rôles", () => {
    const out = trimConversation([user(long(9_000)), bot(long(9_000)), user("ok ?")]);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});

describe("truncateTurn", () => {
  it("laisse passer ce qui tient dans la limite", () => {
    expect(truncateTurn("court", 100)).toBe("court");
  });

  it("respecte exactement la limite, marque comprise", () => {
    const out = truncateTurn("x".repeat(500), 100);
    expect(out.length).toBe(100);
  });

  it("garde le début, où se trouve le plan d'une réponse structurée", () => {
    const out = truncateTurn("PLAN D'ACTION" + "x".repeat(9_000), 200);
    expect(out.startsWith("PLAN D'ACTION")).toBe(true);
  });
});
