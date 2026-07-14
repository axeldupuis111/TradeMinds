"use client";

import { ATTRIBUTION_KEY, ATTRIBUTION_MAX_AGE_MS } from "@/components/AttributionCapture";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { useEffect } from "react";

/**
 * Second maillon de l'attribution marketing (voir AttributionCapture) :
 * au premier passage dans le dashboard d'un compte récent (< 7 jours), si une
 * source a été captée à l'arrivée sur le site, on émet `signup_attributed`
 * (meta.source) puis on marque la trace comme consommée. Le funnel admin
 * ventile ensuite les inscriptions par source.
 *
 * Le garde-fou « compte récent » évite d'attribuer un simple re-login d'un
 * utilisateur existant qui aurait cliqué un lien utm entre-temps.
 */

const SENT_KEY = "td_attribution_sent";
const FRESH_ACCOUNT_MS = 7 * 24 * 3600 * 1000;

export default function SignupAttribution() {
  useEffect(() => {
    try {
      if (localStorage.getItem(SENT_KEY)) return;
      const raw = localStorage.getItem(ATTRIBUTION_KEY);
      if (!raw) return;

      const { source, at } = JSON.parse(raw) as { source?: string; at?: number };
      if (!source || !at || Date.now() - at > ATTRIBUTION_MAX_AGE_MS) {
        localStorage.removeItem(ATTRIBUTION_KEY);
        return;
      }

      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user?.created_at) return;
        // Marqué consommé quoi qu'il arrive : compte ancien = pas une inscription.
        localStorage.setItem(SENT_KEY, "1");
        if (Date.now() - new Date(user.created_at).getTime() > FRESH_ACCOUNT_MS) return;
        track("signup_attributed", { source });
      });
    } catch {
      // L'attribution ne casse jamais le dashboard.
    }
  }, []);

  return null;
}
