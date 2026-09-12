"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { Sparkles } from "lucide-react";

/**
 * L'ENCART QUI REMPLACE UN RÉSULTAT D'IA SUR UN COMPTE DE DÉMONSTRATION.
 *
 * ── POURQUOI IL EXISTE ──────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA RÈGLE « LE MODE DÉMONSTRATION NE DÉPENSE RIEN » ÉTAIT ÉCRITE DANS DEUX
 * ÉCRANS SUR DOUZE. La page Analyse et le coach servent des textes pré-écrits et
 * sortent avant d'appeler le modèle ; les dix autres (débrief de séance, plan
 * hebdo, bilan mensuel, résumé du jour, lecture de stratégie, compilation,
 * verdict de projection, objectifs, défis de communauté, calendrier éco)
 * appelaient le modèle pour de vrai, depuis un compte dont toutes les données
 * sont fictives. Un appel se paie, et le modèle rendait un jugement argumenté
 * sur des trades inventés, présenté exactement comme un vrai.
 *
 * ⚠️ LA PORTE EST SUR LA ROUTE (`refusSiDemo`), PAS ICI. Ce composant n'est pas
 * le garde : il évite qu'un garde serveur ne laisse à l'écran un bouton mort ou
 * une carte vide. Refuser sans le dire est une autre façon de mentir.
 */
export default function NoteDeDemonstration({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent/5 px-3.5 py-3 ${className}`}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
      <p className="text-[13px] leading-snug text-foreground-muted">{t("ai_err_demo_mode")}</p>
    </div>
  );
}
