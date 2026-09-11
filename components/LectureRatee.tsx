"use client";

import { useLanguage } from "@/lib/LanguageContext";

/**
 * « JE N'AI PAS PU LIRE » N'EST PAS « TU N'AS RIEN ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX ÉCRANS DISAIENT AU TRADER QU'IL N'AVAIT RIEN quand la lecture de son
 * journal échouait. Mesuré en production en faisant répondre 500 aux lectures
 * REST depuis le navigateur, sur un compte de 85 trades :
 *
 *   - Analytics : « Aucune donnée pour cette période. »
 *   - Projection : « Pas encore de quoi conclure. »
 *   - Bilan mensuel : « Aucune activité ce mois-ci. »
 *   - Suivi de compte : « Aucun suivi terminé. »
 *   - Classement : « Pas encore classé : complète au moins 3 sessions. »
 *
 * ⚠️ LE DERNIER EST LE PIRE : ce n'est pas un constat, c'est une CONSIGNE, et
 * elle repose sur un fait faux. Le trader va refaire trois séances qu'il a déjà
 * faites.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un écran qui montre une liste distingue TROIS états, pas deux : je charge, je
 * n'ai pas pu lire, il n'y a rien. Le deuxième se dit, et il propose de
 * réessayer plutôt que de laisser recharger la page à l'aveugle.
 */
export default function LectureRatee({ onReessayer }: { onReessayer?: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="my-6 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-loss/40 bg-loss/[0.06] px-4 py-4 text-sm"
    >
      <p className="text-foreground">{t("lecture_impossible")}</p>
      {onReessayer && (
        <button
          onClick={onReessayer}
          className="px-3 py-1.5 bg-surface border border-border text-foreground rounded-lg text-sm hover:bg-border transition-colors"
        >
          {t("error_retry")}
        </button>
      )}
    </div>
  );
}
