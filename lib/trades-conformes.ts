/**
 * COMBIEN DE TRADES ONT RESPECTÉ LE PLAN.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ DANS L'HISTORIQUE DES ANALYSES : « -1/2 trades ». Moins un.
 *
 * Le calcul était `total_trades - violations.length`, c'est-à-dire UNE
 * violation = UN trade. Or un même trade peut en cumuler plusieurs (entrer
 * hors session ET sans setup ET au-delà du risque). Sur deux trades et trois
 * violations, le compte passe sous zéro, et l'écran annonce un nombre de
 * trades négatif à quelqu'un qui vient chercher un diagnostic.
 *
 * ⚠️ LA BONNE MESURE EXISTAIT DÉJÀ, dans les données de démonstration :
 * `new Set([...]).size`, le nombre de trades DISTINCTS cités. Une règle écrite
 * une fois, appliquée à l'endroit qui ne compte pas.
 */

/**
 * Une violation cite les trades qu'elle concerne (analyses récentes).
 *
 * ⚠️ LES CHAMPS SONT TOUS FACULTATIFS, et c'est voulu : les anciennes
 * violations n'ont ni identifiants ni rien d'autre en commun avec celles-ci.
 * Exiger une propriété ferait refuser le type le jour où on lui passe les deux
 * générations mélangées, ce qui est exactement ce que la page a en main.
 */
export type ViolationCitante = { trade_ids?: number[] };

/**
 * Le nombre de trades qui n'apparaissent dans AUCUNE violation.
 *
 * ⚠️ LES ANCIENNES VIOLATIONS NE CITENT PAS DE TRADES (elles n'ont qu'une date
 * et une paire) : faute d'identifiants, on retombe sur l'ancien compte, mais
 * BORNÉ. Mieux vaut un zéro prudent qu'un négatif impossible.
 */
export function tradesConformes(total: number, violations: ViolationCitante[] | undefined): number {
  const citees = violations ?? [];
  const distincts = new Set<number>();
  let sansIdentifiant = 0;
  for (const v of citees) {
    const ids = v.trade_ids ?? [];
    if (ids.length === 0) sansIdentifiant++;
    for (const id of ids) distincts.add(id);
  }
  const enFaute = distincts.size + sansIdentifiant;
  return Math.min(total, Math.max(0, total - enFaute));
}
