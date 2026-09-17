/**
 * UN PRIX DE SORTIE À ZÉRO N'EST PAS UN PRIX, C'EST UNE ABSENCE.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ CENT VINGT-DEUX TRADES SUR QUATRE CENT QUARANTE-SEPT, soit 27 %, sont
 * `closed` avec un P&L réel et un `exit_price` à ZÉRO. Aucun n'est à `null` :
 * l'analyseur CSV écrit `parseNumber(...) ?? 0` en cinq endroits, donc une
 * colonne de sortie absente du fichier devient un prix de zéro.
 *
 * ── CE QUE ÇA PRODUISAIT ────────────────────────────────────────────────────
 *
 * ⚠️ À L'ÉCRAN : « 4500.00 → 0.00000 » sur la carte des trades récents. Le
 * garde d'affichage existait mais testait `!= null`, et la donnée vaut 0.
 *
 * ⚠️⚠️ ET DANS LE PROMPT D'ANALYSE, c'est pire, parce que le modèle y croit :
 * `calculatePips(pair, 4500, 0)` rend environ 45 000 pips, et la direction se
 * déduit de `exit > entry`, donc un SELL non renseigné était annoncé comme un
 * GAIN de quarante-cinq mille pips. La ligne envoyée au modèle disait
 * « Pips réalisés: 45000 (gain) | Résultat: LOSS | P&L net: -50.00 », trois
 * faits qui se contredisent, avec pour consigne « NE LES RECALCULE PAS,
 * utilise-les telles quelles ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout ce qui LIT un prix de sortie passe par ici. Zéro vaut absent, pour les
 * cent vingt-deux lignes déjà en base comme pour celles à venir, et l'analyseur
 * CSV écrit désormais `null` plutôt que zéro.
 *
 * ⚠️ ZÉRO N'EST PAS UN PRIX PLAUSIBLE, sur aucun instrument que ce produit
 * suit : ni une paire de devises, ni un métal, ni un indice, ni un future ne
 * se traite à zéro. Il n'y a donc pas de trade légitime à sacrifier.
 */
export function prixDeSortieConnu(exit: number | null | undefined): number | null {
  return exit != null && exit !== 0 ? exit : null;
}
