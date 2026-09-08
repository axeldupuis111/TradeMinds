"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  QUESTIONS_DE_CONSTRUCTION,
  type CodeQuestion,
  type PlanConstruit,
} from "@/lib/backtest/construire";
import { AlertTriangle, Hammer } from "lucide-react";

/**
 * CONSTRUIRE SA STRATÉGIE, GESTE PAR GESTE.
 *
 * ── CE QUE CET ÉCRAN REMPLACE ───────────────────────────────────────────────
 *
 *   « Limite tu lui proposes plein de choses, de règles qu'il connaît et est à
 *     l'aise à appliquer, et de là tu lui construis une stratégie. »
 *
 * ⚠️⚠️ « PARTIR D'UNE BASE » EST UN MENU, PAS UNE CONSTRUCTION, et je l'ai
 * présenté comme une construction pendant des semaines. Neuf méthodes complètes
 * portant des noms d'école : quelqu'un qui n'a pas de stratégie doit reconnaître
 * « OTE » ou « order block » et faire confiance au reste. Il adopte, il ne
 * construit pas.
 *
 * ── CE QUE CET ÉCRAN S'INTERDIT ─────────────────────────────────────────────
 *
 * ⚠️ AUCUN CHOIX N'EST RECOMMANDÉ NI CLASSÉ. Les gestes s'affichent dans
 * l'ordre du catalogue. Mettre le « meilleur » en premier ferait de cet écran
 * un conseil, et cet onglet n'en donne pas.
 *
 * ⚠️ CE QU'IL NE DIT PAS EST ANNONCÉ, jamais rempli en silence. Un réglage par
 * défaut qui ne s'annonce pas devient sa discipline sans qu'il l'ait décidé.
 */
export function Construire({
  reponses,
  resultat,
  onRepondre,
  onAssembler,
  occupe,
  t,
}: {
  reponses: Partial<Record<CodeQuestion, string>>;
  /** L'assemblage courant, pour dire ce qui manque et ce qui se contredit. */
  resultat: PlanConstruit;
  onRepondre: (question: CodeQuestion, geste: string) => void;
  onAssembler: () => void;
  occupe: boolean;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  const pret = resultat.manquantes.length === 0 && resultat.conflits.length === 0;

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Hammer className="h-4 w-4" />
        {t("bt_cons_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_cons_intro")}</p>

      <div className="mt-4 space-y-4">
        {QUESTIONS_DE_CONSTRUCTION.map((question) => (
          <div key={question.code}>
            <p className="text-xs font-medium text-foreground">{t(`bt_cons_q_${question.code}`)}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {question.gestes.map((geste) => {
                const choisi = reponses[question.code] === geste.code;
                return (
                  <button
                    key={geste.code}
                    type="button"
                    onClick={() => onRepondre(question.code, geste.code)}
                    aria-pressed={choisi}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors",
                      choisi
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border text-foreground-muted hover:border-accent/50 hover:text-foreground",
                    )}
                  >
                    {t(`bt_cons_g_${geste.code}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ⚠️ LE CONFLIT AVANT LE MANQUE. Un manque se comble en répondant ; un
          conflit, lui, veut dire qu'une réponse déjà donnée doit changer, et
          c'est la seule chose qui rendrait le rejeu faux plutôt qu'absent. */}
      {resultat.conflits.map((c) => (
        <p
          key={c.gestes.join("-")}
          className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-[11px] leading-relaxed text-warning"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t(c.cle)}
        </p>
      ))}

      {resultat.manquantes.length > 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
          {t("bt_cons_manque")}
        </p>
      ) : null}

      {resultat.laisseesAuSocle.length > 0 && resultat.manquantes.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
          {t("bt_cons_socle", { n: resultat.laisseesAuSocle.length })}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!pret || occupe}
        onClick={onAssembler}
        className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("bt_cons_construire")}
      </button>
    </Card>
  );
}
