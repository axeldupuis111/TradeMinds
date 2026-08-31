"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Concentration } from "@/lib/backtest/robustesse";
import type { Stabilite } from "@/lib/backtest/stabilite";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";

/**
 * D'OÙ VIENT CE RÉSULTAT, ET TIENDRAIT-IL SI ON BOUGEAIT UN PEU.
 *
 * ── DEUX QUESTIONS QUE PERSONNE NE POSE, ET QUI DÉCIDENT DE TOUT ────────────
 *
 * 1. **DANS LE TEMPS.** « +0,4 R sur quatre ans » se lit comme une propriété de
 *    la méthode. Ça peut aussi être quatre ans de rien plus un mois de mars où
 *    tout est arrivé : même chiffre, pas du tout la même chose. Le premier se
 *    retrade, le second était une occasion.
 * 2. **DANS LE RÉGLAGE.** Un réglage qui ne marche qu'à UNE valeur exacte n'a
 *    pas été trouvé, il a été rencontré. Le marché ne sait pas qu'un sommet doit
 *    dominer exactement dix bougies plutôt que neuf ou onze.
 *
 * ⚠️ AUCUNE DES DEUX N'EST UN VERDICT DE RENTABILITÉ, et l'écran ne doit jamais
 * laisser croire le contraire. Elles répondent à « méthode ou accident », ce qui
 * est une question différente et préalable.
 *
 * ⚠️ LE VOISINAGE N'A AUCUN BOUTON. Pas une seule de ses valeurs n'est
 * applicable d'un clic : ce serait transformer un garde-fou contre le
 * sur-apprentissage en machine à le produire. Un test lit `stabilite.ts` pour
 * s'assurer qu'il ne rend même pas de plan.
 */

function signe(v: number | null | undefined, d = 2): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
}

export function Robustesse({
  concentration,
  stabilite,
  peutMesurerStabilite,
  mesureEnCours,
  onMesurerStabilite,
  t,
}: {
  concentration: Concentration | null;
  stabilite: Stabilite[] | undefined;
  /** Faux quand aucun réglage changé ne se prête au voisinage. */
  peutMesurerStabilite: boolean;
  mesureEnCours: boolean;
  onMesurerStabilite: () => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (!concentration) return null;
  const c = concentration;

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Activity className="h-4 w-4" />
        {t("bt_rob_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_rob_intro")}</p>

      {/* ── 1. Dans le temps ─────────────────────────────────────────────── */}
      <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {t("bt_rob_temps")}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-foreground-muted">
              <th className="py-1 pr-3 font-normal">{t("bt_rob_annee")}</th>
              <th className="py-1 pr-3 font-normal">{t("bt_rob_trades")}</th>
              <th className="py-1 font-normal">{t("bt_rob_totalr")}</th>
            </tr>
          </thead>
          <tbody>
            {c.annees.map((a) => (
              <tr key={a.cle} className="border-t border-border">
                <td className="py-1 pr-3 text-foreground">{a.cle}</td>
                <td className="py-1 pr-3 text-foreground-muted">{a.trades}</td>
                <td
                  className={cn(
                    "py-1 font-medium",
                    a.totalR > 0 ? "text-profit" : a.totalR < 0 ? "text-loss" : "text-foreground-muted",
                  )}
                >
                  {signe(a.totalR)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_rob_annees_positives", { n: c.anneesPositives, total: c.annees.length })}
      </p>

      {/* ⚠️ LE CHIFFRE LE PLUS PARLANT DE LA CARTE. Un mois qui porte tout le
          résultat ne se voit dans aucune statistique globale, et c'est
          exactement ce qui distingue une méthode d'une occasion. */}
      {c.meilleurMois ? (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3",
            c.tientSansSonMeilleurMois
              ? "border-border bg-surface/40"
              : "border-warning/40 bg-warning/[0.06]",
          )}
        >
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed">
            {c.tientSansSonMeilleurMois ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            )}
            <span className={c.tientSansSonMeilleurMois ? "text-foreground-muted" : "text-warning"}>
              {t(
                c.tientSansSonMeilleurMois ? "bt_rob_tient" : "bt_rob_ne_tient_pas",
                {
                  mois: c.meilleurMois,
                  part: c.partDuMeilleurMois.toFixed(0),
                  total: signe(c.totalR),
                  sans: signe(c.totalSansLeMeilleurMoisR),
                },
              )}
            </span>
          </p>
        </div>
      ) : null}

      {/* ── 2. Dans le réglage ───────────────────────────────────────────── */}
      {peutMesurerStabilite ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground">{t("bt_rob_reglage")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_rob_reglage_pourquoi")}
          </p>

          {!stabilite ? (
            <button
              type="button"
              disabled={mesureEnCours}
              onClick={onMesurerStabilite}
              className="mt-2.5 rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {mesureEnCours ? t("bt_rob_mesure_encours") : t("bt_rob_mesurer")}
            </button>
          ) : (
            stabilite.map((s) => (
              <div key={s.cle} className="mt-3">
                <p className="text-[11px] font-medium text-foreground">{t(`bt_modif_${s.cle}`)}</p>
                <div className="mt-1.5 overflow-x-auto">
                  <table className="w-full min-w-[24rem] text-[11px] tabular-nums">
                    <thead>
                      <tr className="text-left text-foreground-muted">
                        <th className="py-1 pr-3 font-normal">{t("bt_rob_valeur")}</th>
                        <th className="py-1 pr-3 font-normal">{t("bt_rob_trades")}</th>
                        <th className="py-1 font-normal">{t("bt_rob_esperance")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.points.map((p) => (
                        <tr
                          key={p.valeur}
                          className={cn(
                            "border-t border-border",
                            // ⚠️ ON MET EN AVANT LA VALEUR DU TRADER, jamais la
                            // meilleure. Souligner le meilleur voisin ferait de
                            // ce tableau une recommandation déguisée.
                            p.sienne && "bg-accent/[0.06]",
                          )}
                        >
                          <td className="py-1 pr-3 text-foreground">
                            {p.valeur}
                            {p.sienne ? (
                              <span className="ml-1.5 text-[10px] text-accent">
                                {t("bt_rob_la_tienne")}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-1 pr-3 text-foreground-muted">{p.trades}</td>
                          <td className="py-1 text-foreground-muted">
                            {p.esperanceR == null
                              ? t("bt_rob_trop_peu")
                              : `${signe(p.esperanceR, 3)} R [${signe(p.borneBasse, 3)} ; ${signe(p.borneHaute, 3)}]`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[11px] leading-relaxed",
                    s.forme === "pic_isole" ? "text-warning" : "text-foreground-muted",
                  )}
                >
                  {t(`bt_rob_forme_${s.forme}`)}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </Card>
  );
}
