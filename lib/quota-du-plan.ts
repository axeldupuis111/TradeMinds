/**
 * CE QUI COMPTE DANS LE QUOTA D'UN PLAN : CE QUE LE TRADER A CRÉÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA DÉMONSTRATION QU'ON OFFRE MANGEAIT LA SEULE PLACE DU PLAN GRATUIT.
 * Le mode démo crée un compte (« Compte de démonstration ») et une stratégie
 * (« Stratégie de démonstration »), tous deux marqués `is_demo`. Les deux pages
 * comptaient simplement les lignes : un nouvel inscrit qui essayait la démo
 * (c'est le parcours de découverte du produit) se retrouvait donc à sa limite
 * AVANT d'avoir créé quoi que ce soit.
 *
 * ⚠️ ET CE QUE LE PRODUIT LUI RÉPONDAIT EST PIRE QUE LE BLOCAGE :
 *
 *   - page Compte : « Tu as atteint la limite de comptes de ton plan » avec un
 *     lien « Passer au plan supérieur ». On demandait de PAYER pour sortir
 *     d'une démonstration qu'on venait d'offrir, à quelqu'un qui possède zéro
 *     compte réel.
 *   - page Stratégie : le bouton « nouvelle fiche » répondait par un refus.
 *
 * C'est le moment le plus fragile de la vie d'un inscrit, et le produit lui
 * fermait la porte au motif d'un contenu qu'il n'a pas créé.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un compte gratuit, inscrit le 16 août,
 * jamais passé par Stripe, porte exactement cette situation — un compte réel et
 * un compte de démonstration, profil encore en `demo_mode`.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un quota compte ce que le trader a créé. Les lignes de démonstration sont
 * prêtées, et elles disparaissent à la sortie du mode démo (purge restreinte à
 * `is_demo`, voir lib/demo-data).
 */

/** Ce qui compte dans un quota : tout sauf ce que la démonstration a prêté. */
export function comptePourLeQuota<T extends { is_demo?: boolean | null }>(lignes: T[]): T[] {
  return lignes.filter((l) => l.is_demo !== true);
}

/**
 * La limite est-elle atteinte ?
 *
 * `max` à `null` veut dire « illimité », et `undefined` veut dire « on ne sait
 * pas encore » : dans les deux cas on ne bloque pas. Un plan pas encore lu rend
 * les valeurs du plan GRATUIT, et un abonné Premium voyait alors sa propre
 * limite s'afficher le temps d'un battement.
 */
export function quotaAtteint<T extends { is_demo?: boolean | null }>(
  lignes: T[],
  max: number | null | undefined,
): boolean {
  if (max == null) return false;
  return comptePourLeQuota(lignes).length >= max;
}
