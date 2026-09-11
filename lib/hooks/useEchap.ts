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
 *
 * ⚠️ `keydown` SUR LE DOCUMENT, en phase de capture, pour passer avant un champ
 * de saisie qui absorberait la touche.
 */
export function useEchap(actif: boolean, fermer: () => void) {
  useEffect(() => {
    if (!actif) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", surTouche, true);
    return () => document.removeEventListener("keydown", surTouche, true);
  }, [actif, fermer]);
}
