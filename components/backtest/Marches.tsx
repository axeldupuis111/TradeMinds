"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { signe as r } from "@/lib/backtest/format";
import { lireLesMarches, type ResultatMarche } from "@/lib/backtest/marches";
import { AlertTriangle, Globe } from "lucide-react";

/**
 * LA MÊME MÉTHODE SUR D'AUTRES MARCHÉS, SANS CLASSEMENT.
 *
 * ⚠️⚠️ « SUR QUEL MARCHÉ MA STRATÉGIE MARCHE-T-ELLE LE MIEUX » EST LA PIRE
 * QUESTION QU'ON PUISSE POSER À CET ÉCRAN, et c'est celle qu'il inspire
 * naturellement. Essayer huit marchés et garder le meilleur, c'est le
 * sur-apprentissage de la période déplacé sur l'instrument, en pire : il y a
 * moins de marchés que de réglages, donc l'illusion se fabrique plus vite.
 *
 * La question à laquelle il répond est l'inverse : sur combien de marchés
 * comparables l'avantage se retrouve-t-il ? Une méthode qui tient sur quatre
 * indices décrit peut-être quelque chose. Une méthode qui ne tient que sur le
 * sien ne décrit pas ce marché-là, elle décrit la chance qu'elle y a eue.
 *
 * D'où l'écran : aucun tri, aucune mise en avant, aucun bouton pour « passer
 * sur ce marché ». Le sien est marqué comme le sien, et rien d'autre.
 */

export function Marches({
  marches,
  t,
}: {
  /** ⚠️ Rien à afficher tant que la mesure n'a pas eu lieu : la carte disparaît. */
  marches: ResultatMarche[] | undefined;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (!marches) return null;
  const lecture = lireLesMarches(marches);

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Globe className="h-4 w-4" />
        {t("bt_mar_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_mar_intro")}</p>

      {/* ⚠️ LA RÈGLE D'ÉCHELLE EST ÉCRITE, pas cachée. Transposer un plan d'un
          marché à l'autre suppose une convention ; la taire ferait passer une
          convention pour une mesure. */}
      <p className="mt-2.5 rounded-lg border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_mar_echelle")}
      </p>

      <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-[11px] tabular-nums">
              <thead>
                <tr className="text-left text-foreground-muted">
                  <th className="py-1 pr-3 font-normal">{t("bt_mar_marche")}</th>
                  <th className="py-1 pr-3 font-normal">{t("bt_rob_trades")}</th>
                  <th className="py-1 font-normal">{t("bt_rob_esperance")}</th>
                </tr>
              </thead>
              <tbody>
                {marches.map((m) => (
                  <tr
                    key={m.code}
                    className={cn("border-t border-border", m.sien && "bg-accent/[0.06]")}
                  >
                    <td className="py-1 pr-3 text-foreground">
                      {m.nom}
                      {m.sien ? (
                        <span className="ml-1.5 text-[10px] text-accent">{t("bt_mar_le_tien")}</span>
                      ) : null}
                      {m.moisManquants > 0 ? (
                        <span className="ml-1.5 text-[10px] text-warning">
                          {t("bt_mar_mois_manquants", { n: m.moisManquants })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-3 text-foreground-muted">{m.trades}</td>
                    <td
                      className={cn(
                        "py-1",
                        // ⚠️ Le vert ne récompense pas « le meilleur », il marque
                        // « zéro est hors de l'intervalle », qui est le seul
                        // critère employé partout ailleurs sur cette page.
                        m.insuffisant
                          ? "text-foreground-muted"
                          : m.avantageRetrouve
                            ? "text-profit"
                            : "text-foreground-muted",
                      )}
                    >
                      {m.insuffisant
                        ? t("bt_rob_trop_peu")
                        : `${r(m.esperanceR)} R [${r(m.borneBasse)} ; ${r(m.borneHaute)}]`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 rounded-lg border p-3 text-[11px] leading-relaxed",
          lecture.verdict === "seul_le_sien" || lecture.verdict === "nulle_part"
            ? "border-warning/40 bg-warning/[0.06] text-warning"
            : "border-border bg-surface/40 text-foreground-muted",
        )}
      >
        {lecture.verdict === "seul_le_sien" || lecture.verdict === "nulle_part" ? (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : null}
        {/* ⚠️⚠️ « NULLE PART » EST UNE AFFIRMATION SUR UN ENSEMBLE, et un
            ensemble d'un seul élément n'en supporte aucune. Vu à l'écran sur
            l'or : une seule famille comparable, donc UN marché de comparaison,
            et l'outil concluait tout de même « nulle part ». */}
        {/* ⚠️⚠️ « L'AVANTAGE NE SE RETROUVE NULLE PART » DIT « IL N'Y EN A PAS »
            LÀ OÙ LA MESURE DIT « AUCUN NE LE PROUVE ». Vu à l'écran : trois
            marchés sur quatre penchaient du bon côté, dont un à deux doigts de
            trancher, sous cette phrase-là. C'est la même faute que « l'avantage
            ne se retrouve pas sur la période intacte », corrigée deux jours plus
            tôt sur une autre carte : je n'avais pas cherché les autres copies. */}
        {t(
          lecture.comparaisons === 1
            ? `bt_mar_verdict_${lecture.verdict}_un`
            : lecture.verdict === "nulle_part" && lecture.penchent > 0
              ? "bt_mar_verdict_nulle_part_penchent"
              : `bt_mar_verdict_${lecture.verdict}`,
          {
            retrouves: lecture.retrouves,
            mesurables: lecture.mesurables,
            comparaisons: lecture.comparaisons,
            penchent: lecture.penchent,
          },
        )}
      </p>
    </Card>
  );
}
