"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { signe } from "@/lib/backtest/format";
import { comparerMesures, ecartsDeReglages } from "@/lib/backtest/comparaison";
import type { VersionArchivee } from "@/lib/backtest/versions";
import { AlertTriangle, Archive, RotateCcw, Scale, Trash2 } from "lucide-react";

/**
 * LES VERSIONS ARCHIVÉES, ET LA SEULE QUESTION HONNÊTE À LEUR POSER.
 *
 * ── LA TENSION, ET COMMENT ELLE SE RÉSOUT ───────────────────────────────────
 *
 * Un écran qui aligne dix essais avec leurs résultats est, par construction, une
 * machine à choisir le meilleur chiffre : exactement ce que le compteur de
 * tentatives de cette page existe pour décourager.
 *
 * On ne renonce pas pour autant, parce que se souvenir de ce qu'on a essayé est
 * le contraire de tâtonner à l'aveugle. Trois règles rendent la chose tenable :
 *
 * 1. **AUCUN CLASSEMENT, AUCUNE MISE EN AVANT.** Les versions s'affichent par
 *    date, la plus récente d'abord. Jamais par performance.
 * 2. **LE NOMBRE D'ESSAIS EST AFFICHÉ SUR CHAQUE LIGNE.** « Essai n° 34 » à
 *    côté d'un beau chiffre dit tout ce qu'il faut savoir de ce beau chiffre.
 * 3. **COMPARER RÉPOND « SONT-ELLES SEULEMENT DISTINGUABLES »**, pas « laquelle
 *    gagne ». La réponse est « non » bien plus souvent qu'on ne le croit, et
 *    c'est le renseignement le plus utile que cet écran puisse donner.
 */

const TON: Record<string, string> = {
  positif: "text-profit",
  negatif: "text-loss",
  non_concluant: "text-warning",
  insuffisant: "text-foreground-muted",
};

function chiffre(v: number | null | undefined, decimales = 3): string {
  return signe(v, decimales);
}

export function Versions({
  versions,
  erreur,
  chargement,
  selection,
  onSelectionner,
  onRecharger,
  onSupprimer,
  t,
}: {
  versions: VersionArchivee[];
  /** Vrai quand la lecture a échoué : ⚠️ jamais confondre avec « aucune version ». */
  erreur: boolean;
  chargement: boolean;
  /** Les deux versions cochées, dans l'ordre où elles l'ont été. */
  selection: string[];
  onSelectionner: (id: string) => void;
  onRecharger: (v: VersionArchivee) => void;
  onSupprimer: (v: VersionArchivee) => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (chargement) {
    return (
      <Card className="p-4 sm:p-5">
        <p className="text-xs text-foreground-muted">{t("bt_ver_chargement")}</p>
      </Card>
    );
  }

  /* ⚠️ UNE LECTURE RATÉE N'EST PAS UNE LISTE VIDE. Afficher « aucune version »
     à quelqu'un qui en a douze est le pire message que cet écran puisse rendre :
     il croirait son travail perdu. */
  if (erreur) {
    return (
      <Card className="p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-foreground">{t("bt_ver_titre")}</h4>
        <p className="mt-2 text-xs text-loss">{t("bt_ver_erreur")}</p>
      </Card>
    );
  }

  if (versions.length === 0) return null;

  const a = versions.find((v) => v.id === selection[0]);
  const b = versions.find((v) => v.id === selection[1]);

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Archive className="h-4 w-4" />
        {t("bt_ver_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_ver_intro")}</p>

      <ul className="mt-4 space-y-2">
        {versions.map((v) => {
          const coche = selection.includes(v.id);
          return (
            <li
              key={v.id}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                coche ? "border-accent/60 bg-accent/[0.05]" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex min-w-0 cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => onSelectionner(v.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[rgb(var(--accent))]"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">
                      {new Date(v.creeLe).toLocaleString()} · {v.instrument} · {v.de} → {v.a}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-foreground-muted">
                      <span className={TON[v.resume.verdict] ?? ""}>
                        {t(`bt_verdict_${v.resume.verdict}`)}
                      </span>
                      {" · "}
                      {t("bt_hors_trades", { n: v.resume.trades })}
                      {v.resume.esperanceR != null ? (
                        <>
                          {" · "}
                          {chiffre(v.resume.esperanceR)} R [{chiffre(v.resume.borneBasse)} ;{" "}
                          {chiffre(v.resume.borneHaute)}]
                        </>
                      ) : null}
                    </span>
                  </span>
                </label>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRecharger(v)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("bt_ver_recharger")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSupprimer(v)}
                    aria-label={t("bt_ver_supprimer")}
                    title={t("bt_ver_supprimer")}
                    className="rounded-lg border border-border px-2 py-1 text-foreground-muted hover:bg-loss/10 hover:text-loss"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* ⚠️ LE NOMBRE D'ESSAIS SUR CHAQUE LIGNE. C'est ce chiffre-là qui
                  donne son sens au chiffre d'à côté : un beau résultat au
                  trente-quatrième essai n'est pas le même objet qu'un beau
                  résultat au deuxième. */}
              <p className="mt-2 text-[11px] leading-snug text-foreground-muted">
                {t("bt_ver_essai", { n: v.resume.tentatives })}
                {" · "}
                {v.controle
                  ? t("bt_ver_controlee", {
                      periode: `${v.controle.de} → ${v.controle.a}`,
                      r: chiffre(v.controle.esperanceR),
                      n: v.controle.trades,
                    })
                  : t("bt_ver_non_controlee")}
              </p>

              {v.modifications.length > 0 ? (
                <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
                  {t("bt_ver_reglages", {
                    liste: v.modifications
                      .map((m) => `${t(`bt_modif_${m.cle}`)} ${m.avant} → ${m.apres}`)
                      .join(" · "),
                  })}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-foreground-muted">{t("bt_ver_sans_ecart")}</p>
              )}
            </li>
          );
        })}
      </ul>

      {a && b ? <Comparaison a={a} b={b} t={t} /> : (
        <p className="mt-3 text-[11px] leading-snug text-foreground-muted">
          {t("bt_ver_comment_comparer")}
        </p>
      )}
    </Card>
  );
}

