"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { LIGNES_POSSIBLES, type Constat, type Gravite } from "@/lib/backtest/condamnation";
import { AlertTriangle, Calculator, Info, TriangleAlert } from "lucide-react";

/**
 * CE QU'ON PEUT AFFIRMER SANS RIEN PRÉDIRE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CET ÉCRAN ──────────────────────────────────
 *
 * « Certains tradent des stratégies pas viables, qui ne tiennent pas la route et
 * qui sont vouées à perdre de l'argent. »
 *
 * ⚠️⚠️ AUCUNE LIGNE ICI N'EST UNE PRÉVISION, et le titre de la carte le dit. Ce
 * sont cinq divisions et multiplications que le trader peut refaire sur un coin
 * de table. Elles ne disent jamais « ta stratégie va perdre » ; elles disent
 * « voilà ce qu'il faudrait battre pour qu'elle ne perde pas », et il arrive que
 * le chiffre soit hors d'atteinte de quiconque.
 *
 * ⚠️ AUCUN BACKTEST N'EST NÉCESSAIRE POUR CETTE CARTE. Un trader dont la méthode
 * ne sera jamais rejouable obtient ces cinq lignes exactement comme les autres.
 */

const ICONE: Record<Gravite, typeof Info> = {
  condamne: TriangleAlert,
  lourd: AlertTriangle,
  informatif: Info,
};

const TON: Record<Gravite, string> = {
  condamne: "border-loss/40 bg-loss/[0.06]",
  lourd: "border-warning/40 bg-warning/[0.06]",
  informatif: "border-border bg-surface/40",
};

const TON_TEXTE: Record<Gravite, string> = {
  condamne: "text-loss",
  lourd: "text-warning",
  informatif: "text-foreground-muted",
};

export function Condamnation({
  constats,
  t,
}: {
  constats: Constat[];
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (constats.length === 0) return null;

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Calculator className="h-4 w-4" />
        {t("bt_cond_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_cond_intro")}</p>

      {/* ⚠️ LA CARTE NE PROMET PAS CINQ LIGNES POUR EN MONTRER UNE. Trois des
          cinq demandent le risque moyen d'un trade, qui vient du rejeu, ou le
          risque par trade, que le trader n'a pas toujours renseigné. On dit ce
          qui manque au lieu de laisser croire qu'il n'y avait que ça à dire. */}
      {constats.length < LIGNES_POSSIBLES ? (
        <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
          {t("bt_cond_incomplet", { rendues: constats.length, total: LIGNES_POSSIBLES })}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {constats.map((c) => {
          const Icone = ICONE[c.gravite];
          return (
            <li key={c.code} className={cn("rounded-lg border p-3", TON[c.gravite])}>
              <p className={cn("flex items-center gap-1.5 text-xs font-medium", TON_TEXTE[c.gravite])}>
                <Icone className="h-3.5 w-3.5 shrink-0" />
                {t(`bt_cond_${c.code}_titre`)}
                <span className="ml-auto text-[10px] font-normal uppercase tracking-wide">
                  {t(`bt_grav_${c.gravite}`)}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-muted">
                {/* ⚠️ « Ton stop vaut 7.05 bougie » : la même faute que « 1 trades »
                    et « 1 journées », vue à l'écran une fois de plus. */}
                {t(
                  c.code === "stop_dans_le_bruit" && Number(c.valeurs.bougies) < 2
                    ? "bt_cond_stop_dans_le_bruit_une"
                    : `bt_cond_${c.code}`,
                  c.valeurs,
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
