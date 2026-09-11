"use client";

import { useEffect } from "react";

/**
 * CE QU'UNE FENÊTRE MODALE DOIT FAIRE AU CLAVIER : RECEVOIR LE FOCUS, PUIS LE
 * RENDRE, ET SE FERMER À ÉCHAP.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VINGT-TROIS DES VINGT-HUIT FENÊTRES NE RÉPONDAIENT PAS À ÉCHAP. Cinq le
 * faisaient, chacune avec son propre `useEffect` recopié. La convention était
 * établie, appliquée une fois sur six.
 *
 * ⚠️⚠️ ET AUCUNE NE DÉPLAÇAIT LE FOCUS. Tant que les fenêtres n'étaient que des
 * `<div>`, c'était une gêne. Depuis qu'elles portent `aria-modal="true"`, c'est
 * un piège : cet attribut dit à une lecture d'écran d'IGNORER tout le reste de
 * la page. Si le focus reste derrière la fenêtre, le lecteur se retrouve dans
 * le vide — plus rien à lire, et rien qui explique pourquoi. Poser `aria-modal`
 * sans déplacer le focus rend le produit MOINS utilisable qu'avant.
 *
 * ── CE QUE LE HOOK FAIT ─────────────────────────────────────────────────────
 *
 * ⚠️ IL VISE LA DERNIÈRE FENÊTRE OUVERTE, pas une référence passée par
 * l'appelant : vingt-huit composants n'auraient jamais tous posé le `ref` au
 * bon endroit, et une fenêtre qui en oublie un est exactement celle qui casse.
 * La dernière du document est celle qui vient de s'ouvrir.
 *
 * ⚠️ `actif` PLUTÔT QU'UN MONTAGE CONDITIONNEL : plusieurs pages montent DEUX
 * fenêtres dont une seule est ouverte (la séance, la fiche stratégie).
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

/**
 * Donne le focus à la dernière fenêtre ouverte et rend de quoi le remettre où
 * il était.
 *
 * ⚠️ ON RENVOIE LE FOCUS À LA FERMETURE, et c'est la moitié qui s'oublie : sans
 * ça, refermer une fenêtre repart du haut de la page, et le bouton qu'on venait
 * d'actionner est perdu.
 */
export function donnerLeFocus(): () => void {
  const precedent = document.activeElement as HTMLElement | null;
  const fenetres = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  const fenetre = fenetres[fenetres.length - 1];
  if (fenetre) {
    // ⚠️ Un conteneur n'est pas focusable par défaut : on le rend atteignable
    // par programme seulement (-1), jamais par tabulation.
    if (!fenetre.hasAttribute("tabindex")) fenetre.setAttribute("tabindex", "-1");
    fenetre.focus({ preventScroll: true });
  }
  return () => {
    if (precedent && document.contains(precedent)) precedent.focus({ preventScroll: true });
  };
}

export function useFenetreModale(actif: boolean, fermer: () => void) {
  useEffect(() => {
    if (!actif) return;
    const debrancher = brancherEchap(document, fermer);
    // ⚠️ Après la peinture : la fenêtre n'est pas encore dans le document quand
    // l'effet part, sur les composants qui la montent au même rendu.
    let rendreLeFocus: (() => void) | null = null;
    const image = requestAnimationFrame(() => {
      rendreLeFocus = donnerLeFocus();
    });
    return () => {
      cancelAnimationFrame(image);
      debrancher();
      rendreLeFocus?.();
    };
  }, [actif, fermer]);
}
