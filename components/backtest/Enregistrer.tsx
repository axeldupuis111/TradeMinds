"use client";

import { Card } from "@/components/ui/Card";
import type { Fenetre } from "@/lib/backtest/hors-periode";
import { MOIS_MIN_CONTROLE } from "@/lib/backtest/hors-periode";
import type { LectureBacktest } from "@/lib/backtest/verdict";
import { MIN_TRADES_CONCLUSION } from "@/lib/backtest/verdict";
import { AlertTriangle, CheckCircle2, CalendarRange, Save, ShieldQuestion } from "lucide-react";

/**
 * LE PAS QUI ENGAGE : CONTRÔLER, PUIS ENREGISTRER.
 *
 * ── POURQUOI LE CONTRÔLE EST UNE CONDITION ET PAS UN CONSEIL ────────────────
 *
 * Un trader nous a écrit avoir accepté une proposition, obtenu beaucoup plus de
 * trades, et constaté que « comme ça c'est beaucoup plus rentable ». Ce constat
 * est sincère et il est piégé : la proposition avait été retenue pour un
 * objectif de NOMBRE de trades, le code s'interdisant de lire l'espérance. C'est
 * donc le trader qui, en la gardant pour son rendement, a fait le choix par la
 * performance, sur une période qu'il avait déjà vue.
 *
 * Ce n'est pas une faute, c'est le réflexe le plus naturel du monde, et c'est
 * exactement ce que ce chantier a mesuré : le meilleur de neuf mécanisations
 * donnait +0,397 R sur 2024-2025, et +0,002 R sur 2022-2023, période jamais
 * ouverte. Un écran qui laisserait inscrire le premier chiffre dans une fiche de
 * stratégie sans jamais montrer le second serait une machine à graver du
 * sur-apprentissage dans la méthode de quelqu'un.
 *
 * D'où la règle : le bouton d'enregistrement reste inerte tant que le plan n'a
 * pas été rejoué sur une fenêtre intacte. ⚠️ Le contrôle N'A PAS À ÊTRE
 * CONCLUANT pour débloquer : un résultat décevant reste une information, et
 * exiger un bon résultat serait remettre la sélection par la performance à
 * l'endroit précis qu'on cherche à protéger. Ce qui est exigé, c'est de l'avoir
 * REGARDÉ.
 */

export type EtatControle =
  | { phase: "repos" }
  | { phase: "encours" }
  | { phase: "fait"; fenetre: Fenetre; lecture: LectureBacktest; valide: boolean }
  | { phase: "erreur" };

function chiffres(l: LectureBacktest): { trades: number; esperance: string; intervalle: [string, string] } | null {
  if (!l.stats) return null;
  const s = l.stats;
  return {
    trades: s.nbTrades,
    esperance: s.esperanceR.toFixed(3),
    intervalle: [s.borneBasse.toFixed(3), s.borneHaute.toFixed(3)],
  };
}

/**
 * Ce que le contrôle apprend, en une phrase.
 *
 * ⚠️ « TROP PEU DE TRADES » N'EST PAS UN DEMI-SUCCÈS. Sur une fenêtre intacte
 * trop courte, le plan ne dit rien, et l'écran doit le dire ainsi plutôt que de
 * laisser un silence que le trader lira comme une absence de mauvaise nouvelle.
 */
function verdictDuControle(l: LectureBacktest): string {
  if (!l.stats || l.stats.nbTrades < MIN_TRADES_CONCLUSION) return "bt_hors_trop_peu";
  if (l.stats.borneHaute < 0) return "bt_hors_negatif";
  if (l.stats.borneBasse > 0) return "bt_hors_survit";
  return "bt_hors_ne_survit_pas";
}

