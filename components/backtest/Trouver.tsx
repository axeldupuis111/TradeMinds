"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Exploration } from "@/lib/backtest/exploration";
import type { Modification } from "@/lib/backtest/modifications";
import type { PlanComplet } from "@/lib/backtest/plan-complet";
import {
  nommer,
  NOM_CONFIRMATION,
  NOM_DECLENCHEUR,
  NOM_NIVEAU,
  NOM_OBJECTIF,
  NOM_SENS,
  NOM_STOP,
} from "@/lib/backtest/noms";
import { MIN_TRADES_CONCLUSION } from "@/lib/backtest/verdict";
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

/**
 * CE QUE LA CANDIDATE A DÉMONTRÉ, ET RIEN DE PLUS.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR LA VRAIE STRATÉGIE D'AXEL : la confirmation disait
 * « trop peu de trades pour trancher », et juste en dessous l'outil titrait
 * « Ton plan, écrit · Les règles à respecter » puis lui ordonnait de risquer 3 %
 * par trade. Un plan que rien n'a confirmé, présenté comme un plan à suivre,
 * c'est la faute exacte que toute cette architecture existe pour empêcher.
 *
 * Les règles restent affichées : savoir ce que la recherche a trouvé a de la
 * valeur. C'est le TITRE et le CADRE qui changent, et ils changent en premier,
 * au-dessus, là où l'œil tombe.
 */
export type EtatDuPlan = "confirme" | "infirme" | "indecidable" | "sans_confirmation";

export function Trouver({
  exploration,
  fenetreDeConfirmation,
  ecarts,
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
  /** ⚠️ `null` = pas de fenêtre intacte, donc pas de confirmation possible. */
  fenetreDeConfirmation: { de: string; a: string } | null;
  /**
   * Ce qui sépare la combinaison trouvée du plan mesuré en haut de page.
   *
   * ⚠️⚠️ SANS ÇA, DEUX STRATÉGIES SE LISENT COMME UNE SEULE. Vu à l'écran : la
   * carte de cohérence disait « ta règle d'arrêt ne s'est jamais déclenchée » et
   * le plan trouvé disait « elle se serait déclenchée 16 fois », sur le même
   * écran, à propos de la même règle. Les deux étaient justes, sur deux plans
   * différents, et rien ne le disait.
   */
  ecarts: Modification[];
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
        /* ⚠️ Plus de bouton ici : tout ce qui se lance se lance au même endroit,
           plus haut. Un bouton par carte, c'etait sept facons d'effacer le
           travail des six autres. */
        null
      ) : (
        <Resultats exploration={exploration} ecarts={ecarts} libelle={libelle} t={t} />
      )}
    </Card>
  );
}

function Resultats({
  exploration,
  ecarts,
  libelle,
  t,
}: {
  exploration: NonNullable<Parameters<typeof Trouver>[0]["exploration"]>;
  ecarts: Modification[];
  libelle: (dimension: string, etiquette: string) => string;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const { recherche, plan, confirmation } = exploration;

  const etat: EtatDuPlan = !confirmation
    ? "sans_confirmation"
    : confirmation.trades < MIN_TRADES_CONCLUSION
      ? "indecidable"
      : confirmation.verdict === "positif"
        ? "confirme"
        : "infirme";

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

      {/* ── Le plan complet, cadré par ce qu'il a démontré ───────────────── */}
      <PlanEcrit plan={plan} etat={etat} ecarts={ecarts} confirmation={confirmation} t={t} />

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
  etat,
  ecarts,
  confirmation,
  t,
}: {
  plan: PlanComplet;
  etat: EtatDuPlan;
  ecarts: Modification[];
  confirmation: { trades: number } | null;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const confirme = etat === "confirme";
  const traduire = (cle: string, valeurs: Record<string, string | number>) => {
    if (cle === "niveau") return t("bt_plan_niveau", { type: nommer(NOM_NIVEAU, String(valeurs.type), t) });
    if (cle === "declencheur") {
      return t("bt_plan_declencheur", { type: nommer(NOM_DECLENCHEUR, String(valeurs.type), t) });
    }
    if (cle === "sens") return t("bt_plan_sens", { sens: nommer(NOM_SENS, String(valeurs.sens), t) });
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
        {t(confirme ? "bt_plan_titre" : "bt_plan_titre_candidat")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
        {t(confirme ? "bt_plan_intro" : "bt_plan_intro_candidat")}
      </p>

      {/* ⚠️⚠️ CE QUE CES RÈGLES ONT DÉMONTRÉ, AVANT LES RÈGLES ELLES-MÊMES.
          L'ordre de lecture n'est pas un détail de mise en page : un trader qui
          lit quatorze règles impératives avant d'apprendre qu'aucune n'a été
          confirmée les a déjà notées. */}
      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 rounded-lg border p-3 text-xs leading-relaxed",
          confirme
            ? "border-profit/40 bg-profit/[0.06] text-foreground-muted"
            : "border-warning/40 bg-warning/[0.06] text-warning",
        )}
      >
        {confirme ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        <span>{t(`bt_plan_etat_${etat}`, { n: confirmation?.trades ?? 0 })}</span>
      </p>

      {/* ── Et de quel plan on parle, puisqu'il y en a deux à l'écran ────── */}
      <div className="mt-3 rounded-lg border border-border bg-surface/40 p-3">
        <p className="text-[11px] font-medium text-foreground">{t("bt_plan_ecarts_titre")}</p>
        {ecarts.length === 0 ? (
          <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_plan_ecarts_aucun")}
          </p>
        ) : (
          <>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
              {t("bt_plan_ecarts_intro", { n: ecarts.length })}
            </p>
            <ul className="mt-1.5 space-y-1">
              {ecarts.map((e) => (
                <li key={e.cle} className="text-[11px] leading-relaxed text-foreground-muted">
                  {t(`bt_modif_${e.cle}`)} : {e.avant} → {e.apres}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

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
