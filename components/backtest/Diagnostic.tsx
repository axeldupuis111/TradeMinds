"use client";

import { Card } from "@/components/ui/Card";
import type { Diagnostic as UnDiagnostic } from "@/lib/backtest/diagnostic";
import { BLOC_I18N } from "@/lib/backtest/modifications";
import { nommerUnChamp } from "@/lib/backtest/phrases";
import { CheckCircle2, Stethoscope, Wrench } from "lucide-react";

/**
 * CE QUI NE FONCTIONNE PAS, ET OÙ LE CHANGER.
 *
 * ── D'OÙ VIENT CETTE CARTE ──────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE REPROCHE D'AXEL, FORMULÉ TROIS FOIS :
 *
 *   « Je vois que ma stratégie n'est pas rentable, mais ça me dit pas
 *     concrètement ce qui ne fonctionne pas, ce qu'il faut changer pour
 *     réussir. Si au backtest ce n'est pas rentable, ça ne donne pas envie de
 *     trader cette stratégie. »
 *
 * La page savait MESURER et BALAYER. Elle ne savait pas DIAGNOSTIQUER, et c'est
 * la seule des trois qui répond à sa question.
 *
 * ── LA RÈGLE DE CETTE CARTE ─────────────────────────────────────────────────
 *
 * ⚠️ CHAQUE LIGNE NOMME UN MÉCANISME, PORTE SON CHIFFRE, ET DÉSIGNE UN BLOC.
 * « Tes perdants montaient à +1.4 R avant de revenir » dit ce qui se passe ;
 * « c'est le bloc Sorties supplémentaires qui décide de ça » dit où agir. Sans
 * le second, le trader lit un constat de plus.
 *
 * ⚠️ AUCUNE NE PROMET QUE LE CHANGEMENT SUFFIRA, et un test l'interdit. Le
 * rappel du coût d'un essai est en bas de la carte, pas en option.
 */
export function Diagnostic({
  diagnostics,
  onAller,
  t,
}: {
  diagnostics: UnDiagnostic[];
  /** Fait remonter le bloc concerné dans l'éditeur. */
  onAller: (bloc: string) => void;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Stethoscope className="h-4 w-4 text-accent" />
        {t("bt_diag_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_diag_intro")}</p>

      {diagnostics.length === 0 ? (
        /* ⚠️ « RIEN TROUVÉ » N'EST PAS « TOUT VA BIEN », et le dire autrement
           serait le mensonge le plus facile de cette carte. */
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface/40 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
          <p className="text-xs leading-relaxed text-foreground-muted">{t("bt_diag_aucun")}</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {diagnostics.map((d) => (
              <li key={d.code} className="rounded-lg border border-border p-3">
                <p className="text-xs leading-relaxed text-foreground">
                  {t(`bt_diag_${d.code}`, d.valeurs)}
                </p>
                {BLOC_I18N[d.bloc] ? (
                  <button
                    type="button"
                    onClick={() => onAller(d.bloc)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
                  >
                    <Wrench className="h-3 w-3" />
                    {t("bt_modif_editeur", { bloc: nommerUnChamp(d.bloc, t) })}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {/* ⚠️ CE QUE ÇA COÛTE, SOUS LA LISTE ET PAS AILLEURS. Six pistes
              affichées d'un coup sont six occasions de balayer : le rappel de
              la barre doit être là où le trader décide. */}
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-[11px] leading-relaxed text-warning">
            {t("bt_diag_essai")}
          </p>
        </>
      )}
    </Card>
  );
}
