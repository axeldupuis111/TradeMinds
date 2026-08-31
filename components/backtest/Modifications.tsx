"use client";

import { Card } from "@/components/ui/Card";
import { BLOC_I18N, type Modification } from "@/lib/backtest/modifications";
import { Eye, RotateCcw, Sliders, Wand2 } from "lucide-react";

/**
 * L'ÉCART ENTRE LA FICHE ET LE PLAN TESTÉ, LIGNE PAR LIGNE.
 *
 * ── D'OÙ VIENT CETTE CARTE ──────────────────────────────────────────────────
 *
 * D'une phrase d'utilisateur : « j'ai accepté qu'il modifie un réglage sans trop
 * savoir exactement ce qu'il a changé et ce que je dois changer dans ma façon de
 * trader ». Elle décrit deux manques distincts, et la carte doit répondre aux
 * deux séparément :
 *
 * - CE QUI A CHANGÉ : le nom du réglage, sa valeur avant, sa valeur après. Un
 *   fait, en une ligne.
 * - CE QUE ÇA CHANGE POUR LUI : la même chose dite en gestes, devant un
 *   graphique. C'est la partie qui manquait entièrement, et c'est la seule qui
 *   serve une fois la page fermée.
 *
 * ⚠️ L'ORIGINE EST AFFICHÉE, ET AU NOM DE L'OBJECTIF, PAS DU RÉSULTAT. Une
 * proposition a été retenue parce qu'elle produisait plus de trades, ou moins de
 * recul, ou des coûts plus légers. Jamais parce qu'elle rapportait davantage :
 * le code s'interdit de lire l'espérance. Rappeler l'objectif ici est ce qui
 * empêche de relire après coup « il m'a proposé un réglage plus rentable », qui
 * serait faux et qui est précisément la pente du sur-apprentissage.
 *
 * ⚠️ CHAQUE LIGNE S'ANNULE SEULE. Un bloc « tout ou rien » forcerait le trader à
 * jeter trois réglages qu'il assume pour en retirer un dont il doute.
 */
export function Modifications({
  modifications,
  onAnnuler,
  onToutAnnuler,
  t,
}: {
  modifications: Modification[];
  onAnnuler: (cle: string) => void;
  onToutAnnuler: () => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("bt_modif_titre")}</h4>
          {modifications.length > 0 ? (
            <p className="mt-0.5 text-xs tabular-nums text-foreground-muted">
              {t("bt_modif_compte", { n: modifications.length })}
            </p>
          ) : null}
        </div>
        {modifications.length > 0 ? (
          <button
            type="button"
            onClick={onToutAnnuler}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
          >
            {t("bt_modif_tout_annuler")}
          </button>
        ) : null}
      </div>

      {modifications.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
          {t("bt_modif_aucune")}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            {t("bt_modif_intro")}
          </p>

          <ul className="mt-4 space-y-3">
            {modifications.map((m) => (
              <li key={m.cle} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{t(`bt_modif_${m.cle}`)}</p>
                    {/* ⚠️ La ligne « d'autres réglages diffèrent » ne porte
                        aucune valeur : afficher « non défini → non défini »
                        ferait passer un aveu d'ignorance pour une mesure. */}
                    {m.cle === "autre" ? null : (
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground-muted">
                        {m.avant} → {m.apres}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAnnuler(m.cle)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("bt_modif_annuler")}
                  </button>
                </div>

                {/* ⚠️ LA PARTIE QUI MANQUAIT. Tout le reste de cette ligne
                    décrit un paramètre de moteur ; celle-ci décrit un geste. */}
                <div className="mt-2 rounded-md bg-surface/40 p-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                    <Eye className="h-3 w-3" />
                    {t("bt_modif_geste_titre")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                    {t(`bt_geste_${m.cle}`, { avant: m.avant, apres: m.apres })}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
                  {m.origine === "proposition" && m.objectif ? (
                    <span className="flex items-center gap-1">
                      <Wand2 className="h-3 w-3" />
                      {t("bt_modif_origine_proposition", {
                        objectif: t(`bt_prop_objectif_${m.objectif}`),
                      })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Sliders className="h-3 w-3" />
                      {t("bt_modif_origine_manuel")}
                    </span>
                  )}
                  {BLOC_I18N[m.bloc] ? (
                    <span>{t("bt_modif_editeur", { bloc: t(BLOC_I18N[m.bloc]) })}</span>
                  ) : null}
                </div>

                {m.origine === "proposition" ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-foreground-muted">
                    {t("bt_modif_pourquoi_proposition")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ⚠️ EN TEXTE VISIBLE, JAMAIS DERRIÈRE UN LIEN. C'est la règle posée pour
          la conformité éditeur, et elle vaut d'autant plus ici : cette carte est
          l'endroit exact où un trader s'apprête à reporter un chiffre de
          backtest dans sa façon de trader pour de vrai. */}
      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_modif_avertissement")}
      </p>
    </Card>
  );
}
