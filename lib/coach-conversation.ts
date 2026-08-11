/**
 * Bornage de la conversation envoyée au modèle.
 *
 * Le garde-fou d'origine rejetait la requête entière dès qu'UN message dépassait
 * 4 000 caractères. Écrit pour borner ce que le trader tape, il s'appliquait en
 * réalité à tout l'historique renvoyé, réponses du coach comprises. Or le coach
 * dépasse allègrement 4 000 caractères dès qu'il rédige une stratégie complète :
 * sa propre réponse rendait donc la conversation définitivement inutilisable,
 * chaque message suivant repartant en 413. Cul-de-sac total, sans autre issue
 * que d'effacer le fil.
 *
 * La règle est donc séparée en deux :
 *   - ce que le trader vient de taper reste borné, et un refus y est légitime ;
 *   - l'historique n'est JAMAIS un motif de refus, il est tronqué.
 *
 * Le budget total protège le coût : sans lui, dix longues réponses du coach
 * feraient dix fois le prix d'un tour de conversation ordinaire.
 */

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

/** Ce que le trader vient d'écrire. Au-delà, on refuse : c'est une saisie. */
export const MAX_MESSAGE_CHARS = 4000;
/** Un tour d'historique gardé intact (les réponses du coach sont longues). */
export const MAX_HISTORY_CHARS = 6000;
/** Budget total de l'historique, hors dernier message. */
export const MAX_HISTORY_TOTAL_CHARS = 24_000;
/** Marque laissée à la place du texte coupé, pour que le modèle le sache. */
export const TRUNCATION_MARK = "\n\n[...]";

/** Coupe en gardant le début : dans une réponse structurée, le plan y est. */
export function truncateTurn(content: string, max: number = MAX_HISTORY_CHARS): string {
  if (content.length <= max) return content;
  return content.slice(0, max - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/**
 * Borne l'historique sans jamais toucher au dernier message.
 *
 * Le dernier message est celui que le trader vient d'envoyer : il est validé
 * ailleurs (et refusé s'il est démesuré), jamais tronqué en silence, sinon le
 * coach répondrait à une question amputée.
 *
 * L'élagage retire les tours les plus ANCIENS en premier : c'est la fin de la
 * conversation qui porte le sujet en cours. Le dernier message survit toujours,
 * même seul.
 */
export function trimConversation(messages: CoachTurn[]): CoachTurn[] {
  if (messages.length === 0) return messages;

  const last = messages[messages.length - 1];
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role,
    content: truncateTurn(m.content),
  }));

  let total = history.reduce((sum, m) => sum + m.content.length, 0);
  let start = 0;
  while (start < history.length && total > MAX_HISTORY_TOTAL_CHARS) {
    total -= history[start].content.length;
    start++;
  }

  return [...history.slice(start), last];
}
