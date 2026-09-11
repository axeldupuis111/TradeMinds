"use client";

import { browserTimezone } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * Synchronise le fuseau du navigateur (IANA, ex. « Europe/Paris ») vers
 * profiles.timezone quand le profil n'en a pas encore. Les crons serveur
 * (rappel quotidien 8h, rapport hebdo, réactivation, streak-guard, quotas IA)
 * gatent sur l'heure LOCALE via cette colonne : sans valeur, ils retombent sur
 * UTC et les emails partent à la mauvaise heure. Un fuseau déjà renseigné
 * (choisi dans Paramètres ou déjà synchronisé) n'est jamais écrasé.
 * Fire-and-forget : un échec n'impacte pas l'UI.
 */
export default function TimezoneSync() {
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", user.id)
          .single();
        if (data && !data.timezone) {
          /**
           * ⚠️ RÉSULTAT VOLONTAIREMENT IGNORÉ, et la raison tient ici : aucun
           * geste du trader n'attend cette écriture, il n'y a donc personne à
           * qui dire qu'elle a raté, et aucun écran à remettre dans son état
           * d'avant. La condition `!data.timezone` la refait au chargement
           * suivant tant qu'elle n'a pas abouti.
           */
          await supabase.from("profiles").update({ timezone: browserTimezone() }).eq("id", user.id);
        }
      } catch {
        // Pas de session ou erreur réseau : on réessaiera au prochain chargement.
      }
    })();
  }, []);

  return null;
}
