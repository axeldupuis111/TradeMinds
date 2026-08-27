/**
 * L'ÉCHELLE VERTICALE DU GRAPHIQUE D'INSPECTION.
 *
 * Sortie en fonction pure parce que c'est exactement là que le premier rendu
 * s'est cassé, et que le défaut était invisible autrement qu'en regardant.
 *
 * ── LE PROBLÈME, TEL QU'IL S'EST PRÉSENTÉ ───────────────────────────────────
 *
 * En calant l'échelle sur toutes les bougies visibles, un trade dont le risque
 * vaut 3 points s'écrase à un millimètre dans une fenêtre qui en couvre 60 :
 * stop, entrée et objectif se superposent en une bande unique. Le graphique
 * s'affiche, il est joli, et il ne permet plus de vérifier quoi que ce soit,
 * c'est-à-dire qu'il ne sert plus à rien.
 *
 * ⚠️ LE TRADE PRIME SUR LE CONTEXTE. On borne la hauteur affichée à un multiple
 * de l'écart stop-objectif : au-delà, les bougies sont rognées. Perdre le haut
 * d'une mèche lointaine est sans conséquence ; perdre la distance entre son
 * stop et son entrée rend la vérification impossible.
 */

export interface GeometrieApercu {
  /** Extrêmes des bougies de la fenêtre. */
  hautBougies: number;
  basBougies: number;
  /** Les quatre prix du trade, plus le niveau franchi. */
  entree: number;
  stop: number;
  objectif: number;
  sortie: number;
  niveau: number;
}

/**
 * Part minimale de la hauteur que doit occuper l'écart entre le stop et
 * l'objectif. À un tiers, les trois traits sont toujours nettement séparés.
 */
const PART_MIN_DU_TRADE = 1 / 4;

/** Air laissé au-dessus et en dessous, en part de l'amplitude retenue. */
const MARGE = 0.08;

export interface Echelle {
  haut: number;
  bas: number;
  /**
   * Faux quand le niveau franchi tombe hors du cadre. L'interface affiche alors
   * sa valeur en marge au lieu de le tracer.
   *
   * ⚠️ LE NIVEAU N'ANCRE PAS L'ÉCHELLE, ET C'EST UNE CORRECTION, PAS UN CHOIX
   * D'ORIGINE. Sur un retest de déséquilibre, l'entrée se fait parfois à
   * quarante points du niveau cassé : en le comptant dans l'amplitude du trade,
   * cinq trades sur treize retombaient à trois pixels d'écart entre le stop et
   * l'entrée, c'est-à-dire au défaut qu'on venait de corriger.
   */
  niveauVisible: boolean;
}

export function echelleApercu(g: GeometrieApercu, tailleTick: number): Echelle {
  // Ce que le trade occupe : c'est lui qu'on doit pouvoir lire. Le niveau en
  // est exclu, voir l'avertissement sur `niveauVisible`.
  const hautTrade = Math.max(g.entree, g.stop, g.objectif, g.sortie);
  const basTrade = Math.min(g.entree, g.stop, g.objectif, g.sortie);
  const spanTrade = Math.max(hautTrade - basTrade, tailleTick);
  const centre = (hautTrade + basTrade) / 2;

  // Plafond de hauteur : au-delà, on rogne les bougies plutôt que d'écraser le
  // trade. `1 / PART_MIN_DU_TRADE` = 3 : le trade garde au moins un tiers.
  const spanMax = spanTrade / PART_MIN_DU_TRADE;
  let haut = Math.min(g.hautBougies, centre + spanMax / 2);
  let bas = Math.max(g.basBougies, centre - spanMax / 2);

  // Le trade doit tenir en entier, quoi qu'il arrive : c'est la seule chose
  // qu'on ne rogne jamais.
  haut = Math.max(haut, hautTrade);
  bas = Math.min(bas, basTrade);

  const amplitude = Math.max(haut - bas, tailleTick);
  const avecMarge = { haut: haut + amplitude * MARGE, bas: bas - amplitude * MARGE };
  return {
    ...avecMarge,
    niveauVisible: g.niveau <= avecMarge.haut && g.niveau >= avecMarge.bas,
  };
}
