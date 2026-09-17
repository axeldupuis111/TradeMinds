/**
 * UN POURCENTAGE DE RÈGLE EST UN POURCENTAGE.
 *
 * ── LE DÉFAUT, VU EN BASE ───────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN COMPTE DE PRODUCTION PORTE `max_daily_dd_pct = 500` ET
 * `max_total_dd_pct = 1000`. Relevé le 2026-09-17 sur un compte FTMO de
 * 10 000 € : le trader a manifestement saisi des MONTANTS (500 € par jour,
 * 1 000 € au total, soit 5 % et 10 %) dans deux champs qui attendent des
 * pourcentages, et le formulaire les a pris tels quels.
 *
 * Ce qu'il en reste : sa perte journalière maximale vaut 50 000 € sur un compte
 * de 10 000. Aucun garde ne peut plus se déclencher, ni l'alerte de perte
 * journalière, ni le bandeau de séance, ni la réponse du coach à « combien il
 * me reste ». Le produit lui dit qu'il a de la marge jusqu'à cinq fois son
 * capital, et le seul écran qui aurait pu l'alerter est celui qui le rassure.
 *
 * ⚠️ LA BORNE ÉTAIT DÉJÀ ÉCRITE, DANS L'AUTRE CHEMIN D'ÉCRITURE : l'outil
 * `create_account` du coach passe par `asNumber(input.max_daily_dd_pct, 0, 100)`
 * depuis toujours. Le formulaire, lui, faisait `parseFloat(champ) || 5`. Deux
 * portes vers la même colonne, une seule fermée.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute écriture d'un pourcentage de règle passe par ici. Zéro reste possible
 * (c'est « pas de règle »), cent est le maximum : perdre plus que son capital
 * n'est pas une règle de prop firm, c'est une faute de frappe.
 */

export const POURCENTAGE_MAX = 100;

/**
 * @param saisie ce que le champ contient (texte du formulaire ou nombre)
 * @param defaut valeur retenue quand la saisie ne donne aucun nombre
 */
export function pourcentageDeRegle(
  saisie: string | number | null | undefined,
  defaut = 0,
): number {
  const n = typeof saisie === "number" ? saisie : parseFloat(String(saisie ?? ""));
  if (!Number.isFinite(n)) return borner(defaut);
  return borner(n);
}

function borner(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(POURCENTAGE_MAX, Math.max(0, n));
}

/**
 * Vrai quand une valeur DÉJÀ ENREGISTRÉE sort des bornes.
 *
 * ⚠️ EXISTE POUR LES LIGNES ÉCRITES AVANT LA BORNE : les corriger à la volée
 * changerait la règle d'un trader sans le lui dire. On sait les reconnaître,
 * c'est à l'écran de le signaler.
 */
export function pourcentageAberrant(valeur: number | null | undefined): boolean {
  return typeof valeur === "number" && Number.isFinite(valeur) && valeur > POURCENTAGE_MAX;
}
