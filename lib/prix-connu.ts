/**
 * UN PRIX À ZÉRO N'EST PAS UN PRIX, C'EST UNE ABSENCE.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ CENT VINGT-DEUX TRADES SUR QUATRE CENT QUARANTE-SEPT, soit 27 %, sont
 * `closed` avec un P&L réel et un `exit_price` à ZÉRO. Aucun n'est à `null` :
 * l'analyseur CSV écrit `parseNumber(...) ?? 0` en cinq endroits, donc une
 * colonne de sortie absente du fichier devient un prix de zéro.
 *
 * ── ET CE N'EST PAS QUE LA SORTIE ────────────────────────────────────────────
 *
 * ⚠️⚠️ LE STOP ET L'OBJECTIF ONT LE MÊME DÉFAUT, PAR UNE AUTRE PORTE. MetaTrader
 * annonce « pas de stop » par un ZÉRO (`OrderStopLoss()` vaut 0), et le rail de
 * synchro l'enregistrait tel quel. Mesuré en base le 2026-09-17 : 20 trades ont
 * `sl = 0` et 67 ont `tp = 0`, à côté de 125 qui valent bien `null`.
 *
 * ⚠️ La conséquence est TRIPLE et tire dans trois directions à la fois :
 *   - `if (sl == null) add("missing_sl")` ne voit pas le zéro, donc un trade
 *     SANS STOP n'est pas signalé comme tel, et le score de discipline du
 *     trader est meilleur que la réalité ;
 *   - `sl_too_wide` le compare quand même, sur une distance de dizaines de
 *     milliers de pips, donc il déclenche à tort ;
 *   - le prompt annonce « Risque: 45000 pips » et un RR planifié absurde.
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
export function prixConnu(prix: number | null | undefined): number | null {
  return prix != null && prix !== 0 ? prix : null;
}

/** Nom historique, conservé pour le prix de SORTIE. */
export const prixDeSortieConnu = prixConnu;
