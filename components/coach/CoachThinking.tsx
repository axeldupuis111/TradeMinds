"use client";

/**
 * Indicateur « le coach travaille » — ce qu'il fait, et depuis combien de temps.
 *
 * POURQUOI. Entre l'envoi et le premier mot, il peut s'écouler plusieurs
 * secondes : lecture du journal côté serveur, choix d'un outil, exécution de
 * cet outil. L'écran ne montrait rien pendant ce temps (« … » dans le dock,
 * trois points sur la page Analyse). Un vide sans explication se lit comme une
 * panne : on ferme, on ne revient pas.
 *
 * CE QUI EST AFFICHÉ EST VRAI. Le libellé suit les étapes réellement émises par
 * la route (lib/coach-steps.ts). Le compteur de secondes n'apparaît qu'au-delà
 * de quelques secondes : avant, il transforme une attente normale en problème.
 */

import { useEffect, useRef, useState } from "react";
import type { Traduire } from "@/lib/LanguageContext";
import { coachStepLabelKey, type CoachStepKey } from "@/lib/coach-steps";

/** Au-delà, le compteur de secondes s'affiche (avant, il inquiète pour rien). */
const SECONDES_AVANT_COMPTEUR = 4;
/** Au-delà, on dit explicitement que c'est long mais normal. */
const SECONDES_AVANT_RASSURANCE = 18;

export default function CoachThinking({
  step,
  t,
  compact = false,
}: {
  /** Étape en cours ; `null` retombe sur « je réfléchis ». */
  step: CoachStepKey | null;
  t: Traduire;
  /** Rendu resserré pour le dock. */
  compact?: boolean;
}) {
  const [secondes, setSecondes] = useState(0);
  // Départ du chronomètre : le montage du composant, c'est-à-dire l'instant où
  // le coach se met au travail. Il ne se réinitialise donc PAS d'une étape à
  // l'autre : ce qui intéresse le trader, c'est l'attente totale.
  const debut = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setSecondes(Math.floor((Date.now() - debut.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const libelle = t(coachStepLabelKey(step ?? "thinking"));
  const tailleTexte = compact ? "text-[11px]" : "text-xs";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2 ${compact ? "" : "rounded-bl-sm"}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex gap-1" aria-hidden>
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-accent motion-safe:animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className={`${tailleTexte} text-foreground-muted`}>
          {libelle}
          {secondes >= SECONDES_AVANT_COMPTEUR && (
            <span className="ml-1.5 tabular-nums text-foreground-subtle">{secondes} s</span>
          )}
        </span>
      </div>
      {secondes >= SECONDES_AVANT_RASSURANCE && (
        <p className={`${tailleTexte} text-foreground-subtle`}>{t("coach_step_slow")}</p>
      )}
    </div>
  );
}
