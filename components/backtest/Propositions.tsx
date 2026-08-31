"use client";

import { Card } from "@/components/ui/Card";
import type { Instrument } from "@/lib/backtest/instruments";
import { OBJECTIFS, type Objectif, type Proposition } from "@/lib/backtest/propositions";
import { AlertTriangle, ShieldCheck, TrendingUp, Wand2 } from "lucide-react";

/**
 * CE QUE LE TRADER POURRAIT CHANGER, ET CE QUE ÇA FERAIT.
 *
 * ⚠️ TROIS RÈGLES D'AFFICHAGE, ET CHACUNE PROTÈGE DE QUELQUE CHOSE.
 *
 * 1. **Aucun classement, aucune recommandation.** Les propositions s'affichent
 *    par objectif, dans l'ordre où elles ont été produites. Mettre en avant
 *    « la meilleure » reviendrait à conseiller un réglage choisi parce qu'il
 *    sortait le bon chiffre sur cette période-là.
 * 2. **Ce qui ne rejoue rien se distingue de ce qui rejoue.** Baisser son risque
 *    ne change aucun trade : c'est de l'arithmétique, on peut s'y fier sans
 *    réserve. Changer un réglage change la stratégie testée, et mérite la même
 *    méfiance que n'importe quel essai.
 * 3. **Appliquer une proposition efface le résultat affiché.** Un chiffre qui
 *    ne correspond plus au plan visible est la pire chose qui puisse arriver à
 *    cette page.
 */

const ICONES: Record<Objectif, typeof TrendingUp> = {
  plus_de_trades: TrendingUp,
  proteger_le_compte: ShieldCheck,
  couts_moins_lourds: Wand2,
};

export function Propositions({
  propositions,
  instrument,
  tradesActuels,
  onAppliquer,
  t,
}: {
  propositions: Proposition[];
  instrument: Instrument;
  tradesActuels: number;
  /**
   * ⚠️ ON REMONTE LA PROPOSITION ENTIÈRE, PAS SEULEMENT SON PLAN. Le levier et
   * l'objectif ne se retrouvent plus une fois le plan posé : c'est ici ou
   * jamais que la page peut retenir au nom de quoi ce réglage a été accepté, et
   * c'est exactement ce qui manquait au trader qui ne savait plus ce qu'il
   * avait changé.
   */
  onAppliquer: (proposition: Proposition) => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (propositions.length === 0) return null;

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-foreground">{t("bt_prop_titre")}</h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_prop_intro")}</p>

      {/* ⚠️ CE QU'ON REFUSE DE CHERCHER, DIT EN PREMIER. Un trader qui vient
          chercher « comment gagner plus » doit lire pourquoi ce bouton-là
          n'existe pas, avant de parcourir ceux qui existent. */}
      <p className="mt-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-xs leading-relaxed text-warning">
        {t("bt_prop_pas_de_gain")}
      </p>

      <div className="mt-4 space-y-5">
        {OBJECTIFS.map((objectif) => {
          const groupe = propositions.filter((p) => p.objectif === objectif);
          if (groupe.length === 0) return null;
          const Icone = ICONES[objectif];
          return (
            <div key={objectif}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Icone className="h-3.5 w-3.5" />
                {t(`bt_prop_objectif_${objectif}`)}
              </p>
              <p className="mb-2 text-[11px] leading-snug text-foreground-muted">
                {t(`bt_prop_pourquoi_${objectif}`)}
              </p>
              <ul className="space-y-2">
                {groupe.map((p, i) => (
                  <li
                    key={`${p.levier}-${i}`}
                    className="rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {t(`bt_prop_levier_${p.levier}`)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-foreground-muted">
                          {p.avant} → {p.apres}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAppliquer(p)}
                        className="shrink-0 rounded-lg border border-accent/50 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/10"
                      >
                        {t("bt_prop_appliquer")}
                      </button>
                    </div>

                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] tabular-nums text-foreground-muted sm:grid-cols-3">
                      <div>
                        <dt className="inline">{t("bt_prop_trades")} </dt>
                        <dd className="inline font-medium text-foreground">
                          {p.trades} {ecart(p.trades, tradesActuels)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t("bt_prop_recul")} </dt>
                        <dd className="inline font-medium text-foreground">
                          {p.ruine ? t("bt_capital_vide") : `-${p.reculComptePct.toFixed(1)} %`}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t("bt_prop_couts")} </dt>
                        <dd className="inline font-medium text-foreground">
                          {p.partDesCoutsPct.toFixed(1)} %
                        </dd>
                      </div>
                    </dl>

                    {p.sansRejeu ? (
                      <p className="mt-2 text-[11px] leading-snug text-profit">
                        {t("bt_prop_sans_rejeu")}
                      </p>
                    ) : (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-foreground-muted">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {t("bt_prop_avec_rejeu")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-snug text-foreground-muted">
        {t("bt_prop_note", { instrument: instrument.nom })}
      </p>
    </Card>
  );
}

/** L'écart avec le plan actuel, pour que le chiffre parle sans calcul mental. */
function ecart(apres: number, avant: number): string {
  const d = apres - avant;
  if (d === 0) return "";
  return `(${d > 0 ? "+" : ""}${d})`;
}