export function Enregistrer({
  fenetre,
  periodeSuggeree,
  controleRequis,
  aDesModifications,
  controle,
  lectureActuelle,
  periode,
  peutEnregistrer,
  verifie,
  apercuFiche,
  champsRepris,
  champsNonRepris,
  sauvegarde,
  onRaccourcir,
  onEnregistrer,
  t,
}: {
  /** La fenêtre intacte disponible, ou null s'il n'en reste aucune. */
  fenetre: Fenetre | null;
  /**
   * La fenêtre de test à proposer quand il n'en reste aucune d'intacte.
   *
   * ⚠️ SANS ELLE, LA RÈGLE EST UN MUR. Vu en vrai : un trader teste sur toute la
   * profondeur disponible, il ne reste rien à contrôler, et le bouton
   * d'enregistrement ne se débloque plus jamais. Lui dire « refais un test plus
   * court » sans rien lui offrir pour le faire, c'est le laisser dans l'impasse.
   */
  periodeSuggeree: { de: string; a: string } | null;
  /**
   * Faux quand aucun changement ne touche un seul trade (baisser son risque par
   * exemple). Rejouer la même suite de R ailleurs ne vérifierait rien, et une
   * vérification vide apprend surtout à cliquer sans lire.
   *
   * ⚠️⚠️ CE DRAPEAU NE GOUVERNE QUE LE VERROU D'ENREGISTREMENT, JAMAIS L'ACCÈS
   * AU CONTRÔLE. Une première version cachait le bouton quand le contrôle
   * n'était pas exigé : sur un plan identique à la fiche, il devenait donc
   * introuvable, alors que la synthèse annonçait juste au-dessus « c'est le
   * contrôle qui manque, et c'est le plus important de tous ». Deux cartes du
   * même écran se contredisaient, et celle qui avait raison était désarmée.
   */
  controleRequis: boolean;
  /** Vrai dès qu'un réglage s'écarte de la fiche. */
  aDesModifications: boolean;
  controle: EtatControle;
  lectureActuelle: LectureBacktest;
  periode: { de: string; a: string };
  /** Faux tant qu'il n'y a rien à enregistrer (aucun écart avec la fiche). */
  peutEnregistrer: boolean;
  /** Le trader a-t-il regardé les aperçus et reconnu sa méthode ? */
  verifie: boolean;
  /** Le texte exact qui sera ajouté à la fiche, montré avant d'écrire. */
  apercuFiche: string;
  champsRepris: string[];
  champsNonRepris: string[];
  sauvegarde: "repos" | "encours" | "ok" | "erreur";
  /** Raccourcit la période testée et relance, pour libérer une fenêtre intacte. */
  onRaccourcir: (periode: { de: string; a: string }) => void;
  onEnregistrer: () => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const controleFait = controle.phase === "fait" && controle.valide;
  const bloquant = !verifie
    ? t("bt_sauver_bloque_verifie")
    : controleRequis && !controleFait
      ? t("bt_sauver_bloque")
      : null;

  const ici = chiffres(lectureActuelle);
  const sansFenetre = fenetre === null || fenetre.mois < MOIS_MIN_CONTROLE;

  return (
    <Card className="p-4 sm:p-5">
      {/* ── Le contrôle hors période ──────────────────────────────────────── */}
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ShieldQuestion className="h-4 w-4" />
        {t("bt_hors_titre")}
      </h4>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
        {t("bt_hors_pourquoi")}
      </p>

      {/* ⚠️ La note se lit EN PLUS du contrôle, jamais À LA PLACE. Elle explique
          pourquoi le verrou d'enregistrement ne l'exige pas ; elle n'a aucune
          raison d'empêcher le trader de le lancer s'il en a envie. */}
      {aDesModifications && !controleRequis ? (
        <p className="mt-3 rounded-lg border border-border bg-surface/40 p-3 text-xs leading-relaxed text-foreground-muted">
          {t("bt_hors_inutile")}
        </p>
      ) : null}

      {sansFenetre ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-3">
          <p className="text-xs leading-relaxed text-warning">{t("bt_hors_aucune")}</p>
          {periodeSuggeree ? (
            <>
              <button
                type="button"
                onClick={() => onRaccourcir(periodeSuggeree)}
                className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-accent/50 bg-background px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                {t("bt_hors_raccourcir", {
                  test: `${periodeSuggeree.de} → ${periodeSuggeree.a}`,
                })}
              </button>
              {/* ⚠️ ON NE FAIT PAS PASSER CETTE FENÊTRE POUR VIERGE. Elle a déjà
                  été traversée à l'intérieur d'un test plus large : le trader en
                  a vu le résultat fondu dans un total, pas isolé. C'est un
                  contrôle plus faible qu'une période jamais ouverte, et le lui
                  cacher vaudrait mieux ne rien contrôler du tout. */}
              <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
                {t("bt_hors_deja_vue")}
              </p>
            </>
          ) : null}
        </div>
      ) : (
        <>
          {/* ⚠️ UN CONTRÔLE PÉRIMÉ EST PIRE QU'AUCUN CONTRÔLE : il certifierait
              un plan qui n'existe plus, et le trader enregistrerait sa stratégie
              en croyant l'avoir vérifiée. */}
          {controle.phase === "fait" && !controle.valide ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("bt_hors_perime")}
            </p>
          ) : null}

          {controle.phase === "repos" ? (
            <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
              {t("bt_hors_par_analyse", { periode: `${fenetre.de} → ${fenetre.a}` })}
            </p>
          ) : null}

          {controle.phase === "fait" && controle.valide ? (
            <div className="mt-3 rounded-lg border border-border p-3">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Colonne
                  titre={t("bt_hors_ici", { periode: `${periode.de} → ${periode.a}` })}
                  c={ici}
                  t={t}
                />
                <Colonne
                  titre={t("bt_hors_ailleurs", {
                    periode: `${controle.fenetre.de} → ${controle.fenetre.a}`,
                  })}
                  c={chiffres(controle.lecture)}
                  t={t}
                />
              </dl>
              <p className="mt-3 border-t border-border pt-2.5 text-xs leading-relaxed text-foreground-muted">
                {t(verdictDuControle(controle.lecture))}
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* ── L'enregistrement ──────────────────────────────────────────────── */}
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Save className="h-4 w-4" />
          {t("bt_sauver_titre")}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_sauver_intro")}</p>

        {peutEnregistrer ? (
          <>
            <p className="mt-3 text-[11px] font-medium text-foreground">{t("bt_sauver_apercu")}</p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-foreground-muted">
              {apercuFiche}
            </pre>

            <p className="mt-2 text-[11px] leading-snug text-foreground-muted">
              {champsRepris.length > 0
                ? t("bt_sauver_champs", {
                    champs: champsRepris.map((c) => t(`bt_modif_${c}`)).join(", "),
                  })
                : t("bt_sauver_champs_aucun")}
            </p>
            {champsNonRepris.length > 0 ? (
              <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
                {t("bt_sauver_non_repris", {
                  champs: champsNonRepris.map((c) => t(`bt_modif_${c}`)).join(", "),
                })}
              </p>
            ) : null}

            {bloquant ? (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {bloquant}
              </p>
            ) : null}

            <button
              type="button"
              disabled={bloquant !== null || sauvegarde === "encours"}
              onClick={onEnregistrer}
              className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sauvegarde === "encours" ? t("bt_sauver_encours") : t("bt_sauver_bouton")}
            </button>
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            {t("bt_modif_aucune")}
          </p>
        )}

        {/* ⚠️ LA CONFIRMATION VIT HORS DU BLOC QU'ELLE CONFIRME. Enregistrer
            fait disparaître l'écart avec la fiche, donc le bloc ci-dessus : la
            confirmation placée dedans s'effaçait dans le même rendu, et le
            trader voyait son bouton disparaître sans jamais lire que c'était
            fait. Il aurait recommencé. */}
        {sauvegarde === "ok" ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-profit">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("bt_sauver_ok")}
          </p>
        ) : null}
        {sauvegarde === "erreur" ? (
          <p className="mt-3 text-xs text-loss">{t("bt_sauver_erreur")}</p>
        ) : null}
      </div>
    </Card>
  );
}

function Colonne({
  titre,
  c,
  t,
}: {
  titre: string;
  c: ReturnType<typeof chiffres>;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-foreground">{titre}</dt>
      <dd className="mt-1 space-y-0.5 text-[11px] tabular-nums text-foreground-muted">
        {c === null ? (
          <p>{t("bt_hors_trades", { n: 0 })}</p>
        ) : (
          <>
            <p>{t("bt_hors_trades", { n: c.trades })}</p>
            <p className="font-medium text-foreground">
              {t("bt_hors_esperance", { r: c.esperance })}
            </p>
            <p>{t("bt_hors_intervalle", { bas: c.intervalle[0], haut: c.intervalle[1] })}</p>
          </>
        )}
      </dd>
    </div>
  );
}
