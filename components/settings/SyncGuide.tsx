"use client";

import { useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { getSyncGuide, type SyncPlatform } from "@/lib/sync-guides";

interface Props {
  platform: SyncPlatform;
  /** Intitulé du dépliant, ex. « Comment connecter MetaTrader ». */
  title: string;
  /**
   * Contenu inséré entre les prérequis et la première étape (boutons de
   * téléchargement, rappel du token), quand le guide en dépend.
   */
  children?: ReactNode;
}

/**
 * Dépliant d'installation d'une plateforme de synchro. Rend un guide de
 * lib/sync-guides : prérequis, étapes numérotées avec point de contrôle,
 * dépannage par symptôme, remarques. Le point de contrôle est ce qui permet à
 * l'utilisateur de repérer OÙ il a décroché sans tout recommencer.
 */
export default function SyncGuide({ platform, title, children }: Props) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const guide = getSyncGuide(platform, lang);

  return (
    <div className="mt-4 bg-surface border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
      >
        <span className="text-foreground font-medium text-sm">{title}</span>
        <svg
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5">
          {/* Prérequis */}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              {t("sync_guide_before")}
            </p>
            <ul className="space-y-1.5 text-sm text-muted leading-relaxed list-disc list-outside pl-4">
              {guide.before.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          {children}

          {/* Étapes numérotées */}
          <ol className="space-y-4">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{step.detail}</p>
                  {step.check && (
                    <p className="mt-2 flex gap-2 rounded-lg bg-profit/5 border border-profit/20 px-3 py-2 text-sm text-muted leading-relaxed">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-profit"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        <strong className="text-foreground font-medium">{t("sync_guide_check")}</strong>{" "}
                        {step.check}
                      </span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Dépannage par symptôme */}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5">
              {t("sync_guide_fixes")}
            </p>
            <dl className="space-y-3">
              {guide.fixes.map((fix, i) => (
                <div key={i}>
                  <dt className="text-sm font-medium text-foreground">{fix.problem}</dt>
                  <dd className="mt-0.5 text-sm text-muted leading-relaxed">{fix.fix}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Remarques */}
          {guide.notes && guide.notes.length > 0 && (
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                {t("sync_guide_notes")}
              </p>
              <ul className="space-y-1.5 text-sm text-muted leading-relaxed list-disc list-outside pl-4">
                {guide.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
