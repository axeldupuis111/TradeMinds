import type { CategorieInstrument, Instrument } from "./instruments";
import type { BlocDeclencheur, BlocNiveau, PlanExecution } from "./types";

/**
 * LE RÉFÉRENTIEL DES MÉTHODES PROFESSIONNELLES.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « Je ne veux pas que tu proposes juste d'ajouter le RSI avec ICT. Je veux de
 * vraies stratégies professionnelles. On va de plus en plus tomber sur des
 * utilisateurs avec des stratégies pro comme l'orderflow. Cette stratégie, si tu
 * peux la backtester c'est top, mais de mémoire y'a aucun moyen. Je veux quand
 * même que tu aides cet utilisateur, que tu le guides : ce se trouve il trade le
 * mauvais actif au mauvais moment, il utilise mal l'orderflow. »
 *
 * ── CE QUE CE FICHIER SAIT, ET CE QU'IL NE PRÉTEND PAS SAVOIR ───────────────
 *
 * ⚠️⚠️ UNE MÉTHODE NON REJOUABLE N'EST PAS UNE MÉTHODE SUR LAQUELLE ON N'A RIEN
 * À DIRE. C'est le cœur du fichier. On ne peut pas rejouer un carnet d'ordres,
 * mais on peut dire de quoi une méthode a BESOIN pour exister, et vérifier ces
 * besoins sans jamais lancer un backtest :
 *
 * - l'orderflow a besoin du volume d'échange réel, donc d'un marché centralisé
 *   (les futures) ; sur un CFD, le volume affiché est celui du courtier, c'est-
 *   à-dire quelques dizaines de participants sur des millions ;
 * - une méthode d'ouverture de séance n'a aucun sens hors de sa séance ;
 * - une méthode de continuation dans un marché sans tendance perd, quelle que
 *   soit la qualité d'exécution.
 *
 * Aucune de ces trois phrases n'est une prédiction, aucune ne demande de rejouer
 * quoi que ce soit, et chacune peut être TOUT ce dont le trader avait besoin.
 *
 * ⚠️ AUCUNE MÉTHODE N'EST DÉCLARÉE MEILLEURE QU'UNE AUTRE, et il n'y a aucun
 * classement. Une méthode pro n'est pas une méthode qui gagne, c'est une méthode
 * qui répond à toutes les questions et dont on connaît les conditions d'emploi.
 *
 * ⚠️ DES CODES, JAMAIS DES PHRASES. La rédaction vit dans les traductions, comme
 * partout ailleurs. Un test lit ce fichier et échoue si un code n'a pas sa clé.
 */

/**
 * Ce qu'une méthode exige comme données pour avoir un sens.
 *
 * ⚠️ NOS DONNÉES SONT DE L'OHLC À LA MINUTE, RIEN D'AUTRE. Tout ce qui n'est pas
 * `ohlc` dans cette liste est hors de portée du moteur, et l'écran doit le dire
 * au lieu de rendre un chiffre qui ne mesurerait pas la méthode du trader.
 */
export type BesoinDonnees =
  /** Ouverture, haut, bas, clôture. Ce que nous avons. */
  | "ohlc"
  /** Volume d'échange réel, donc marché centralisé. Pas le volume d'un courtier. */
  | "volume_reel"
  /** Séparation acheteur / vendeur agressif, à chaque prix. Footprint, delta. */
  | "delta"
  /** Profondeur du carnet, et son évolution. */
  | "carnet"
  /** Horodatage des annonces macro, pour une méthode qui les trade. */
  | "calendrier";

/** Ce que nos fichiers de bougies contiennent réellement. */
export const DONNEES_DISPONIBLES: BesoinDonnees[] = ["ohlc"];

/**
 * Le régime de marché dans lequel une méthode est faite pour vivre.
 *
 * ⚠️ Ce n'est pas une nuance d'école : une méthode de continuation appliquée
 * dans un range perd sur chaque faux départ, et c'est structurel, pas une
 * question de réglage.
 */
export type Regime = "tendance" | "range" | "expansion" | "contraction" | "evenement";

/** À quel point le catalogue de blocs sait reproduire la méthode. */
export type Mecanisation =
  /** Le moteur la rejoue telle qu'elle est décrite. */
  | "complete"
  /** Le décor est reproductible, le déclencheur ne l'est pas. */
  | "partielle"
  /** Rien de ce qui la définit n'est dans nos données. */
  | "aucune";

