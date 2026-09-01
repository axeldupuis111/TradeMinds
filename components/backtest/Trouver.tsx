"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Exploration } from "@/lib/backtest/exploration";
import type { PlanComplet } from "@/lib/backtest/plan-complet";
import {
  nommer,
  NOM_CONFIRMATION,
  NOM_DECLENCHEUR,
  NOM_NIVEAU,
  NOM_OBJECTIF,
  NOM_STOP,
} from "@/lib/backtest/noms";
import { AlertTriangle, CheckCircle2, Compass, ClipboardList } from "lucide-react";

/**
 * TROUVER CE QUI POURRAIT MARCHER, ET EN SORTIR UN PLAN À RESPECTER.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CET ÉCRAN ─────────────────────────────────
 *
 * « Je ne vois toujours pas l'utilité de l'onglet backtest. On voit si c'est
 * rentable ou non, mais ça ne donne aucune vraie solution. Ça nous décourage, on
 * a l'impression que n'importe quelle stratégie n'est pas rentable. Les
 * utilisateurs ont un seul objectif : trouver une stratégie rentable, améliorer
 * la leur, et mettre en place un plan complet pour être disciplinés. »
 *
 * Il avait raison. L'outil savait dire non et ne savait rien proposer.
 *
 * ── LES QUATRE TEMPS, ET AUCUN N'EST FACULTATIF ─────────────────────────────
 *
 * 1. **On cherche**, sur la fenêtre testée uniquement.
 * 2. **On compte les essais, et la barre monte avec.** Le maximum de N tirages
 *    de hasard pur vaut √(2 ln N) écarts-types : c'est ce qu'on exige.
 * 3. **On montre TOUT**, retenus et écartés. Une recherche dont on ne verrait
 *    que le gagnant serait indiscernable d'une recherche truquée.
 * 4. **On confirme une seule fois**, sur la fenêtre jamais ouverte.
 *
 * ⚠️ « RIEN NE PASSE » EST LE RÉSULTAT LE PLUS FRÉQUENT, et l'écran le dit sans
 * s'excuser. Mais c'est désormais un « non » qui a essayé trente-neuf
 * combinaisons et les montre toutes, au lieu d'un « non » qui n'a rien tenté.
 * C'est exactement la différence que le trader réclamait.
 */

function r(v: number | null | undefined, d = 3): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
}

export function Trouver({
  exploration,
  enCours,
  fenetreDeConfirmation,
  onChercher,
  t,
}: {
  exploration:
    | {
        recherche: Exploration;
        plan: PlanComplet;
        confirmation: {
          de: string;
          a: string;
          trades: number;
          esperanceR: number | null;
          borneBasse: number | null;
          borneHaute: number | null;
          verdict: string;
        } | null;
      }
    | undefined;
  enCours: boolean;
  /** ⚠️ `null` = pas de fenêtre intacte, donc pas de confirmation possible. */
  fenetreDeConfirmation: { de: string; a: string } | null;
  onChercher: () => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  /** Une étiquette d'essai : soit une clé de traduction, soit un code de bloc. */
  const libelle = (dimension: string, etiquette: string): string => {
    if (etiquette.startsWith("bt_")) return t(etiquette);
    if (dimension === "declencheur") return nommer(NOM_DECLENCHEUR, etiquette, t);
    if (dimension === "niveau") return nommer(NOM_NIVEAU, etiquette, t);
    if (dimension === "confluence") return nommer(NOM_CONFIRMATION, etiquette, t);
    return etiquette;
  };

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Compass className="h-4 w-4" />
        {t("bt_exp_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_exp_intro")}</p>

      {/* ⚠️ SANS FENÊTRE INTACTE, ON NE CHERCHE PAS. Chercher sans pouvoir
          confirmer, c'est fabriquer une candidate sans jamais l'éprouver : la
          pire chose que cet écran puisse produire. */}
      {!fenetreDeConfirmation ? (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-xs leading-relaxed text-warning">
          {t("bt_hors_aucune")}
        </p>
      ) : !exploration ? (
        <button
          type="button"
          disabled={enCours}
          onClick={onChercher}
          className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {enCours ? t("bt_exp_encours") : t("bt_exp_lancer")}
        </button>
      ) : (
        <Resultats exploration={exploration} libelle={libelle} t={t} />
      )}
    </Card>
  );
}

