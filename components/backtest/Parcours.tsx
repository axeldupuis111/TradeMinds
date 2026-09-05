"use client";

import { cn } from "@/lib/cn";
import type { CodeEtapeParcours, EtapeDuParcours } from "@/lib/backtest/etapes";
import { Check, Lock } from "lucide-react";

/**
 * LES CINQ ÉTAPES, EN HAUT, TOUJOURS VISIBLES.
 *
 * ── D'OÙ VIENT CE COMPOSANT ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROISIÈME REPROCHE SUR LE MÊME SUJET. J'avais répondu par une carte
 * « la prochaine chose à faire », puis par des sections repliables :
 *
 *   « Même si tu proposes de replier les états et autre, il reste là et c'est
 *     incompréhensible à utiliser. Limite tu fais des onglets. Il faut trouver
 *     un ordre logique, on ne doit pas sauter des étapes. »
 *
 * Replier ne suffisait pas parce que le problème n'était pas la hauteur, c'était
 * l'absence de parcours : vingt cartes repliées restent vingt décisions à
 * prendre dans un ordre que rien n'impose.
 *
 * ── CE QUE CETTE BARRE FAIT ─────────────────────────────────────────────────
 *
 * ⚠️ ELLE MONTRE TOUJOURS OÙ ON EN EST, y compris les étapes qu'on n'a pas
 * encore atteintes. Cacher les suivantes donnerait un tunnel, et un trader qui
 * ne voit pas la fin ne sait pas ce qu'il achète en commençant.
 *
 * ⚠️ UNE ÉTAPE FERMÉE DIT POURQUOI AU SURVOL ET AU CLIC, et sa raison est une
 * action : « lance le test d'abord » se règle en un clic, « verrouillé » ne se
 * règle pas.
 */
export function Parcours({
  etapes,
  courante,
  onAller,
  t,
}: {
  etapes: EtapeDuParcours[];
  courante: CodeEtapeParcours;
  onAller: (code: CodeEtapeParcours) => void;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  return (
    <nav aria-label={t("bt_par_titre")} className="rounded-xl border border-border bg-surface/40 p-2">
      <ol className="flex flex-wrap gap-1.5">
        {etapes.map((e, i) => {
          const active = e.code === courante;
          return (
            <li key={e.code} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => e.ouverte && onAller(e.code)}
                disabled={!e.ouverte}
                title={e.ouverte ? undefined : t(e.raison ?? "")}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-accent text-on-accent"
                    : e.ouverte
                      ? "text-foreground-muted hover:bg-surface hover:text-foreground"
                      : "cursor-not-allowed text-foreground-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-on-accent/20 text-on-accent"
                      : e.faite
                        ? "bg-profit/15 text-profit"
                        : "bg-surface text-foreground-muted",
                  )}
                >
                  {!e.ouverte ? (
                    <Lock className="h-2.5 w-2.5" />
                  ) : e.faite ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 truncate text-xs font-medium">
                  {t(`bt_par_${e.code}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ⚠️ LA RAISON DU BLOCAGE EN CLAIR, PAS SEULEMENT EN INFOBULLE. Une
          infobulle n'existe pas au doigt, et cette page se lit aussi sur
          téléphone. */}
      {(() => {
        const bloquee = etapes.find((e) => !e.ouverte && e.raison);
        return bloquee ? (
          <p className="mt-1.5 px-2.5 pb-1 text-[11px] text-foreground-muted">
            {t(bloquee.raison!)}
          </p>
        ) : null;
      })()}
    </nav>
  );
}