export interface Methode {
  /** Clé de traduction : `bt_meth_<code>` pour le nom, `_quoi` pour la description. */
  code: string;
  famille: "structure" | "flux" | "statistique" | "tendance" | "evenement";
  besoins: BesoinDonnees[];
  /** Catégories de marché où la méthode a un sens. Vide = toutes. */
  marches: CategorieInstrument[];
  regimes: Regime[];
  /** Ce qui la tue le plus souvent. Clés `bt_tueur_<code>`. */
  tueurs: string[];
  mecanisation: Mecanisation;
  /**
   * Ce que nos blocs savent approcher.
   *
   * ⚠️ `nonReproduit` EST LA PARTIE HONNÊTE. Elle liste ce que le backtest NE
   * teste pas, pour qu'un résultat sur le squelette ne se lise jamais comme un
   * résultat sur la méthode.
   */
  squelette?: {
    niveau?: BlocNiveau["type"];
    declencheur?: BlocDeclencheur["type"];
    /** Clés `bt_nonrep_<code>`. */
    nonReproduit: string[];
  };
  /** La fenêtre où la méthode a un sens, en heure de New York. */
  seance?: { debut: string; fin: string };
}

/**
 * LES MÉTHODES.
 *
 * ⚠️ LA LISTE EST OUVERTE ET NE PRÉTEND PAS ÊTRE COMPLÈTE. Elle couvre ce qu'on
 * rencontre réellement chez des traders qui ont une méthode nommée. Une méthode
 * absente n'est pas une méthode invalide : le diagnostic de complétude, lui,
 * fonctionne sans référentiel.
 */
