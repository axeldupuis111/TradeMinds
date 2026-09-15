"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * LE MESSAGE COURT QUI RÉPOND À UN GESTE, ÉCRIT UNE SEULE FOIS.
 *
 * ── CE QU'IL REMPLACE ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX ENDROITS DU PRODUIT APPELAIENT `alert()`, la boîte de dialogue
 * NATIVE du navigateur. Trois d'entre eux sur l'export PDF, une fonctionnalité
 * payante : « pas de données », « devises mêlées », « échec ». Un `alert()`
 * bloque l'onglet entier, s'affiche sans aucun style sous un en-tête
 * « tradediscipline.app indique », ne suit ni le thème ni la typographie du
 * produit, et ressemble davantage à une panne qu'à une réponse.
 *
 * ⚠️ ET LA MAISON AVAIT DÉJÀ SA FORME : un bandeau discret en haut à droite,
 * avec le bon rôle ARIA. Sauf qu'il était RECOPIÉ dans deux pages (réglages,
 * stratégie), chacune avec sa version — donc trois façons de répondre à un
 * geste dans le même produit, dont une qui bloque le navigateur.
 *
 * ── LES DEUX RÔLES ARIA, ET POURQUOI ILS DIFFÈRENT ──────────────────────────
 *
 * ⚠️ Une ERREUR est annoncée tout de suite (`alert` / `assertive`) : elle
 * interrompt la lecture parce qu'elle change ce que l'utilisateur doit faire.
 * Une RÉUSSITE attend une pause (`status` / `polite`) : couper la lecture pour
 * dire « c'est enregistré » gêne plus que ça n'informe.
 */
export type ToastType = "success" | "error";

export interface ToastState {
  type: ToastType;
  text: string;
}

/**
 * ⚠️ LE DÉLAI EST PLUS LONG POUR UNE ERREUR. Trois secondes suffisent à lire
 * « Enregistré » ; elles ne suffisent pas à lire pourquoi un export vient
 * d'être refusé, ni à décider quoi faire ensuite.
 */
const DUREE_MS: Record<ToastType, number> = { success: 3000, error: 6000 };

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  /**
   * ⚠️ LE MINUTEUR PRÉCÉDENT EST ANNULÉ. Sans ça, deux messages rapprochés
   * partagent le premier délai : le second disparaît au bout du reliquat du
   * premier, parfois instantanément.
   */
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: ToastType, text: string) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    setToast({ type, text });
    minuteur.current = setTimeout(() => setToast(null), DUREE_MS[type]);
  }, []);

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
        toast.type === "success"
          ? "bg-profit/10 border border-profit/30 text-profit"
          : "bg-loss/10 border border-loss/30 text-loss"
      }`}
    >
      {toast.text}
    </div>
  );
}
