"use client";

import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";

/**
 * UNE ÉTAPE DE LA PAGE, REPLIÉE TANT QU'ON N'Y EST PAS.
 *
 * ── D'OÙ VIENT CE COMPOSANT ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ MESURÉ SUR LA PAGE, AVANT MÊME D'AVOIR LANCÉ : 9,5 écrans de haut,
 * 21 titres, 3 188 mots, tout empilé à plat. Le verdict d'Axel :
 *
 *   « J'y comprends rien, il y a énormément de choses et c'est très mal rangé.
 *     Tout est à la suite, c'est incompréhensible. »
 *
 * J'avais répondu à ça par une carte de plus en tête de page (« la prochaine
 * chose à faire »). Elle aide à savoir par où commencer, et elle ne règle rien
 * du problème qu'il décrit : la page reste un mur. Une carte qui dit « commence
 * ici » posée sur vingt cartes déroulées reste vingt cartes déroulées.
 *
 * ── CE QUE CE COMPOSANT CHANGE ──────────────────────────────────────────────
 *
 * Chaque étape devient une ligne : un numéro, un titre, et surtout SON ÉTAT
 * ACTUEL en une phrase. Repliée, elle occupe trois centimètres et dit
 * l'essentiel ; ouverte, elle rend exactement ce qu'elle rendait avant.
 *
 * ⚠️ L'ÉTAT DANS L'EN-TÊTE N'EST PAS DÉCORATIF, c'est ce qui permet de ne pas
 * ouvrir. « Or (XAU/USD) · 2025-01 → 2025-12 » répond à la question qu'on se
 * posait en dépliant le périmètre. Sans lui, replier ne fait que cacher, et
 * cacher est pire qu'empiler.
 *
 * ⚠️ RIEN N'EST SUPPRIMÉ. Chaque mesure répond à une vraie question et les
 * retirer appauvrirait l'outil : le problème n'a jamais été leur nombre, c'est
 * qu'elles arrivaient toutes en même temps.
 */
export function Section({
  numero,
  titre,
  etat,
  ouverte,
  onBasculer,
  faite,
  ancre,
  children,
}: {
  /** Le rang dans le parcours. Absent pour les sections hors parcours. */
  numero?: number;
  titre: string;
  /**
   * Où en est cette étape, en une phrase.
   *
   * ⚠️ C'EST LA MOITIÉ DE L'INTÉRÊT DU REPLI. Sans état, le trader doit ouvrir
   * pour savoir s'il a quelque chose à y faire, et on a juste ajouté un clic.
   */
  etat?: string;
  ouverte: boolean;
  onBasculer: () => void;
  /** Vrai quand il n'y a plus rien à y faire : coche discrète, pas de fanfare. */
  faite?: boolean;
  ancre?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={ancre}
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        ouverte ? "border-border bg-background" : "border-border/60 bg-surface/30",
      )}
    >
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouverte}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface/50"
      >
        {numero != null ? (
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
              faite
                ? "bg-profit/15 text-profit"
                : ouverte
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-foreground-muted",
            )}
          >
            {faite ? <Check className="h-3.5 w-3.5" /> : numero}
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{titre}</span>
          {etat ? (
            <span className="mt-0.5 block truncate text-xs text-foreground-muted">{etat}</span>
          ) : null}
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-foreground-muted transition-transform",
            ouverte && "rotate-180",
          )}
        />
      </button>

      {/* ⚠️ DÉMONTÉ QUAND C'EST REPLIÉ, pas seulement masqué : les cartes de
          cette page montent des graphiques et des tableaux de plusieurs
          centaines de lignes, et les garder dans le DOM rendrait le repli
          inutile là où il sert le plus. */}
      {ouverte ? <div className="border-t border-border px-4 pb-4 pt-4">{children}</div> : null}
    </div>
  );
}
