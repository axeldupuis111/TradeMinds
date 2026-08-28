import type { TradeSimule } from "./types";

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
   * Faux quand l'objectif tombe hors du cadre.
   *
   * ⚠️ NÉ D'UN ÉCRAN INUTILISABLE. L'objectif entrait dans l'ancrage de
   * l'échelle au même titre que l'entrée et le stop. Sur un trade perdant à 2R,
   * il se trouve donc à deux fois le risque au-dessus de l'entrée, dans une
   * zone où le prix n'est JAMAIS allé : le cadre s'étirait pour l'accueillir et
   * les bougies s'écrasaient sur le tiers inférieur. Mesuré sur une capture
   * réelle : 60 % de la hauteur en blanc, au-dessus du seul trait qui décrivait
   * quelque chose qui n'a pas eu lieu.
   *
   * LE CADRE MONTRE CE QUI S'EST PASSÉ, PAS CE QUI ÉTAIT ESPÉRÉ. L'objectif
   * atteint est dans le cadre par la sortie ; l'objectif manqué s'affiche en
   * marge, comme le niveau.
   */
  objectifVisible: boolean;
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
  // Ce que le trade occupe : c'est lui qu'on doit pouvoir lire. Le niveau et
  // l'objectif en sont exclus, voir les avertissements sur `niveauVisible` et
  // `objectifVisible`. La SORTIE, elle, y est : c'est un fait du trade, et sur
  // un trade gagnant elle vaut justement l'objectif.
  const hautTrade = Math.max(g.entree, g.stop, g.sortie);
  const basTrade = Math.min(g.entree, g.stop, g.sortie);
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
    objectifVisible: g.objectif <= avecMarge.haut && g.objectif >= avecMarge.bas,
    niveauVisible: g.niveau <= avecMarge.haut && g.niveau >= avecMarge.bas,
  };
}

/**
 * Un point a dessiner : une abscisse en INDEX DE BOUGIE relatif a la fenetre,
 * et un prix.
 *
 * ⚠️⚠️ EN INDEX, PAS EN MILLISECONDES, ET C'EST UNE CORRECTION MESUREE. Le
 * moteur interpole une trendline sur l'INDEX des bougies (`valeurDroite`),
 * tandis que le graphique la redessinait sur l'HORODATAGE en supposant un pas
 * de temps constant. Les deux ne coincident que sur un marche ouvert en
 * continu : des qu'une nuit ou un week-end passe, la droite affichee derive de
 * la droite calculee, et ses propres touches cessent de tomber dessus. Sur le
 * Nasdaq, l'ecart atteignait plusieurs centaines de points : le trader voyait
 * une « trendline » qui ne touchait rien, et ne pouvait donc plus rien
 * reconnaitre.
 *
 * L'axe horizontal du graphique EST un axe d'index : une bougie, une colonne.
 * On y porte donc des index, et l'accord avec le moteur est exact par
 * construction. L'index peut etre negatif (un ancrage anterieur a la fenetre
 * affichee) : la droite sort alors du cadre par la gauche, ce qui est voulu.
 */
export interface PointDessin {
  i: number;
  prix: number;
}

/** La geometrie du niveau, en unites de PRIX, prete a dessiner. */
export type TraceDessin =
  | { forme: "droite"; a: PointDessin; b: PointDessin; touches: PointDessin[] }
  | { forme: "horizontale"; prix: number }
  | { forme: "zone"; haut: number; bas: number; debut: number; fin: number };

/** La geometrie de la MECANIQUE d'entree, en unites de PRIX. */
export type MecaniqueDessin =
  | {
      forme: "desequilibre";
      haut: number;
      bas: number;
      debut: number;
      fin: number;
      bord: number;
    }
  | { forme: "balayage"; niveau: number; extreme: number; i: number };

/**
 * Convertit ce que le moteur a retenu (des ticks et des horodatages) en ce que
 * le graphique dessine (des prix et des index de colonne).
 *
 * ⚠️ La table `indexParMs` n'est pas un luxe : le pas entre deux bougies n'est
 * PAS constant. Toute conversion par division se trompe des qu'une fermeture
 * passe, et c'est precisement le bug que cette fonction repare.
 */
