"use client";

/**
 * Les deux blocs longs de la fiche d'une annonce économique : l'impact possible
 * du résultat, et le cours complet.
 *
 * Sortis de la page pour deux raisons : elle passait 660 lignes, et surtout ces
 * blocs se regardent isolément (voir components/calendar/EventLesson.demo.tsx
 * s'il existe encore) sans avoir à ouvrir une session authentifiée.
 *
 * ⚠️ LE CONTENU N'EST PAS IMPORTÉ ICI. Ces composants reçoivent la leçon déjà
 * chargée : les quatre langues du module lib/economic-deep-dives ne doivent
 * jamais partir dans le bundle du navigateur.
 */

import type { Traduire } from "@/lib/LanguageContext";
import type { DeepDive } from "@/lib/economic-deep-dives/types";

/**
 * Ce que le résultat peut faire au marché.
 *
 * ⚠️ NI VERT NI ROUGE. Un chiffre au-dessus du consensus n'est ni une bonne ni
 * une mauvaise nouvelle : cela dépend du sens de la position. Colorer ces
 * cartes en profit/perte reviendrait à souffler une direction, ce que cette
 * page n'a pas à faire. La flèche dit le sens du chiffre, rien de plus.
 */
export function EventOutcomes({ deepDive, t }: { deepDive: DeepDive; t: Traduire }) {
  if (deepDive.outcomes.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-2">
        {t("cal_outcomes_title")}
      </p>
      <div className="space-y-2">
        {deepDive.outcomes.map((issue, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-xs font-semibold text-foreground flex items-start gap-1.5">
              <span aria-hidden className="text-foreground-muted">
                {issue.tone === "up" ? "▲" : issue.tone === "down" ? "▼" : "●"}
              </span>
              {issue.label}
            </p>
            <p className="text-sm text-foreground-muted leading-relaxed mt-1">{issue.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Le cours complet, puis les points pratiques. */
export function EventLesson({ deepDive, t }: { deepDive: DeepDive; t: Traduire }) {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
        {t("cal_deep_dive_title")}
      </p>
      {deepDive.sections.map((section, i) => (
        <div key={i}>
          <p className="text-sm font-semibold text-foreground mb-1">{section.heading}</p>
          <p className="text-sm text-foreground-muted leading-relaxed">{section.body}</p>
        </div>
      ))}
      {deepDive.watch.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
            {t("cal_watch_title")}
          </p>
          <ul className="space-y-1">
            {deepDive.watch.map((point, i) => (
              <li key={i} className="text-sm text-foreground-muted leading-relaxed flex gap-2">
                <span aria-hidden className="text-accent">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