export const METHODES: Methode[] = [
  // ── Structure : ce que le prix a laissé derrière lui ─────────────────────
  {
    code: "ict_liquidite",
    famille: "structure",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["expansion", "tendance"],
    tueurs: ["sans_invalidation", "heure_ignoree", "stop_trop_serre"],
    mecanisation: "complete",
    squelette: {
      niveau: "liquidite_swing",
      declencheur: "balayage_puis_fvg",
      nonReproduit: [],
    },
  },
  {
    code: "ict_silver_bullet",
    famille: "structure",
    besoins: ["ohlc"],
    marches: ["indices", "devises"],
    regimes: ["expansion"],
    tueurs: ["heure_ignoree", "cout_par_frequence", "stop_trop_serre"],
    mecanisation: "complete",
    squelette: { niveau: "fvg_zone", declencheur: "fvg_puis_retest", nonReproduit: [] },
    seance: { debut: "10:00", fin: "11:00" },
  },
  {
    code: "cassure_structure",
    famille: "structure",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["tendance", "expansion"],
    tueurs: ["regime_absent", "sans_invalidation", "sur_optimisation"],
    mecanisation: "complete",
    squelette: {
      niveau: "liquidite_swing",
      declencheur: "retest_apres_cassure",
      nonReproduit: [],
    },
  },
  {
    code: "trendline",
    famille: "structure",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["tendance"],
    tueurs: ["trace_subjective", "sans_invalidation", "stop_trop_serre"],
    mecanisation: "complete",
    squelette: { niveau: "trendline", declencheur: "cassure", nonReproduit: [] },
  },
  {
    code: "supply_demand",
    famille: "structure",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["range", "tendance"],
    tueurs: ["zone_trop_large", "regime_absent", "sans_invalidation"],
    mecanisation: "complete",
    squelette: { niveau: "order_block", declencheur: "entree_dans_zone", nonReproduit: [] },
  },
  {
    code: "fibonacci_ote",
    famille: "structure",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["tendance"],
    tueurs: ["regime_absent", "trace_subjective", "sur_optimisation"],
    mecanisation: "complete",
    squelette: { niveau: "ote_fibonacci", declencheur: "entree_dans_zone", nonReproduit: [] },
  },

  // ── Flux : qui achète, qui vend, et avec quelle agressivité ──────────────
  {
    code: "orderflow_absorption",
    famille: "flux",
    besoins: ["ohlc", "volume_reel", "delta"],
    marches: ["indices", "energie", "metaux"],
    regimes: ["range", "contraction"],
    tueurs: ["volume_du_courtier", "latence", "niveau_absent", "taille_variable"],
    mecanisation: "partielle",
    squelette: {
      niveau: "extremes_veille",
      nonReproduit: ["absorption", "delta_agressif", "empreinte"],
    },
  },
  {
    code: "orderflow_carnet",
    famille: "flux",
    besoins: ["ohlc", "carnet", "delta"],
    marches: ["indices", "energie"],
    regimes: ["contraction", "evenement"],
    tueurs: ["volume_du_courtier", "latence", "leurres_carnet", "cout_par_frequence"],
    mecanisation: "aucune",
    squelette: { nonReproduit: ["carnet_profondeur", "delta_agressif", "leurres_carnet"] },
  },
  {
    code: "volume_profile",
    famille: "flux",
    besoins: ["ohlc", "volume_reel"],
    marches: ["indices", "energie", "metaux"],
    regimes: ["range", "tendance"],
    tueurs: ["volume_du_courtier", "niveau_absent", "regime_absent"],
    mecanisation: "partielle",
    squelette: {
      niveau: "vwap_session",
      declencheur: "entree_dans_zone",
      nonReproduit: ["poc_volume", "zone_de_valeur"],
    },
  },
  {
    code: "wyckoff",
    famille: "flux",
    besoins: ["ohlc", "volume_reel"],
    marches: [],
    regimes: ["contraction", "expansion"],
    tueurs: ["volume_du_courtier", "lecture_apres_coup", "sans_invalidation"],
    mecanisation: "partielle",
    squelette: {
      niveau: "range_horaire",
      declencheur: "balayage_retour",
      nonReproduit: ["phases", "effort_contre_resultat"],
    },
  },

  // ── Statistique : on joue une régularité, pas une histoire ───────────────
  {
    code: "vwap_reversion",
    famille: "statistique",
    besoins: ["ohlc"],
    marches: ["indices", "metaux", "energie"],
    regimes: ["range"],
    tueurs: ["regime_absent", "sans_stop_dur", "cout_par_frequence"],
    mecanisation: "complete",
    squelette: { niveau: "vwap_session", declencheur: "entree_dans_zone", nonReproduit: [] },
  },
  {
    code: "retour_moyenne",
    famille: "statistique",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["range", "contraction"],
    tueurs: ["regime_absent", "sans_stop_dur", "serie_de_pertes"],
    mecanisation: "complete",
    squelette: { niveau: "bollinger", declencheur: "entree_dans_zone", nonReproduit: [] },
  },
  {
    code: "opening_range",
    famille: "statistique",
    besoins: ["ohlc"],
    marches: ["indices", "metaux"],
    regimes: ["expansion"],
    tueurs: ["heure_ignoree", "faux_departs", "cout_par_frequence"],
    mecanisation: "complete",
    squelette: { niveau: "range_horaire", declencheur: "cassure", nonReproduit: [] },
    seance: { debut: "09:30", fin: "11:30" },
  },

  // ── Tendance : on accepte de perdre souvent pour gagner gros ─────────────
  {
    code: "suivi_tendance",
    famille: "tendance",
    besoins: ["ohlc"],
    marches: [],
    regimes: ["tendance"],
    tueurs: ["objectif_trop_court", "serie_de_pertes", "regime_absent"],
    mecanisation: "complete",
    squelette: { niveau: "moyenne_mobile", declencheur: "cassure", nonReproduit: [] },
  },

  // ── Événement : on trade une annonce, pas un graphique ───────────────────
  {
    code: "news_scalping",
    famille: "evenement",
    besoins: ["ohlc", "calendrier"],
    marches: ["devises", "indices", "metaux"],
    regimes: ["evenement"],
    tueurs: ["latence", "ecart_de_cotation", "cout_par_frequence", "taille_variable"],
    mecanisation: "aucune",
    squelette: { nonReproduit: ["horodatage_annonce", "ecart_de_cotation", "latence"] },
  },
];

export function methodeParCode(code: string): Methode | undefined {
  return METHODES.find((m) => m.code === code);
}

