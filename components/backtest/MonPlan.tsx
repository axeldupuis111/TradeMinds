"use client";

import { Card } from "@/components/ui/Card";
import type { LigneDeMonPlan, MonPlan as Plan, Provenance } from "@/lib/backtest/mon-plan";
import { phraseDuPlan } from "@/lib/backtest/phrases";
import { Check, ClipboardCopy, FileText, PenLine, Ruler, Sliders } from "lucide-react";
import { useState } from "react";

/**
 * LE PLAN QUE LE TRADER EMPORTE.
 *
 * ── D'OÙ VIENT CETTE CARTE ──────────────────────────────────────────────────
 *
 * ⚠️⚠️ C'EST L'OBJECTIF DE L'ONGLET, ÉNONCÉ PAR AXEL, ET IL N'ÉTAIT PAS LIVRÉ :
 *
 *   « L'objectif principal est qu'à la fin, l'utilisateur sorte avec un plan
 *     clair et complet de sa stratégie afin de pouvoir être discipliné. »
 *
 * Le plan écrit existait, et il était bon. Il ne s'affichait que dans la carte
 * « Chercher », donc uniquement pour la combinaison sortie d'une recherche. Le
 * parcours le plus fréquent — traduire sa fiche, lancer, lire — ne produisait
 * aucun document.
 *
 * ── CE QUE LA CARTE FAIT, ET NE FAIT PAS ────────────────────────────────────
 *
 * ⚠️ ELLE MARQUE D'OÙ VIENT CHAQUE LIGNE. « Ton stop se place derrière le
 * dernier sommet » est une recopie de son réglage ; « attends-toi à neuf pertes
 * d'affilée » est une découverte ; « je ne prends rien avant une annonce » est
 * sa phrase à lui. Les trois ne s'obéissent pas avec le même poids, et les
 * aplatir ferait passer une mesure pour une décision.
 *
 * ⚠️ ELLE GARDE LES LIGNES MANQUANTES. Un document qui a l'air complet et ne
 * l'est pas est pire que pas de document : le trader croirait avoir répondu.
 *
 * ⚠️ ELLE S'IMPRIME MÊME QUAND RIEN N'EST DÉMONTRÉ. Un plan est un engagement de
 * discipline, pas un certificat de rentabilité. Ce que la mesure a établi est
 * rappelé en une ligne, sans transformer le document en verdict.
 */

const ICONE: Record<Provenance, typeof Sliders> = {
  reglee: Sliders,
  mesuree: Ruler,
  ecrite: PenLine,
  manquante: PenLine,
};

const TON: Record<Provenance, string> = {
  reglee: "text-foreground-muted",
  mesuree: "text-accent",
  ecrite: "text-profit",
  manquante: "text-warning",
};

export function MonPlan({
  plan,
  onCopier,
  t,
}: {
  plan: Plan;
  /** Le texte brut du document, pour le presse-papier. */
  onCopier: () => string;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(onCopier());
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      // ⚠️ Le presse-papier est refusé dans certains contextes (page non
      // sécurisée, permission navigateur). On ne dit pas « copié » dans ce
      // cas-là : un faux succès ferait coller autre chose ailleurs.
      setCopie(false);
    }
  };

  return (
    <Card className="border-accent/30">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-accent" />
        {t("bt_mon_plan_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
        {t("bt_mon_plan_intro")}
      </p>

      {/**
        * ⚠️⚠️ UNE LÉGENDE, PLUS UNE PHRASE, ET C'EST UNE CORRECTION VUE À
        * L'ÉCRAN : « 10 règles réglées par toi · 4 déduites de la mesure ·
        * 1 écrites de ta main ». Un pluriel appliqué à un, la même faute que
        * « 1 essais » et « 7.05 bougie », dans une carte qui vient d'être
        * écrite.
        *
        * ⚠️ LE NOMBRE APRÈS L'ÉTIQUETTE, PAS AVANT : « Écrit de ta main : 1 »
        * ne s'accorde avec rien, dans aucune des quatre langues. C'est une
        * légende de couleurs, pas de la prose : elle n'a jamais eu besoin d'être
        * une phrase.
        */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(
          [
            ["reglee", plan.reglees],
            ["mesuree", plan.mesurees],
            ["ecrite", plan.ecrites],
            ["manquante", plan.manquantes],
          ] as const
        )
          .filter(([, n]) => n > 0)
          .map(([p, n]) => {
            const Icone = ICONE[p];
            return (
              <span key={p} className="flex items-center gap-1 text-[11px] text-foreground-muted">
                <Icone className={`h-3 w-3 ${TON[p]}`} />
                {t(`bt_mon_plan_entete_${p}`)} : <span className="tabular-nums">{n}</span>
              </span>
            );
          })}
      </div>

      <ol className="mt-4 space-y-2.5">
        {plan.lignes.map((l, i) => (
          <Ligne key={`${l.cle}-${i}`} ligne={l} t={t} />
        ))}
      </ol>

      {plan.manquantes > 0 ? (
        <p className="mt-4 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-xs leading-relaxed text-warning">
          {t("bt_mon_plan_manquantes", { n: plan.manquantes })}
        </p>
      ) : (
        <p className="mt-4 rounded-lg border border-profit/40 bg-profit/[0.06] p-3 text-xs leading-relaxed text-profit">
          {t("bt_mon_plan_complet")}
        </p>
      )}

      {/* ⚠️ CE QUE LA MESURE A ÉTABLI, EN UNE LIGNE ET PAS PLUS. Le détail est
          dans « Ce qui est établi » ; le répéter ici transformerait le document
          en verdict, alors qu'il est un engagement. */}
      <p className="mt-2 text-[11px] leading-snug text-foreground-muted">
        {t("bt_mon_plan_mesure", { etablis: plan.etablis, ouverts: plan.ouverts })}
      </p>

      <button
        type="button"
        onClick={() => void copier()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
      >
        {copie ? <Check className="h-3.5 w-3.5 text-profit" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
        {t(copie ? "bt_mon_plan_copie" : "bt_mon_plan_copier")}
      </button>
    </Card>
  );
}

function Ligne({
  ligne,
  t,
}: {
  ligne: LigneDeMonPlan;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  const Icone = ICONE[ligne.provenance];
  const question = ligne.cle.startsWith("bt_q_");

  return (
    <li className="flex items-start gap-2.5">
      <Icone className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TON[ligne.provenance]}`} />
      <div className="min-w-0 flex-1">
        {question ? (
          <>
            <p className="text-xs font-medium text-foreground">{t(ligne.cle)}</p>
            {ligne.texte ? (
              /* ⚠️ SES MOTS, ENTRE GUILLEMETS ET SANS RETOUCHE. Une règle
                 reformulée par l'outil cesse d'être la sienne, et c'est la
                 sienne qu'il tiendra. */
              <p className="mt-0.5 text-xs italic leading-relaxed text-foreground-muted">
                « {ligne.texte} »
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-relaxed text-warning">
                {t("bt_mon_plan_a_ecrire")}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-foreground">
            {phraseDuPlan({ cle: ligne.cle.replace(/^bt_plan_/, ""), valeurs: ligne.valeurs ?? {}, deduite: false }, t)}
          </p>
        )}
      </div>
    </li>
  );
}