function Resultats({
  exploration,
  libelle,
  t,
}: {
  exploration: NonNullable<Parameters<typeof Trouver>[0]["exploration"]>;
  libelle: (dimension: string, etiquette: string) => string;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const { recherche, plan, confirmation } = exploration;

  return (
    <>
      {/* ⚠️ LE BUDGET DE RECHERCHE, DIT AVANT LE RÉSULTAT. Un chiffre trouvé
          après trente-neuf essais ne se lit pas comme un chiffre trouvé du
          premier coup, et l'ordre de lecture doit l'imposer. */}
      <p className="mt-3 rounded-lg border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_exp_regle", { n: recherche.essais, barre: recherche.barre.toFixed(2) })}
      </p>
      <p className="mt-2 text-[11px] tabular-nums text-foreground-muted">
        {t("bt_exp_essais", {
          n: recherche.essais,
          barre: recherche.barre.toFixed(2),
          t: recherche.t == null ? "—" : recherche.t.toFixed(2),
        })}
      </p>

      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 rounded-lg border p-3 text-xs leading-relaxed",
          recherche.franchitLaBarre
            ? "border-profit/40 bg-profit/[0.06] text-foreground-muted"
            : "border-border bg-surface/40 text-foreground-muted",
        )}
      >
        {recherche.franchitLaBarre ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        )}
        {t(
          recherche.t == null
            ? "bt_exp_sans_chiffre"
            : recherche.franchitLaBarre
              ? "bt_exp_franchie"
              : "bt_exp_pas_franchie",
        )}
      </p>

      {/* ── La confirmation, quand elle a eu lieu ─────────────────────────── */}
      {confirmation ? (
        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-foreground">{t("bt_exp_confirmation_titre")}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-muted">
            {t(
              confirmation.trades < 100
                ? "bt_exp_confirmation_trop_peu"
                : confirmation.verdict === "positif"
                  ? "bt_exp_confirmation_ok"
                  : "bt_exp_confirmation_non",
              {
                periode: `${confirmation.de} → ${confirmation.a}`,
                r: r(confirmation.esperanceR),
                n: confirmation.trades,
                bas: r(confirmation.borneBasse),
                haut: r(confirmation.borneHaute),
              },
            )}
          </p>
        </div>
      ) : null}

      {/* ── Le plan complet ──────────────────────────────────────────────── */}
      <PlanEcrit plan={plan} t={t} />

      {/* ── Le journal : tout, retenu ou non ─────────────────────────────── */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium text-foreground">{t("bt_exp_journal")}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
          {t("bt_exp_journal_intro")}
        </p>
        <div className="mt-2 max-h-80 overflow-auto">
          <table className="w-full min-w-[24rem] text-[11px] tabular-nums">
            <tbody>
              {recherche.journal.map((e, i) => (
                <tr
                  key={`${e.dimension}-${e.etiquette}-${i}`}
                  className={cn("border-t border-border", e.retenu && "bg-accent/[0.06]")}
                >
                  <td className="py-1 pr-3 text-foreground-muted">
                    {t(`bt_exp_dim_${e.dimension}`)}
                  </td>
                  <td className="py-1 pr-3 text-foreground">
                    {libelle(e.dimension, e.etiquette)}
                    {e.retenu ? (
                      <span className="ml-1.5 text-[10px] text-accent">{t("bt_plan_retenu")}</span>
                    ) : null}
                  </td>
                  <td className="py-1 pr-3 text-foreground-muted">{e.trades}</td>
                  <td className="py-1 text-foreground-muted">
                    {e.t == null ? t("bt_rob_trop_peu") : `t = ${e.t.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/**
 * LE PLAN ÉCRIT.
 *
 * ⚠️ CE QUI EST DÉDUIT DE LA MESURE EST MARQUÉ COMME TEL. « Ton stop se place
 * derrière le dernier sommet » est une recopie de son réglage ; « attends-toi à
 * onze pertes d'affilée » est une découverte, et les deux ne se lisent pas avec
 * le même poids.
 */
function PlanEcrit({
  plan,
  t,
}: {
  plan: PlanComplet;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const traduire = (cle: string, valeurs: Record<string, string | number>) => {
    if (cle === "niveau") return t("bt_plan_niveau", { type: nommer(NOM_NIVEAU, String(valeurs.type), t) });
    if (cle === "declencheur") {
      return t("bt_plan_declencheur", { type: nommer(NOM_DECLENCHEUR, String(valeurs.type), t) });
    }
    if (cle === "stop") return t("bt_plan_stop", { type: nommer(NOM_STOP, String(valeurs.type), t) });
    if (cle === "objectif") {
      return t("bt_plan_objectif", {
        type: nommer(NOM_OBJECTIF, String(valeurs.type), t),
        r: valeurs.r,
      });
    }
    if (cle === "confirmations") {
      if (!valeurs.n) return t("bt_plan_confirmations_aucune");
      const liste = String(valeurs.liste)
        .split(", ")
        .map((x) => nommer(NOM_CONFIRMATION, x, t))
        .join(", ");
      return t("bt_plan_confirmations", { liste });
    }
    return t(`bt_plan_${cle}`, valeurs);
  };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ClipboardList className="h-4 w-4" />
        {t("bt_plan_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_plan_intro")}</p>

      <ol className="mt-3 space-y-2">
        {plan.lignes.map((l) => (
          <li key={l.cle} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 text-xs leading-relaxed text-foreground">
              {traduire(l.cle, l.valeurs)}
              {l.deduite ? (
                <span className="ml-1.5 text-[10px] text-foreground-muted">
                  ({t("bt_plan_deduit")})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {/* ⚠️ LE TABLEAU DES RISQUES NE RECOMMANDE RIEN, IL MONTRE. Un risque
          « optimal » calculé sur le passé est la façon la plus rapide de faire
          sauter un compte sur l'avenir : le trader tranche lui-même. */}
      <p className="mt-4 text-xs font-medium text-foreground">{t("bt_plan_risques_titre")}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_plan_risques_intro")}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[18rem] text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-foreground-muted">
              <th className="py-1 pr-3 font-normal">{t("bt_plan_risque_col")}</th>
              <th className="py-1 font-normal">{t("bt_plan_recul_col")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.risques.map((x) => (
              <tr
                key={x.risquePct}
                className={cn(
                  "border-t border-border",
                  x.risquePct === plan.risqueRecommandePct && "bg-accent/[0.06]",
                )}
              >
                <td className="py-1 pr-3 text-foreground">
                  {x.risquePct} %
                  {x.risquePct === plan.risqueRecommandePct ? (
                    <span className="ml-1.5 text-[10px] text-accent">{t("bt_plan_retenu")}</span>
                  ) : null}
                </td>
                <td className={cn("py-1", x.ruine || x.reculPct > plan.seuilReculPct ? "text-loss" : "text-foreground-muted")}>
                  {x.ruine ? t("bt_plan_ruine") : `-${x.reculPct.toFixed(1)} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
