/**
 * « CET OBJECTIF EST-IL ATTEINT ? » — UNE SEULE RÉPONSE POUR TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'ANNEAU DE LA PAGE OBJECTIFS ANNONÇAIT « 2/5 » PENDANT QUE LA PUCE
 * JUSTE À CÔTÉ DISAIT « 5 EN COURS », sur un compte qui n'avait pas ouvert une
 * seule position du mois. Les deux chiffres sortaient du même tableau, à quinze
 * lignes d'écart dans le même fichier.
 *
 * ⚠️ LA RÈGLE ÉTAIT ÉCRITE, ET ELLE ÉTAIT JUSTE : « sans activité, pas de
 * verdict ». Un objectif PLAFOND (« pertes consécutives ≤ 2 », « trades par
 * jour ≤ 3 ») est atteint par construction tant que rien ne s'est passé, donc
 * la période sans activité ne se compte pas comme une victoire. `goalStatus`
 * l'appliquait ; le compteur de l'anneau, lui, lisait `met` tout cru, et le
 * bilan mensuel aussi. Les félicitations (confettis) partaient sur le même
 * `met` : le produit fêtait l'inactivité.
 *
 * ⚠️ C'EST POURQUOI LA RÈGLE VIT ICI plutôt que dans une page : trois écrans la
 * posaient, deux l'avaient oubliée.
 */

/** Le strict nécessaire pour juger un objectif, quelle que soit sa source. */
export interface ObjectifJugeable {
  kind: string;
  /** Objectif mesuré : la cible est-elle respectée sur la période ? */
  met?: boolean;
  /** Objectif personnel : le trader l'a-t-il coché ? */
  done?: boolean;
  /**
   * Y a-t-il eu la moindre activité sur la période ? `false` veut dire « on ne
   * conclut pas ». Absent = réponse servie avant ce champ : on ne rétrograde
   * pas un objectif pour une raison technique.
   */
  hadData?: boolean;
}

export function objectifAtteint(g: ObjectifJugeable): boolean {
  if (g.kind === "custom") return g.done === true;
  if (g.hadData === false) return false;
  return g.met === true;
}
