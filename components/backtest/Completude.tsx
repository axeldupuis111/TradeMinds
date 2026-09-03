"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Completude as CompletudeResultat, EtatReponse } from "@/lib/backtest/completude";
import { QUESTIONS_DECLARATIVES } from "@/lib/backtest/completude";
import { AlertCircle, Check, CircleDashed, ClipboardCheck, Loader2 } from "lucide-react";

/**
 * LES TREIZE QUESTIONS, ET CE QUI MANQUE AU PLAN.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CET ÉCRAN ──────────────────────────────────
 *
 * « D'autres n'ont pas un plan complet, ce qui les empêche de suivre de A à Z
 * leur plan. Je veux que tu définisses avec eux une vraie stratégie. »
 *
 * ── CE QUI REND CET ÉCRAN DIFFÉRENT DE TOUS LES AUTRES DE LA PAGE ───────────
 *
 * ⚠️⚠️ IL NE MESURE RIEN ET IL NE SE TROMPE JAMAIS. Toutes les autres cartes
 * rendent une estimation entourée d'un intervalle ; celle-ci constate qu'une
 * ligne est écrite ou qu'elle ne l'est pas. C'est le seul endroit de la page où
 * l'outil dit quelque chose de certain, et c'est aussi ce qui manque au plus
 * grand nombre.
 *
 * ⚠️⚠️ IL FONCTIONNE POUR UNE MÉTHODE QU'ON NE SAIT PAS REJOUER. Un trader
 * d'orderflow ne verra jamais un backtest de sa méthode et a pourtant les mêmes
 * treize trous à combler.
 *
 * ⚠️ AUCUNE NOTE, AUCUN POURCENTAGE. Un score se compare entre traders et
 * transforme « il me manque l'invalidation » en « je suis à 78 % ».
 */

const ICONE: Record<EtatReponse, typeof Check> = {
  ecrit: Check,
  flou: CircleDashed,
  absent: AlertCircle,
};

const TON: Record<EtatReponse, string> = {
  ecrit: "text-profit",
  flou: "text-warning",
  absent: "text-loss",
};

