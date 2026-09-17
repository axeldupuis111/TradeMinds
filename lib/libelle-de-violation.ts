import type { Traduire } from "@/lib/LanguageContext";

/**
 * LE NOM D'UNE VIOLATION, TEL QUE LE TRADER LE LIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS ENDROITS AFFICHAIENT CE NOM, ET DEUX NE PASSAIENT PAS PAR LA TABLE
 * QUI LE TRADUIT. `app/dashboard/analysis/page.tsx` porte un
 * `VIOLATION_TYPE_LABELS` qui sait que le type `lot_increase_after_loss`
 * s'écrit avec la clé `violation_lot_increase` ; le détail de l'analyse et
 * l'export PDF, eux, composaient la clé à la main
 * (`t(`violation_${type}`)`). Comme `t()` rend la clé quand elle est absente,
 * le trader lisait, en titre de sa violation :
 *
 *     violation_lot_increase_after_loss
 *
 * ⚠️ MESURÉ EN BASE le 2026-09-17 : ce type apparaît dans TROIS analyses
 * enregistrées. Ces rapports sont payés en crédit, stockés, relus et exportés en
 * PDF, et ils portent ce texte-là.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les clés portent exactement le nom du type, ce qui supprime la table de
 * correspondance et le décalage qu'elle permettait. Et si une clé manque, on
 * affiche le TYPE, jamais la clé : un identifiant technique reste moche, mais
 * `violation_lot_increase_after_loss` à l'écran, c'est un bogue lisible par le
 * client.
 */
export function libelleDeViolation(type: string, t: Traduire): string {
  const cle = `violation_${type}`;
  const rendu = t(cle as Parameters<Traduire>[0]);
  return rendu === cle ? type : rendu;
}
