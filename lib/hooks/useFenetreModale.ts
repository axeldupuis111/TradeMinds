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
 * il était. Rend `null` si aucune fenêtre n'est encore posée.
 *
 * ⚠️ ON RENVOIE LE FOCUS À LA FERMETURE, et c'est la moitié qui s'oublie : sans
 * ça, refermer une fenêtre repart du haut de la page, et le bouton qu'on venait
 * d'actionner est perdu.
 *
 * ⚠️ `null` PLUTÔT QU'UNE FONCTION VIDE : l'appelant doit pouvoir faire la
 * différence entre « c'est fait » et « il n'y avait rien à viser », sinon il ne
 * peut pas réessayer.
 */
export function donnerLeFocus(): (() => void) | null {
  const precedent = document.activeElement as HTMLElement | null;
  const fenetres = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  const fenetre = fenetres[fenetres.length - 1];
  if (!fenetre) return null;
  // ⚠️ Un conteneur n'est pas focusable par défaut : on le rend atteignable
  // par programme seulement (-1), jamais par tabulation.
  if (!fenetre.hasAttribute("tabindex")) fenetre.setAttribute("tabindex", "-1");
  fenetre.focus({ preventScroll: true });
  return () => {
    if (precedent && document.contains(precedent)) precedent.focus({ preventScroll: true });
  };
}

export function useFenetreModale(actif: boolean, fermer: () => void) {
  useEffect(() => {
    if (!actif) return;
    const debrancher = brancherEchap(document, fermer);
    /**
     * ⚠️⚠️ PAS D'IMAGE D'ANIMATION ICI, ET C'EST LE DÉFAUT QUE J'AI ÉCRIT
     * MOI-MÊME : j'attendais `requestAnimationFrame` « le temps que la fenêtre
     * soit posée ». Or un effet part DÉJÀ après la pose du DOM, donc l'attente
     * n'apportait rien, et elle coûtait cher : une image d'animation ne se
     * déclenche JAMAIS dans un onglet caché. Le focus n'entrait alors nulle
     * part, et la fenêtre restait déclarée `aria-modal` sur une page que la
     * lecture d'écran avait reçu l'ordre d'ignorer.
     *
     * ⚠️ LE SECOND ESSAI EST POUR LES FENÊTRES QUI ARRIVENT PLUS TARD (contenu
     * chargé, montage différé) : `setTimeout`, lui, finit toujours par partir.
     */
    let rendreLeFocus = donnerLeFocus();
    const secondEssai = rendreLeFocus
      ? null
      : setTimeout(() => {
          rendreLeFocus = donnerLeFocus();
        }, 0);
    return () => {
      if (secondEssai !== null) clearTimeout(secondEssai);
      debrancher();
      rendreLeFocus?.();
    };
  }, [actif, fermer]);
}