export function geometrieDessin(
  trade: TradeSimule,
  indexParMs: Map<number, number>,
  debut: number,
  tick: number,
): { trace?: TraceDessin; mecanique?: MecaniqueDessin[] } {
  /** Horodatage -> index relatif au debut de la fenetre affichee. */
  const rel = (ms: number) => (indexParMs.get(ms) ?? debut) - debut;

  const brute = trade.trace;
  const trace: TraceDessin | undefined =
    brute?.forme === "droite"
      ? {
          forme: "droite",
          a: { i: rel(brute.a.ms), prix: brute.a.prixTicks * tick },
          b: { i: rel(brute.b.ms), prix: brute.b.prixTicks * tick },
          touches: brute.touches.map((x) => ({ i: rel(x.ms), prix: x.prixTicks * tick })),
        }
      : brute?.forme === "zone"
        ? {
            forme: "zone",
            haut: brute.hautTicks * tick,
            bas: brute.basTicks * tick,
            debut: rel(brute.debutMs),
            fin: rel(brute.finMs),
          }
        : brute?.forme === "horizontale"
          ? { forme: "horizontale", prix: brute.prixTicks * tick }
          : undefined;

  const mecanique = trade.mecanique?.map<MecaniqueDessin>((m) =>
    m.forme === "balayage"
      ? {
          forme: "balayage",
          niveau: m.niveauTicks * tick,
          extreme: m.extremeTicks * tick,
          i: rel(m.ms),
        }
      : {
          forme: "desequilibre",
          haut: m.hautTicks * tick,
          bas: m.basTicks * tick,
          debut: rel(m.debutMs),
          fin: rel(m.finMs),
          bord: m.bordTicks * tick,
        },
  );

  return { trace, mecanique };
}


/**
 * Combien de bougies on montre avant le signal et apres la sortie, et jusqu'ou
 * on accepte d'elargir pour faire tenir un ancrage de droite tres ancien.
 */
export const FENETRE = {
  avant: 40,
  apres: 15,
  /** Marge devant le premier ancrage d'une droite, quand on remonte jusqu'a lui. */
  margeAncre: 8,
  /**
   * Largeur au-dela de laquelle les bougies deviennent illisibles.
   *
   * ⚠️ Une trendline peut s'ancrer tres loin en arriere. Sans borne, la fenetre
   * atteint des centaines de bougies et chacune devient un cheveu : on aurait
   * remplace un graphique illisible par un autre.
   */
  max: 140,
};

/**
 * LES BORNES DE LA FENETRE D'APERCU.
 *
 * ⚠️⚠️ LE SIGNAL DOIT TOUJOURS Y ETRE. C'est la borne dure, et elle vient d'un
 * defaut vu sur une capture. L'ancienne version bornait la largeur en rognant a
 * gauche depuis la SORTIE (`debut = fin - max`). Des qu'un trade durait plus de
 * cent quarante bougies, ce rognage passait DEVANT l'entree : l'apercu montrait
 * une fin de trade sans son debut, le trait d'entree flottait sous toutes les
 * bougies visibles, et le trader n'avait aucun moyen de comprendre ce qu'il
 * regardait. C'est pourtant l'ecran cense lui faire dire « oui, c'est ma
 * methode ».
 *
 * Un trade plus long que `max` rend donc une fenetre plus large : des bougies
 * fines valent mieux qu'un trade ampute.
 */
export function fenetreApercu(
  iSignal: number,
  iSortie: number,
  iAncre: number,
  nBougies: number,
): { debut: number; fin: number } {
  const debutMin = Math.max(0, iSignal - FENETRE.avant);
  const fin = Math.min(nBougies - 1, iSortie + FENETRE.apres);
  let debut = Math.max(0, Math.min(debutMin, iAncre - FENETRE.margeAncre));
  if (fin - debut > FENETRE.max) {
    debut = Math.min(debutMin, Math.max(debut, fin - FENETRE.max));
  }
  return { debut, fin };
}