export function Completude({
  completude,
  reponses,
  onEnregistrer,
  peutEnregistrer,
  etat,
  t,
}: {
  completude: CompletudeResultat;
  /** Les réponses déjà enregistrées, par code de question. */
  reponses: Record<string, string>;
  /**
   * ⚠️ UN SEUL ENREGISTREMENT EXPLICITE, jamais à la frappe : ces réponses vont
   * dans `raw_text`, c'est-à-dire dans le texte que le trader a écrit lui-même
   * et que le coach relit.
   */
  onEnregistrer: (reponses: Record<string, string>) => void;
  /**
   * ⚠️ FAUX QUAND AUCUNE FICHE N'EST CHOISIE. Le bouton était proposé quand même
   * et ne faisait rien du tout : un clic sans effet et sans message est pire
   * qu'un bouton grisé, parce que le trader croit avoir enregistré.
   */
  peutEnregistrer: boolean;
  etat: "repos" | "encours" | "fait" | "erreur";
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const [brouillon, setBrouillon] = useState<Record<string, string>>(reponses);
  const [ouverte, setOuverte] = useState<string | null>(null);

  /**
   * ⚠️⚠️ SANS CET EFFET, LES RÉPONSES DÉJÀ ÉCRITES N'APPARAISSENT JAMAIS.
   * `useState(reponses)` ne lit sa valeur initiale qu'au premier rendu, et la
   * fiche arrive de la base APRÈS ce rendu-là. Le trader rouvrait la page et
   * retrouvait ses treize champs vides, avec ses réponses pourtant enregistrées.
   *
   * `reponses` ne change qu'au chargement d'une fiche et après un enregistrement
   * réussi (où le brouillon lui est déjà égal) : écraser la saisie en cours est
   * donc impossible.
   */
  useEffect(() => {
    setBrouillon(reponses);
  }, [reponses]);

  const modifie = QUESTIONS_DECLARATIVES.some(
    (c) => (brouillon[c] ?? "").trim() !== (reponses[c] ?? "").trim(),
  );

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ClipboardCheck className="h-4 w-4" />
        {t("bt_etape_completude")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_comp_intro")}</p>
      <p className="mt-1.5 text-[11px] tabular-nums text-foreground-muted">
        {[
          t(completude.ecrits === 1 ? "bt_comp_ecrit" : "bt_comp_ecrits", { n: completude.ecrits }),
          t(completude.flous === 1 ? "bt_comp_flou" : "bt_comp_flous", { n: completude.flous }),
          t(completude.absents === 1 ? "bt_comp_absent" : "bt_comp_absents", {
            n: completude.absents,
          }),
        ].join(" · ")}
      </p>

      <ol className="mt-3 space-y-1">
        {completude.lignes.map((l, i) => {
          const Icone = ICONE[l.etat];
          const modifiable = QUESTIONS_DECLARATIVES.includes(l.code);
          const estOuverte = ouverte === l.code;
          return (
            <li key={l.code} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setOuverte(estOuverte ? null : l.code)}
                className="flex w-full items-start gap-2.5 p-2.5 text-left hover:bg-accent/[0.04]"
              >
                <span className="mt-0.5 w-4 shrink-0 text-[11px] tabular-nums text-foreground-muted">
                  {i + 1}
                </span>
                <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", TON[l.etat])} />
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground">{t(`bt_q_${l.code}`)}</span>{" "}
                  <span className={cn("text-[11px] font-normal", TON[l.etat])}>
                    · {t(`bt_q_etat_${l.etat}`)}
                  </span>
                  <span className="ml-1 text-[11px] text-foreground-muted">
                    ({t(`bt_q_source_${l.source}`)})
                  </span>
                </span>
              </button>

              {estOuverte ? (
                <div className="border-t border-border p-3">
                  <p className="text-[11px] leading-relaxed text-foreground-muted">
                    {t(`bt_q_${l.code}_aide`)}
                  </p>

                  {/* ⚠️ ON NE REND QUE CE QUE LE RÉFÉRENTIEL DÉCLARE. Fabriquer
                      une réponse de référence en prose serait un conseil
                      d'investissement déguisé en aide au remplissage. */}
                  {l.reference ? (
                    <p className="mt-2 rounded-lg border border-border bg-surface/40 p-2 text-[11px] leading-relaxed text-foreground-muted">
                      {t(l.reference.cle, l.reference.valeurs)}
                    </p>
                  ) : null}

                  {modifiable ? (
                    <textarea
                      value={brouillon[l.code] ?? ""}
                      onChange={(e) =>
                        setBrouillon((b) => ({ ...b, [l.code]: e.target.value }))
                      }
                      rows={2}
                      placeholder={t("bt_comp_placeholder")}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                    />
                  ) : (
                    <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
                      {t("bt_comp_vient_du_plan")}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!peutEnregistrer || !modifie || etat === "encours"}
          onClick={() => onEnregistrer(brouillon)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {etat === "encours" ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("bt_comp_encours")}
            </span>
          ) : (
            t("bt_comp_enregistrer")
          )}
        </button>
        {etat === "fait" && !modifie ? (
          <span className="text-[11px] text-profit">{t("bt_comp_fait")}</span>
        ) : null}
        {etat === "erreur" ? (
          <span className="text-[11px] text-loss">{t("bt_comp_erreur")}</span>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
        {t(peutEnregistrer ? "bt_comp_ou_ca_va" : "bt_comp_sans_fiche")}
      </p>

      {/* ⚠️ AUCUNE NOTE, ET C'EST DIT À L'ÉCRAN. Un score de complétude se
          compare entre traders, se capture en photo, et transforme « il me
          manque l'invalidation » en « je suis à 78 % ». */}
      <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_comp_note_absente")}
      </p>
    </Card>
  );
}
