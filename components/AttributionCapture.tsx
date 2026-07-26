"use client";

import { useEffect } from "react";

/**
 * Capture d'attribution marketing — premier contact (first-touch).
 *
 * Si l'URL d'arrivée porte un ?utm_source= (liens influenceurs, campagnes)
 * ou un ?ref=, on mémorise la source en localStorage sans jamais écraser une
 * source déjà captée. À l'inscription, SignupAttribution (côté dashboard)
 * transforme cette trace en événement produit `signup_attributed`.
 *
 * Aucune donnée envoyée ici, aucun cookie : simple localStorage local,
 * exploité uniquement si l'utilisateur crée un compte.
 */

export const ATTRIBUTION_KEY = "td_attribution";
/** Fenêtre d'attribution : au-delà, la visite initiale ne compte plus. */
export const ATTRIBUTION_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

/**
 * Source d'attribution courante (slug partenaire, ex. « xanalyse »).
 *
 * Ordre : localStorage (first-touch, c'est ce que le checkout appliquera), puis
 * repli sur l'URL. Le repli est indispensable : la capture ci-dessous écrit
 * depuis un useEffect dont l'ordre d'exécution n'est pas garanti par rapport aux
 * autres composants. Sans lui, un visiteur arrivant sur un lien partenaire lit
 * un stockage encore vide et voit l'offre publique jusqu'au rechargement.
 */
export function readAttributionRef(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (raw) {
      const { source, at } = JSON.parse(raw) as { source?: string; at?: number };
      if (source && at && Date.now() - at <= ATTRIBUTION_MAX_AGE_MS) return source;
    }
  } catch {
    // localStorage indisponible : on se rabat sur l'URL.
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("utm_source") || params.get("ref");
    return fromUrl ? fromUrl.slice(0, 64).toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export default function AttributionCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("utm_source") || params.get("ref");
      if (!source) return;
      if (localStorage.getItem(ATTRIBUTION_KEY)) return; // first-touch : on garde la 1re source
      localStorage.setItem(
        ATTRIBUTION_KEY,
        JSON.stringify({ source: source.slice(0, 64).toLowerCase(), at: Date.now() })
      );
    } catch {
      // localStorage indisponible (navigation privée stricte) → tant pis.
    }
  }, []);

  return null;
}
