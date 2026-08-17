"use client";

import { ATTRIBUTION_KEY, ATTRIBUTION_MAX_AGE_MS } from "@/components/AttributionCapture";
import { createClient } from "@/lib/supabase/client";
import { trackAsync } from "@/lib/track";
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
 *
 * On appelle AUSSI /api/referral/claim, qui grave le rattachement commercial à
 * l'apporteur (referral_attributions). Les deux sont volontairement distincts :
 * l'événement produit alimente le funnel, l'attribution décide d'une commission
 * et ne peut donc pas dépendre d'un localStorage.
 *
 * En revanche, arriver par le lien d'un partenaire ne fait toujours pas entrer
 * dans sa communauté. Ce rattachement-là se joue au paiement, sur le code promo
 * utilisé (voir app/api/stripe/webhook) : cliquer un lien ne prouve pas qu'on
 * vient de son audience, payer avec son code, si.
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
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user?.created_at) return;
        // Marqué consommé quoi qu'il arrive : compte ancien = pas une inscription.
        localStorage.setItem(SENT_KEY, "1");
        if (Date.now() - new Date(user.created_at).getTime() > FRESH_ACCOUNT_MS) return;

        await trackAsync("signup_attributed", { source });

        // Rattachement à l'apporteur, gravé en base et verrouillé (first-touch).
        // Distinct de l'événement produit ci-dessus : celui-ci mesure le funnel,
        // celle-là décide d'une commission. Le serveur revalide tout (code,
        // fraîcheur du compte, auto-parrainage) : cet appel n'est qu'un
        // déclencheur.
        await fetch("/api/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
        }).catch(() => {
          // Réseau coupé : l'attribution repassera au paiement, via le code
          // gravé dans les metadata Stripe.
        });
      });
    } catch {
      // L'attribution ne casse jamais le dashboard.
    }
  }, []);

  return null;
}