/**
 * DEUX VERSIONS CÔTE À CÔTE, SANS GAGNANT.
 *
 * ⚠️ LA PHRASE CENTRALE EST « CES DEUX RÉSULTATS NE SONT PAS DISTINGUABLES », et
 * c'est le plus souvent la vraie. +0,12 R contre +0,31 R ressemble à un gouffre ;
 * avec les intervalles composés, c'est presque toujours la même chose mesurée
 * deux fois. Un écran de comparaison qui ne dit pas ça sert seulement à choisir
 * le chiffre qui arrange.
 */
function Comparaison({
  a,
  b,
  t,
}: {
  a: VersionArchivee;
  b: VersionArchivee;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const c = comparerMesures(a.resume, b.resume, { de: a.de, a: a.a }, { de: b.de, a: b.a });
  const ecarts = ecartsDeReglages(a.modifications, b.modifications);

  return (
    <div className="mt-4 rounded-lg border border-accent/40 bg-accent/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Scale className="h-3.5 w-3.5" />
        {t("bt_ver_comparaison")}
      </p>

      {/* ⚠️ DEUX PÉRIODES DIFFÉRENTES DISQUALIFIENT LA COMPARAISON, elles ne la
          nuancent pas. L'écart mesuré peut n'être qu'un changement d'époque, et
          il faut le lire AVANT le chiffre, pas après. */}
      {c.periodesDifferentes ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {t("bt_ver_periodes_differentes")}
        </p>
      ) : null}

      {ecarts.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {ecarts.map((e) => (
            <li key={e.cle} className="text-[11px] tabular-nums text-foreground-muted">
              <span className="text-foreground">{t(`bt_modif_${e.cle}`)}</span>{" "}
              <span className="font-mono">
                {e.a ?? t("bt_ver_comme_la_fiche")} / {e.b ?? t("bt_ver_comme_la_fiche")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-foreground-muted">{t("bt_ver_memes_reglages")}</p>
      )}

      <p className="mt-2.5 border-t border-accent/20 pt-2.5 text-[11px] leading-relaxed text-foreground-muted">
        {c.verdict === "sans_chiffre"
          ? t("bt_ver_sans_chiffre")
          : c.verdict === "indistinguables"
            ? t("bt_ver_indistinguables", {
                ecart: chiffre(c.ecartR),
                bas: chiffre(c.ecartBasse),
                haut: chiffre(c.ecartHaute),
              })
            : t("bt_ver_ecart_mesurable", {
                ecart: chiffre(c.ecartR),
                bas: chiffre(c.ecartBasse),
                haut: chiffre(c.ecartHaute),
              })}
      </p>
    </div>
  );
}
