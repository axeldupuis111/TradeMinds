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
