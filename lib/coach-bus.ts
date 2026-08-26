/**
 * OUVRIR LE COACH DEPUIS N'IMPORTE QUELLE PAGE, AVEC UNE QUESTION DÉJÀ ÉCRITE.
 *
 * ── POURQUOI UN ÉVÉNEMENT ET PAS UN CONTEXTE REACT ──────────────────────────
 *
 * Le dock du coach vit dans le layout et ne se démonte jamais ; son état
 * « ouvert » lui appartient. Le remonter dans un contexte partagé pour que
 * trois pages puissent l'ouvrir toucherait la plomberie de TOUTES les pages,
 * pour un besoin qui se résume à « pousse cette phrase et ouvre-toi ».
 *
 * Un événement de fenêtre fait exactement ça, sans que personne n'ait à
 * connaître l'implémentation du dock. Le prix à payer est qu'il n'est pas typé
 * par le compilateur : d'où ce fichier, qui est le SEUL endroit où le nom de
 * l'événement et la forme de sa charge sont écrits.
 *
 * ⚠️ LE CLIC ENVOIE, IL NE PRÉ-REMPLIT PLUS.
 *
 * Première version : la question arrivait dans le champ de saisie et le trader
 * devait appuyer lui-même, pour ne pas consommer son quota sans son accord.
 * L'intention était bonne et le résultat mauvais. Axel l'a dit en une phrase en
 * regardant l'écran : « pas de message du coach, rien ». On appelait ça « le
 * coach parle le premier » et le coach ne parlait pas.
 *
 * C'était deux clics pour une seule intention, et dans le moment chaud où
 * l'alerte se déclenche, le second ne serait jamais venu.
 *
 * ⚠️ LE CONSENTEMENT N'EST PAS PERDU POUR AUTANT, il est déplacé au bon endroit :
 * rien ne part tant que le trader n'a pas cliqué « En parler au coach ». Ce clic
 * EST sa demande. Ce qu'on refuse toujours, c'est qu'un message parte sans qu'il
 * ait rien demandé, et l'alerte elle-même reste gratuite : aucun appel modèle
 * tant que personne ne clique.
 */

/** Nom de l'événement. Écrit ici et nulle part ailleurs. */
export const EVENEMENT_COACH = "td:coach:demander";

export interface DemandeCoach {
  /** La question, déjà traduite, envoyée au coach. */
  question: string;
}

/**
 * Ouvre le dock du coach et lui pose la question.
 *
 * Sans effet côté serveur : si le dock n'est pas monté (rendu serveur, page qui
 * le masque), l'événement se perd silencieusement, ce qui est le comportement
 * voulu. Une page ne doit jamais dépendre de la présence du dock.
 */
export function demanderAuCoach(question: string): void {
  if (typeof window === "undefined") return;
  const texte = question.trim();
  if (!texte) return;
  window.dispatchEvent(new CustomEvent<DemandeCoach>(EVENEMENT_COACH, { detail: { question: texte } }));
}

/**
 * S'abonne aux demandes. Rend la fonction de désabonnement.
 *
 * Utilisé par le dock uniquement ; exposé ici pour que le nom de l'événement
 * n'ait qu'une seule source.
 */
export function ecouterDemandesCoach(quand: (d: DemandeCoach) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<DemandeCoach>).detail;
    if (detail?.question) quand(detail);
  };
  window.addEventListener(EVENEMENT_COACH, handler);
  return () => window.removeEventListener(EVENEMENT_COACH, handler);
}
