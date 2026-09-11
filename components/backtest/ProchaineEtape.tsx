"use client";

import { Card } from "@/components/ui/Card";
import type { Etape } from "@/lib/backtest/prochaine-etape";
import { ArrowRight, Compass } from "lucide-react";

/**
 * LA SEULE CHOSE À FAIRE MAINTENANT.
 *
 * ── D'OÙ VIENT CETTE CARTE ──────────────────────────────────────────────────
 *
 * ⚠️⚠️ MESURÉ SUR LA PAGE, AVANT MÊME D'AVOIR LANCÉ QUOI QUE CE SOIT : 9,2 écrans
 * de haut, 3 031 mots, 47 boutons. Après une analyse complète, 38 titres. Chaque
 * carte répond à une vraie question, et aucune ne dit par où commencer.
 *
 *   « Il me montre des chiffres sans changer ma stratégie. »
 *   « J'avais fait un tribunal, il voulait un atelier. »
 *
 * ── CE QU'ELLE N'EST PAS ────────────────────────────────────────────────────
 *
 * ⚠️ CE N'EST PAS UN RÉSUMÉ. Un résumé s'ajouterait aux quinze cartes ; celle-ci
 * en désigne une. Elle ne redit aucun chiffre, elle nomme un geste.
 *
 * ⚠️ ELLE NE PROMET AUCUN GAIN, et un test l'interdit mot par mot. L'ordre des
 * étapes suit ce qui EMPÊCHE DE CONCLURE, jamais ce qui ferait monter
 * l'espérance : trier par « ce qui améliore le chiffre » ferait de cette carte
 * une machine à sur-apprentissage, avec l'autorité d'un conseil en plus.
 *
 * ⚠️ ELLE NE CACHE RIEN. Tout ce qu'elle ne montre pas est toujours en dessous,
 * dans l'ordre, et le trader qui veut tout lire le peut. C'est une entrée, pas
 * un filtre.
 */
export function ProchaineEtape({
  etape,
  onAgir,
  enCours,
  t,
}: {
  etape: Etape;
  /**
   * Le geste. Reçoit l'ancre à faire remonter, ou `null` quand l'étape EST
   * l'action (lancer, analyser) et que la carte doit la déclencher elle-même.
   */
  onAgir: (ancre: string | null, code: Etape["code"]) => void;
  enCours: boolean;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  return (
    <Card className="border-accent/40 bg-accent/[0.04] p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Compass className="h-4 w-4 text-accent" />
        {t("bt_faire_titre")}
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_faire_intro")}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-foreground">
        {t(`bt_faire_${etape.code}`, etape.valeurs)}
      </p>

      <button
        type="button"
        disabled={enCours}
        onClick={() => onAgir(etape.ancre, etape.code)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t(`bt_faire_${etape.code}_geste`)}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}
