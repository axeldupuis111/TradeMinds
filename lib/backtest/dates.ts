/**
 * LES DATES DE L'ONGLET SUIVENT LA LANGUE DE L'APPLICATION, PAS CELLE DU
 * NAVIGATEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ INTERFACE EN ANGLAIS, DATE EN FRANÇAIS. Sur la fiche d'un aperçu :
 * « Direction : Buy · Date : 02/01/2025 10:45 ». Le 2 janvier, écrit dans un
 * ordre que n'importe quel lecteur anglophone lit « February 1st ». Toute la
 * page était traduite ; sept appels à `toLocaleDateString()` sans argument
 * demandaient la langue du NAVIGATEUR, qui n'a aucune raison d'être celle que
 * le trader a choisie dans l'application.
 *
 * ⚠️ ET TROIS DE CES DATES PARTENT DANS SA FICHE DE STRATÉGIE, c'est-à-dire
 * dans un texte que le coach relit et que le trader garde. Le format d'un
 * document qu'il conserve dépendait du navigateur avec lequel il l'a écrit.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une seule source : la langue de l'application. Deux fonctions, parce que les
 * deux usages sont vraiment différents — une date seule dans un titre, une date
 * avec l'heure sur un trade, où la minute est l'information.
 */

/** Une date seule : « 02/01/2025 » en français, « 1/2/2025 » en anglais. */
export function enDate(valeur: Date | number | string, langue: string): string {
  return new Date(valeur).toLocaleDateString(langue);
}

/**
 * Une date avec l'heure.
 *
 * ⚠️ LA MINUTE EST L'INFORMATION, pas la décoration : sur un plan en M5, deux
 * trades à quatre minutes d'intervalle sont deux trades différents, et une
 * heure arrondie les confondrait.
 */
export function enDateEtHeure(valeur: Date | number | string, langue: string): string {
  return new Date(valeur).toLocaleString(langue, { dateStyle: "short", timeStyle: "short" });
}
