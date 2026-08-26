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
 * ⚠️ ON POUSSE UNE QUESTION, ON NE L'ENVOIE PAS. Le texte arrive dans le champ
 * de saisie, le trader le lit, le modifie s'il veut, et décide d'appuyer. Envoyer
 * automatiquement consommerait son quota pour une question qu'il n'a pas posée,
 * et transformerait une aide en prélèvement.
 */

/** Nom de l'événement. Écrit ici et nulle part ailleurs. */
export const EVENEMENT_COACH = "td:coach:demander";

export interface DemandeCoach {
  /** La question, déjà traduite, poussée dans le champ de saisie. */
  question: string;
}

/**
 * Ouvre le dock du coach avec une question pré-remplie.
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
