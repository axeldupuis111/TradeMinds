import { ICT_CHECKLIST_ITEMS } from "@/lib/ict-constants";

/**
 * SUR COMBIEN SE COMPTE UNE CHECKLIST DE PRÉ-TRADE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE DÉNOMINATEUR ENVOYÉ AU MODÈLE ÉTAIT CELUI D'UNE AUTRE LISTE. Le score
 * de confluence d'un trade compte les cases COCHÉES de la checklist de la fiche
 * (`strategy_tags` de type `checklist`, à défaut la liste ICT par défaut). Les
 * deux appelants qui l'envoient à l'IA le divisaient par
 * `setup_rules.length`, c'est-à-dire par le nombre de RÈGLES D'ENTRÉE écrites
 * dans le plan. Deux listes différentes, aucun rapport de taille entre elles.
 *
 * ⚠️ MESURÉ EN PRODUCTION LE 2026-09-17, sur les dix-neuf fiches existantes :
 *
 *   - « INFX OTO+ » : 34 règles pour 8 items de checklist. Un trade qui coche
 *     7 cases sur 8 (88 %) était présenté au modèle comme « 7/34 », soit 20 %.
 *     Le trade le plus discipliné du journal passait pour le plus bâclé.
 *   - « Stratégie de démonstration » : 5 règles, et des scores allant jusqu'à
 *     7. La ligne envoyée disait « Checklist:7/5 », un score au-dessus de son
 *     propre maximum.
 *   - « order flow » : 2 règles pour 7 items, donc jusqu'à 350 %.
 *   - « VP + FVG m1 » : 0 règle, donc `checklist_total = 0`, donc la ligne
 *     DISPARAISSAIT — pour 53 trades pourtant notés.
 *
 * ⚠️ ET CE N'EST PAS QUE LE PROMPT : `lib/analysis-insights.ts` en tire le
 * rapport « checklist complète ou non » qui coupe les trades en deux seaux et
 * produit le constat « tes trades checklist complète gagnent X % de plus ».
 */
export function totalDeChecklist(nombreDItemsDeLaFiche: number | null | undefined): number {
  const n = typeof nombreDItemsDeLaFiche === "number" ? nombreDItemsDeLaFiche : 0;
  // Même repli que `useStrategyTags` : sans items propres, la fiche affiche la
  // checklist ICT par défaut, et c'est donc sur celle-là que le trader coche.
  return n > 0 ? n : ICT_CHECKLIST_ITEMS.length;
}

/** Compte les items de checklist parmi les étiquettes d'une fiche. */
export function compterLesItemsDeChecklist(
  tags: { tag_type?: string | null }[] | null | undefined,
): number {
  return (tags ?? []).filter((t) => t.tag_type === "checklist").length;
}
