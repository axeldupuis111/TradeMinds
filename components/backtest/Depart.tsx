"use client";

import { Card } from "@/components/ui/Card";
import type { Depart as UnDepart } from "@/lib/backtest/depart";
import { Compass, Loader2 } from "lucide-react";

/**
 * PARTIR D'UNE BASE QUI TIENT DEBOUT.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CET ÉCRAN ─────────────────────────────────
 *
 * « Il dit que ma stratégie n'est pas rentable, il ne trouve pas de moyen de
 * l'améliorer... donc inutile d'utiliser le backtest à part pour se démotiver.
 * Le backtest est là pour accompagner à la CRÉATION et au test de la
 * stratégie. »
 *
 * ⚠️⚠️ LA RECHERCHE PARTAIT TOUJOURS DE SON PLAN, et une descente par
 * coordonnées qui part d'un mauvais point reste dans le mauvais coin. Pendant
 * ce temps, le référentiel contenait des méthodes professionnelles complètes que
 * rien n'avait jamais essayées. Cette carte les propose, montées sur son marché,
 * ses heures et son risque.
 *
 * ⚠️ AUCUN CLASSEMENT, AUCUNE RECOMMANDATION, AUCUNE PROMESSE. « Complète,
 * cohérente, adaptée » est ce qu'on garantit d'une base. « Rentable » ne se
 * garantit pas, et le mot n'apparaît nulle part.
 *
 * ⚠️ CHAQUE BASE ESSAYÉE COMPTE COMME UN ESSAI, et l'écran le dit avant les
 * boutons, pas après.
 */
export function Depart({
  departs,
  enCours,
  onEssayer,
  t,
}: {
  departs: UnDepart[];
  enCours: boolean;
  onEssayer: (d: UnDepart) => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Compass className="h-4 w-4" />
        {t("bt_dep_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_dep_intro")}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_dep_pourquoi")}
      </p>

      {/* ⚠️ CE QUE ÇA COÛTE, DIT AVANT LES BOUTONS. En essayer huit et garder
          la meilleure serait le même sur-apprentissage, simplement déplacé. */}
      <p className="mt-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-[11px] leading-relaxed text-warning">
        {t("bt_dep_compte")}
      </p>

      {departs.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-foreground-muted">{t("bt_dep_aucune")}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {departs.map((d) => (
              <li key={d.methode.code} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {t(`bt_meth_${d.methode.code}`)}
                      <span className="ml-1.5 text-[10px] font-normal text-foreground-muted">
                        {t(`bt_fam_${d.methode.famille}`)}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                      {t(`bt_meth_${d.methode.code}_quoi`)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => onEssayer(d)}
                    className="shrink-0 rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {enCours ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t("bt_dep_encours")}
                      </span>
                    ) : (
                      t("bt_dep_essayer")
                    )}
                  </button>
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
                  {t("bt_dep_adapte", {
                    liste: d.adapte.map((a) => t(`bt_dep_adapte_${a}`)).join(", "),
                  })}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                  {t(`bt_regime_${d.methode.regimes[0]}`)}
                  {d.methode.seance
                    ? ` · ${d.methode.seance.debut} → ${d.methode.seance.fin}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_dep_remplace")}
          </p>
        </>
      )}
    </Card>
  );
}
