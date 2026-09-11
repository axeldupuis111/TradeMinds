"use client";

import { useEffect } from "react";

/**
 * ÉCHAP FERME LA FENÊTRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VINGT-TROIS DES VINGT-HUIT FENÊTRES DU PRODUIT NE RÉPONDAIENT PAS À
 * ÉCHAP. Cinq le faisaient, chacune avec son propre `useEffect` recopié : la
 * palette de commandes, la création de défi, le panneau de membres, l'annotation
 * rapide, et deux filtres de page. La convention était donc bien établie — et
 * appliquée une fois sur six.
 *
 * ⚠️ CE N'EST PAS UN CONFORT. Une fenêtre qui recouvre la page et qu'on ne peut
 * fermer qu'en visant une petite croix à la souris enferme qui navigue au
 * clavier : le bouton de fermeture peut être hors champ, et rien d'autre ne
 * répond.
 *
 * ── LA FORME ────────────────────────────────────────────────────────────────
 *
 * ⚠️ `actif` PLUTÔT QU'UN MONTAGE CONDITIONNEL : plusieurs pages ouvrent DEUX
 * fenêtres différentes (la séance, la fiche stratégie). Un écouteur posé sans
 * condition les fermerait toutes les deux, ou fermerait la mauvaise. Ici chaque
 * fenêtre déclare quand elle écoute.
 */

/** Une cible d'événements : le document du navigateur, ou un double de test. */
export interface CibleClavier {
  addEventListener(type: "keydown", h: (e: KeyboardEvent) => void, capture: boolean): void;
  removeEventListener(type: "keydown", h: (e: KeyboardEvent) => void, capture: boolean): void;
}

/**
 * Branche Échap sur une cible et rend de quoi le débrancher.
 *
 * ⚠️ SÉPARÉE DU HOOK POUR ÊTRE TESTABLE : ce dépôt n'a ni jsdom ni bibliothèque
 * de rendu, donc un hook ne se teste pas. Sans cette fonction, on ne pourrait
 * vérifier que la PRÉSENCE des appels, jamais qu'appuyer sur Échap ferme
 * vraiment quelque chose — vingt-huit fenêtres pourraient appeler une fonction
 * vide et tous les tests resteraient verts.
 *
 * ⚠️ EN PHASE DE CAPTURE, pour passer AVANT un champ de saisie qui absorberait
 * la touche : une fenêtre de saisie est exactement le cas où Échap doit marcher.
 */
export function brancherEchap(cible: CibleClavier, fermer: () => void): () => void {
  const surTouche = (e: KeyboardEvent) => {
    if (e.key === "Escape") fermer();
  };
  cible.addEventListener("keydown", surTouche, true);
  return () => cible.removeEventListener("keydown", surTouche, true);
}

export function useEchap(actif: boolean, fermer: () => void) {
  useEffect(() => {
    if (!actif) return;
    return brancherEchap(document, fermer);
  }, [actif, fermer]);
}
