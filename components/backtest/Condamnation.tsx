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
 *
 * ⚠️⚠️ MAIS QUAND UN REJEU EXISTE, SES CHIFFRES REMPLACENT LES ESTIMATIONS, et
 * ils ne cohabitent pas avec elles. Deux fois le même fait sous deux nombres
 * différents, c'est le trader qui choisit celui qui l'arrange : la carte
 * affichait « il te faut 34.0 % de trades gagnants » quand l'équilibre réel de
 * ces trades-là était à 40.8 %, et « l'aller-retour coûte 2.0 % de ton risque »
 * juste au-dessus d'une ligne annuelle calculée, elle, sur 2.9 %.
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

/**
 * Quelle phrase pour ce constat.
 *
 * ⚠️ TROIS LIGNES CHANGENT DE TEXTE SELON CE QU'ON SAIT, et chacune l'a fait
 * après avoir été vue fausse à l'écran :
 *
 * 1. « Ton stop vaut 7.05 bougie », un pluriel appliqué à moins de deux.
 * 2. Le coût, selon qu'il est mesuré sur les trades ou déduit du risque moyen.
 *    Les deux nombres diffèrent de près de moitié, et la carte les affichait
 *    tous les deux sans dire lequel était lequel.
 * 3. L'équilibre mesuré, selon qu'il reste ou non des trades sortis ailleurs
 *    qu'à l'objectif ou au stop : sans eux, la phrase sur la fin de séance
 *    parlerait de zéro trade.
 */
export function clePourLeConstat(c: Constat): string {
  if (c.code === "stop_dans_le_bruit" && Number(c.valeurs.bougies) < 2) {
    return "bt_cond_stop_dans_le_bruit_une";
  }
  if (c.code === "cout_structurel" && c.valeurs.mesure === "oui") {
    return "bt_cond_cout_structurel_mesure";
  }
  if (c.code === "taux_equilibre_mesure" && Number(c.valeurs.horsCible) <= 0) {
    return "bt_cond_taux_equilibre_mesure_pur";
  }
  return `bt_cond_${c.code}`;
}

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
                {t(clePourLeConstat(c), c.valeurs)}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