/**
 * Ce qu'une méthode réclame et que nos données n'ont pas.
 *
 * ⚠️ C'EST LA FONCTION QUI DIT « JE NE PEUX PAS », ET ELLE LE DIT AVANT DE
 * CALCULER. Rendre un chiffre sur une méthode dont on n'a pas les données, c'est
 * mesurer autre chose que la méthode du trader, et il n'aurait aucun moyen de
 * s'en apercevoir.
 */
export function besoinsNonCouverts(m: Methode): BesoinDonnees[] {
  return m.besoins.filter((b) => !DONNEES_DISPONIBLES.includes(b));
}

/**
 * Ce que le diagnostic d'une méthode peut reprocher, sans rien prédire.
 *
 * ⚠️ CHAQUE CODE EST UNE COMPARAISON VÉRIFIABLE, jamais un avis. « Ta méthode a
 * besoin de volume réel et tu la joues sur un CFD » est un fait ; « ta méthode
 * n'est pas bonne » n'en serait pas un.
 */
export type CodeConstatMethode =
  /** La méthode réclame des données que nous n'avons pas. */
  | "donnees_absentes"
  /** Le volume affiché par un courtier de CFD n'est pas le volume du marché. */
  | "volume_du_courtier"
  /** La catégorie de marché testée n'est pas de celles où la méthode vit. */
  | "marche_hors_methode"
  /** La plage horaire du plan ne recoupe pas la séance de la méthode. */
  | "hors_seance"
  /** Le squelette est testable, le déclencheur ne l'est pas. */
  | "squelette_seulement";

export interface ConstatMethode {
  code: CodeConstatMethode;
  /** Des nombres et des codes, jamais de phrase. */
  valeurs: Record<string, string | number>;
}

/** Les catégories où le volume publié est celui du courtier, pas du marché. */
const VOLUME_LOCAL: CategorieInstrument[] = ["devises", "indices", "metaux", "energie"];

function enMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Deux plages horaires se recoupent-elles, dans la même journée ? */
function seRecoupent(a: { debut: string; fin: string }, b: { debut: string; fin: string }): boolean {
  const [d1, f1] = [enMinutes(a.debut), enMinutes(a.fin)];
  const [d2, f2] = [enMinutes(b.debut), enMinutes(b.fin)];
  return Math.max(d1, d2) < Math.min(f1, f2);
}

/**
 * Confronte une méthode déclarée au marché et aux heures réellement testés.
 *
 * ⚠️ AUCUN BACKTEST N'EST LANCÉ ICI, et c'est le point. Un trader d'orderflow
 * sur EUR/USD chez son courtier a peut-être toute son explication dans la
 * première ligne rendue par cette fonction, sans qu'aucune bougie n'ait été lue.
 */
export function diagnostiquerMethode(
  m: Methode,
  instrument: Instrument,
  plan?: Pick<PlanExecution, "contexte">,
): ConstatMethode[] {
  const out: ConstatMethode[] = [];

  const manquants = besoinsNonCouverts(m);
  if (manquants.length > 0) {
    out.push({
      code: "donnees_absentes",
      valeurs: { besoins: manquants.join(", "), n: manquants.length },
    });
  }

  // ⚠️ LE PIÈGE LE PLUS COÛTEUX DE TOUTE LA FAMILLE « FLUX ». Le volume d'un CFD
  // est celui des clients du courtier : quelques dizaines de participants là où
  // la méthode suppose l'ensemble du marché. Ce n'est pas une approximation
  // grossière, c'est une autre grandeur.
  if (m.besoins.includes("volume_reel") && VOLUME_LOCAL.includes(instrument.categorie)) {
    out.push({ code: "volume_du_courtier", valeurs: { instrument: instrument.nom } });
  }

  if (m.marches.length > 0 && !m.marches.includes(instrument.categorie)) {
    out.push({
      code: "marche_hors_methode",
      valeurs: { instrument: instrument.nom, categorie: instrument.categorie },
    });
  }

  if (m.seance && plan && !seRecoupent(m.seance, plan.contexte)) {
    out.push({
      code: "hors_seance",
      valeurs: {
        seance: `${m.seance.debut} → ${m.seance.fin}`,
        tienne: `${plan.contexte.debut} → ${plan.contexte.fin}`,
      },
    });
  }

  if (m.mecanisation === "partielle" && m.squelette) {
    out.push({
      code: "squelette_seulement",
      valeurs: { n: m.squelette.nonReproduit.length },
    });
  }

  return out;
}
