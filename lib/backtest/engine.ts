import type {
  AuditExecution,
  BlocConfirmation,
  Contexte,
  Couts,
  JourSemaine,
  MotifSortie,
  PlanExecution,
  ResultatBacktest,
  SerieM1,
  TraceMecanique,
  TraceSignal,
  TradeSimule,
} from "./types";
import { agreger } from "./serie";

/**
 * LE MOTEUR : rejoue un plan mécanique sur des bougies M1 réelles.
 *
 * ── LES TROIS RÈGLES QUI FONT QU'UN BACKTEST N'EST PAS UN MENSONGE ──────────
 *
 * 1. ON NE DÉCIDE JAMAIS AVEC UNE BOUGIE QU'ON N'A PAS VUE FINIR. Le signal
 *    s'évalue sur une bougie clôturée, et l'entrée se fait à l'OUVERTURE de la
 *    suivante. C'est la seule séquence qu'un trader pourrait vraiment exécuter.
 *    ⚠️ Ce n'est pas garanti par un compteur affiché à l'écran, c'est garanti
 *    par la STRUCTURE de la boucle ci-dessous, et épinglé par des tests. Un
 *    badge « 0 violation » calculé par le même code qui produirait la violation
 *    ne prouve rien, c'est du théâtre.
 *
 * 2. QUAND LE STOP ET L'OBJECTIF TOMBENT DANS LA MÊME BOUGIE, C'EST UNE PERTE.
 *    En M1 on ne sait pas lequel des deux a été touché en premier. Choisir le
 *    gain transformerait l'ignorance en performance. On choisit le stop, ET on
 *    publie le nombre de fois où le cas s'est produit : si ce nombre est gros,
 *    le résultat entier dépend d'une convention, et le trader doit le savoir.
 *
 * 3. LE COÛT EST DÉDUIT DANS LA MÊME PASSE QUE LE GAIN. Chaque trade porte son
 *    résultat net ET son résultat brut. La différence est le coût, elle n'est
 *    jamais recalculée ailleurs. Un audit de coûts écrit à côté du moteur finit
 *    toujours par diverger de lui, et c'est l'audit qu'on croit.
 *
 * ⚠️ CE QUE CE MOTEUR NE SAIT PAS, ET QUE L'INTERFACE DOIT DIRE. Il ne connaît
 * ni les carnets d'ordres, ni les rejets de courtier, ni les élargissements de
 * spread sur news, ni le fait que le trader dormait. Il rejoue une machine
 * parfaitement obéissante sur des données propres. Le résultat est un plafond
 * de ce qui était atteignable, pas une prévision de ce qui arrivera.
 */

/**
 * Tout ce qui sert à REDESSINER le setup, figé au moment du signal.
 *
 * Regroupé plutôt que passé pièce par pièce : la géométrie voyage du signal à
 * l'ouverture puis à la fermeture, et un paramètre positionnel de plus à chaque
 * forme dessinée finissait par rendre les appels illisibles.
 */
interface GeoSignal {
  trace?: TraceSignal;
  mecanique?: TraceMecanique[];
}

/** Un ordre en attente d'exécution. */
interface EntreeEnAttente {
  sens: "long" | "short";
  /** Index de la bougie de signal. Sert au stop structurel. */
  barreSignal: number;
  /** Pour un ordre limite : prix visé, en ticks. */
  prixLimite?: number;
  /** Pour un ordre limite : dernière bougie où il reste valable. */
  valableJusqua?: number;
  /**
   * Extrême du balayage de liquidité qui a ouvert le scénario. Voyage avec
   * l'ordre parce que le stop `extreme_balayage` en a besoin à l'ouverture,
   * c'est-à-dire une bougie APRÈS que la machine à états l'ait oublié.
   */
  extremeBalayage?: number;
  /**
   * Dernier sommet et dernier creux pivots connus AU MOMENT DU SIGNAL. Ils
   * voyagent avec l'ordre parce qu'un nouveau pivot peut se confirmer entre le
   * signal et l'entrée : le stop doit être celui que le trader voyait quand il
   * a décidé, pas celui d'une bougie plus tard.
   */
  dernierSommet?: number;
  dernierCreux?: number;
  /** Horodatage et niveau de la bougie de signal, pour l'inspection visuelle. */
  signalMs: number;
  niveauSignal: number;
  geo: GeoSignal;
}

interface Position {
  sens: "long" | "short";
  /** Prix d'entrée théorique, sans coût. Dénominateur du R. */
  entreeBrute: number;
  /** Prix d'entrée payé, coûts inclus. */
  entreeEffective: number;
  /** Niveau de stop courant, en ticks. Bouge avec le break-even. */
  stop: number;
  /** Niveau de stop d'origine. Sert à mesurer l'avancée en R. */
  stopInitial: number;
  objectif: number;
  /** Distance entrée brute - stop initial. C'est le 1R du trade. */
  risqueTicks: number;
  barreEntree: number;
  msEntree: number;
  breakEvenPose: boolean;
  signalMs: number;
  niveauSignal: number;
  geo: GeoSignal;
}

/** Décalage local, en minutes, mis en cache par heure UTC. */
function fabriqueHorloge(fuseau: string) {
  const cache = new Map<number, number>();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Les transitions d'heure d'été tombent toujours sur une heure pile : un
  // décalage recalculé à chaque heure UTC est donc exact, et ça fait 24 appels
  // par jour au lieu de 1440.
  function decalage(ms: number): number {
    const cle = Math.floor(ms / 3_600_000);
    const vu = cache.get(cle);
    if (vu !== undefined) return vu;
    const p = fmt.formatToParts(new Date(ms));
    const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    let heure = get("hour");
    if (heure === 24) heure = 0; // en-US rend parfois "24" pour minuit
    const commeUtc = Date.UTC(get("year"), get("month") - 1, get("day"), heure, get("minute"));
    const d = Math.round((commeUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
    cache.set(cle, d);
    return d;
  }
  return {
    /** Minutes écoulées depuis minuit local. */
    minutes(ms: number): number {
      const local = ms + decalage(ms) * 60_000;
      return Math.floor(local / 60_000) % 1440;
    },
    /** Numéro de jour local, pour détecter les changements de journée. */
    jour(ms: number): number {
      const local = ms + decalage(ms) * 60_000;
      return Math.floor(local / 86_400_000);
    },
    /** Jour de la semaine local, 0 = dimanche. */
    jourSemaine(ms: number): number {
      const local = ms + decalage(ms) * 60_000;
      return (Math.floor(local / 86_400_000) + 4) % 7; // 1970-01-01 était un jeudi
    },
  };
}

/** "HH:MM" en minutes depuis minuit. Renvoie null si la forme est invalide. */
export function minutesDepuisHeure(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * VWAP de séance, remis à zéro à chaque changement de journée locale.
 *
 * ⚠️ ON N'A PAS LE VOLUME : les bougies stockées sont OHLC seulement. On pondère
 * donc par l'AMPLITUDE de chaque bougie, qui lui est fortement corrélée. C'est
 * une approximation assumée, déclarée à l'écran, et elle ne doit jamais être
 * présentée comme le VWAP du courtier : les deux courbes se ressemblent sans se
 * superposer.
 */
function vwapSession(
  h: Int32Array,
  l: Int32Array,
  c: Int32Array,
  t: Float64Array,
  jourDe: (ms: number) => number,
): Float64Array {
  const out = new Float64Array(h.length).fill(NaN);
  let jour = -1;
  let sommePoids = 0;
  let sommeValeur = 0;
  for (let i = 0; i < h.length; i++) {
    const j = jourDe(t[i]);
    if (j !== jour) {
      jour = j;
      sommePoids = 0;
      sommeValeur = 0;
    }
    const typique = (h[i] + l[i] + c[i]) / 3;
    // Plancher à 1 : une bougie plate aurait un poids nul et disparaîtrait de
    // la moyenne, ce qui est faux, elle a bien traité.
    const poids = Math.max(1, h[i] - l[i]);
    sommePoids += poids;
    sommeValeur += typique * poids;
    out[i] = sommeValeur / sommePoids;
  }
  return out;
}

/**
 * Écart-type mobile des clôtures, sur `periode` bougies.
 * Sert aux bandes de Bollinger. NaN tant que la fenêtre est incomplète.
 */
function ecartTypeMobile(c: Int32Array, periode: number, sma: Float64Array): Float64Array {
  const out = new Float64Array(c.length).fill(NaN);
  for (let i = periode - 1; i < c.length; i++) {
    let somme = 0;
    for (let j = i - periode + 1; j <= i; j++) {
      const d = c[j] - sma[i];
      somme += d * d;
    }
    out[i] = Math.sqrt(somme / periode);
  }
  return out;
}

/**
 * RSI de Wilder, sur `periode` bougies.
 *
 * ⚠️ Le lissage de Wilder, pas une moyenne simple : c'est celui de toutes les
 * plateformes. Une moyenne simple donne des valeurs proches mais différentes,
 * et un trader qui compare notre chiffre au sien sur TradingView verrait un
 * écart qu'il attribuerait, à raison, à une erreur.
 */
function rsiWilder(c: Int32Array, periode: number): Float64Array {
  const out = new Float64Array(c.length).fill(NaN);
  if (c.length <= periode) return out;

  let gains = 0;
  let pertes = 0;
  for (let i = 1; i <= periode; i++) {
    const d = c[i] - c[i - 1];
    if (d > 0) gains += d;
    else pertes -= d;
  }
  let moyGain = gains / periode;
  let moyPerte = pertes / periode;
  out[periode] = moyPerte === 0 ? 100 : 100 - 100 / (1 + moyGain / moyPerte);

  for (let i = periode + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    moyGain = (moyGain * (periode - 1) + Math.max(0, d)) / periode;
    moyPerte = (moyPerte * (periode - 1) + Math.max(0, -d)) / periode;
    out[i] = moyPerte === 0 ? 100 : 100 - 100 / (1 + moyGain / moyPerte);
  }
  return out;
}

/** Moyenne mobile simple, précalculée. NaN tant que la fenêtre est incomplète. */
function moyenneMobile(c: Int32Array, periode: number): Float64Array {
  const out = new Float64Array(c.length).fill(NaN);
  let somme = 0;
  for (let i = 0; i < c.length; i++) {
    somme += c[i];
    if (i >= periode) somme -= c[i - periode];
    if (i >= periode - 1) out[i] = somme / periode;
  }
  return out;
}

export function lancerBacktest(serieBrute: SerieM1, plan: PlanExecution): ResultatBacktest {
  // Les bougies stockées sont des M1 ; le trader lit peut-être en M3 ou en M15.
  // Le regroupement se fait ICI, une fois, à partir des vraies minutes : les
  // mèches d'une bougie M3 sont alors celles que le marché a imprimées.
  const serie = agreger(serieBrute, plan.uniteDeTemps ?? 1);
  const { t, o, h, l, c } = serie;
  const n = t.length;
  const horloge = fabriqueHorloge(plan.contexte.fuseau);

  const debutFenetre = minutesDepuisHeure(plan.contexte.debut) ?? 0;
  const finFenetre = minutesDepuisHeure(plan.contexte.fin) ?? 1440;
  const finSession = plan.sortiesAuxiliaires.finDeSession
    ? minutesDepuisHeure(plan.sortiesAuxiliaires.finDeSession)
    : null;
  const joursAutorises = new Set(plan.contexte.jours);

  const confBiais = plan.confirmations.find((x) => x.type === "biais_moyenne");
  const sma = confBiais && confBiais.type === "biais_moyenne" ? moyenneMobile(c, confBiais.periode) : null;

  // ── Indicateurs, précalculés UNE FOIS et seulement si le plan les demande.
  //    Les recalculer dans la boucle multiplierait le temps par la période.
  const confRsi = plan.confirmations.find((x) => x.type === "rsi");
  const rsi = confRsi && confRsi.type === "rsi" ? rsiWilder(c, confRsi.periode) : null;

  const smaNiveau =
    plan.niveau.type === "moyenne_mobile"
      ? moyenneMobile(c, plan.niveau.periode)
      : plan.niveau.type === "bollinger"
        ? moyenneMobile(c, plan.niveau.periode)
        : null;
  const ecartType =
    plan.niveau.type === "bollinger" && smaNiveau
      ? ecartTypeMobile(c, plan.niveau.periode, smaNiveau)
      : null;
  const vwap =
    plan.niveau.type === "vwap_session"
      ? vwapSession(h, l, c, t, (ms) => horloge.jour(ms))
      : null;

  const trades: TradeSimule[] = [];
  const audit: AuditExecution = {
    bougies: n,
    signaux: 0,
    refusesParGestion: 0,
    limitesExpirees: 0,
    refusesRisqueTropPetit: 0,
    journeesArretees: 0,
    barresAvecNiveau: 0,
    droitesTracees: 0,
    droitesConfirmees: 0,
    collisions: 0,
    coutTotalR: 0,
  };

  // ── État de la journée locale. Tout est remis à zéro au changement de jour :
  // un niveau tracé hier ne vaut rien aujourd'hui, et un compteur de pertes qui
  // franchirait minuit interdirait de trader le lendemain sans raison.
  let jourCourant = -1;
  let jourAutorise = false;
  let hautNiveau: number | null = null;
  let basNiveau: number | null = null;
  let hautEnCours = -Infinity;
  let basEnCours = Infinity;
  let hautVeille: number | null = null;
  let basVeille: number | null = null;
  let hautJour = -Infinity;
  let basJour = Infinity;
  let tradesJour = 0;
  let pertesAffilee = 0;
  let cumulRJour = 0;
  let journeeArretee = false;

  // État des déclencheurs à deux temps (retest, FVG).
  let cassureSens: "long" | "short" | null = null;
  let cassureBarre = -1;
  let fvgBord = 0; // bord du déséquilibre à retester, en ticks
  // La BOÎTE du déséquilibre, pour la redessiner telle quelle. Un seul jeu de
  // variables : `fvg_puis_retest` et `balayage_puis_fvg` ne tournent jamais
  // ensemble, le type de déclencheur est figé pour toute la simulation.
  let fvgHaut = 0;
  let fvgBas = 0;
  let fvgDebut = -1; // index de la première des trois bougies
  // Le niveau dont la liquidité a été prise, à distinguer de l'extrême atteint.
  let balayageNiveau = 0;

  // ── Dernier pivot confirmé de chaque type. Un pivot regarde des DEUX côtés,
  //    il n'est donc lisible que `pivots` bougies après s'être formé. Il sert à
  //    deux choses : ouvrir une droite candidate avec le pivot suivant, et
  //    porter le stop « derrière le dernier sommet ».
  let sommetB: { i: number; prix: number } | null = null;
  let creuxB: { i: number; prix: number } | null = null;

  /**
   * Une droite candidate ou confirmée : deux ancrages, un compte de touches, et
   * un drapeau de mort. Les ancrages ne bougent JAMAIS après la création : les
   * touches suivantes confirment la droite sans la faire pivoter, comme un
   * trait tracé à la main.
   */
  interface Droite {
    i1: number;
    p1: number;
    i2: number;
    p2: number;
    touches: number;
    morte: boolean;
    /**
     * Les pivots qui ont touche la droite, ancrages compris.
     *
     * ⚠️ Gardes pour etre REDESSINES. Un trader qui ne voit pas ses trois
     * touches ne peut ni reconnaitre ni dementir son setup, et toute la boucle
     * de verification tombe : il regarde des bougies et trois traits plats.
     */
    points: { i: number; prix: number }[];
  }
  let ligneBas: Droite | null = null;
  let ligneHaut: Droite | null = null;

  /** Valeur d'une droite en `i`, arrondie au tick. */
  function valeurDroite(d: Droite, i: number): number {
    return Math.round(d.p1 + ((d.p2 - d.p1) * (i - d.i1)) / (d.i2 - d.i1));
  }

  /**
   * Intègre un nouveau pivot : soit il tombe sur la droite en cours et la
   * confirme, soit il ouvre une nouvelle droite candidate avec le pivot
   * précédent.
   */
  function integrerPivot(
    courante: Droite | null,
    precedent: { i: number; prix: number } | null,
    p: number,
    prix: number,
    tolerance: number,
    touchesMin: number,
  ): Droite | null {
    if (courante && !courante.morte) {
      const attendu = valeurDroite(courante, p);
      if (Math.abs(prix - attendu) <= tolerance) {
        // ⚠️ On n'ancre PAS sur le nouveau point : une droite qui pivote à
        // chaque touche finit par suivre le prix et ne se casse jamais.
        courante.touches++;
        courante.points.push({ i: p, prix });
        if (courante.touches === touchesMin) audit.droitesConfirmees++;
        return courante;
      }
    }
    if (!precedent) return null;
    audit.droitesTracees++;
    return {
      i1: precedent.i,
      p1: precedent.prix,
      i2: p,
      p2: prix,
      touches: 2,
      morte: false,
      points: [{ i: precedent.i, prix: precedent.prix }, { i: p, prix }],
    };
  }

  /**
   * La zone active : order block, breaker ou déséquilibre.
   *
   * ⚠️ UNE ZONE PORTE UN SENS, contrairement à un niveau. Une zone de demande ne
   * s'achète pas et ne se vend pas indifféremment : c'est ce qui la distingue
   * d'un simple support. Le moteur le retient, et `entree_dans_zone` ne
   * déclenche que dans ce sens-là.
   */
  let zoneSens: "long" | "short" | null = null;
  let zoneBarre = -1;
  /** Vrai quand le prix était DEHORS à la bougie précédente. */
  let zoneDehors = true;

  // État du déclencheur à trois temps (balayage, impulsion, retour).
  let balayageSens: "long" | "short" | null = null;
  let balayageExtreme = 0;
  let balayageBarre = -1;
  let fvgRetour = 0;
  let barreImpulsion = -1;

  let attente: EntreeEnAttente | null = null;
  let position: Position | null = null;

  const niveauRange = plan.niveau.type === "range_horaire" ? plan.niveau : null;
  /**
   * Le niveau courant a-t-il une EPAISSEUR ?
   *
   * ⚠️ Sert au dessin. Une zone se trace comme une boite depuis sa naissance,
   * un niveau comme un trait : confondre les deux redonnerait le defaut qu'on
   * vient de corriger, un setup qu'on ne reconnait pas.
   */
  const estNiveauZone =
    plan.niveau.type === "range_horaire" ||
    plan.niveau.type === "order_block" ||
    plan.niveau.type === "breaker" ||
    plan.niveau.type === "fvg_zone" ||
    plan.niveau.type === "bollinger";
  const debutRange = niveauRange ? minutesDepuisHeure(niveauRange.debut) ?? 0 : 0;
  const finRange = niveauRange ? minutesDepuisHeure(niveauRange.fin) ?? 0 : 0;

  function reinitialiserJour() {
    hautVeille = hautJour > -Infinity ? hautJour : null;
    basVeille = basJour < Infinity ? basJour : null;
    hautJour = -Infinity;
    basJour = Infinity;
    // Seule une plage horaire est propre a la journee. Les anciens sommets et
    // creux, eux, ne cessent pas d'exister a minuit : les effacer priverait de
    // niveau le debut de chaque seance.
    if (plan.niveau.type === "range_horaire") {
      hautNiveau = null;
      basNiveau = null;
    }
    hautEnCours = -Infinity;
    basEnCours = Infinity;
    tradesJour = 0;
    pertesAffilee = 0;
    cumulRJour = 0;
    journeeArretee = false;
    cassureSens = null;
    cassureBarre = -1;
    balayageSens = null;
    barreImpulsion = -1;
    attente = null;
  }

  /** Clôt la position ouverte au prix brut donné, coûts appliqués. */
  function fermer(i: number, prixBrut: number, motif: MotifSortie, collision: boolean, auMarche: boolean) {
    const p = position!;
    const couts = plan.couts;
    const signe = p.sens === "long" ? 1 : -1;
    // Le glissement ne frappe que les sorties au marché : un objectif est un
    // ordre limite, il ne glisse pas en notre défaveur.
    const glissementSortie = auMarche ? couts.glissementTicks : 0;
    const sortieEffective = prixBrut - signe * glissementSortie;

    const brutTicks = signe * (prixBrut - p.entreeBrute);
    const netTicks = signe * (sortieEffective - p.entreeEffective) - couts.commissionTicks;

    const rBrut = brutTicks / p.risqueTicks;
    const r = netTicks / p.risqueTicks;

    trades.push({
      signalMs: p.signalMs,
      niveauSignal: p.niveauSignal,
      trace: p.geo.trace,
      mecanique: p.geo.mecanique,
      entreeMs: p.msEntree,
      sortieMs: t[i],
      sens: p.sens,
      entreeTicks: p.entreeEffective,
      sortieTicks: sortieEffective,
      risqueTicks: p.risqueTicks,
      r,
      rBrut,
      motif,
      collisionMemeBarre: collision,
    });
    audit.coutTotalR += rBrut - r;
    if (collision) audit.collisions++;

    cumulRJour += r;
    if (r < 0) pertesAffilee++;
    else pertesAffilee = 0;

    const g = plan.gestion;
    const avant = journeeArretee;
    if (g.maxPertesConsecutives != null && pertesAffilee >= g.maxPertesConsecutives) journeeArretee = true;
    if (g.maxPerteJournaliereR != null && cumulRJour <= -g.maxPerteJournaliereR) journeeArretee = true;
    if (!avant && journeeArretee) audit.journeesArretees++;

    position = null;
  }

  /** Traite une bougie pendant laquelle une position est ouverte. */
  function gererPosition(i: number, minutes: number) {
    const p = position!;
    const estLong = p.sens === "long";

    // 1. Trou d'ouverture : le marché rouvre déjà au-delà du stop ou de
    //    l'objectif. On sort au prix réel, pas au niveau souhaité. Ignorer ce
    //    cas rendrait tous les week-ends gratuits.
    if (estLong ? o[i] <= p.stop : o[i] >= p.stop) {
      fermer(i, o[i], p.stop === p.entreeBrute ? "break_even" : "stop", false, true);
      return;
    }
    if (estLong ? o[i] >= p.objectif : o[i] <= p.objectif) {
      fermer(i, o[i], "objectif", false, false);
      return;
    }

    const stopTouche = estLong ? l[i] <= p.stop : h[i] >= p.stop;
    const objectifTouche = estLong ? h[i] >= p.objectif : l[i] <= p.objectif;

    if (stopTouche && objectifTouche) {
      // Règle 2 : on ne sait pas lequel est venu en premier, on prend la perte.
      fermer(i, p.stop, p.stop === p.entreeBrute ? "break_even" : "stop", true, true);
      return;
    }
    if (stopTouche) {
      fermer(i, p.stop, p.stop === p.entreeBrute ? "break_even" : "stop", false, true);
      return;
    }
    if (objectifTouche) {
      fermer(i, p.objectif, "objectif", false, false);
      return;
    }

    // 2. Break-even. ⚠️ Il est évalué APRÈS les sorties, donc il ne prend effet
    //    qu'à la bougie suivante : sur la bougie qui atteint le seuil, c'est
    //    encore l'ancien stop qui vaut. L'inverse supposerait qu'on connaît
    //    l'ordre des prix à l'intérieur d'une minute, exactement ce qu'on
    //    refuse partout ailleurs dans ce fichier.
    const be = plan.sortiesAuxiliaires.breakEvenApresR;
    if (be != null && !p.breakEvenPose) {
      const avancee = estLong
        ? (h[i] - p.entreeBrute) / p.risqueTicks
        : (p.entreeBrute - l[i]) / p.risqueTicks;
      if (avancee >= be) {
        p.stop = p.entreeBrute;
        p.breakEvenPose = true;
      }
    }

    // 3. Sorties de temps, à la clôture de la bougie concernée.
    if (finSession != null && minutes >= finSession) {
      fermer(i, c[i], "fin_de_session", false, true);
      return;
    }
    const duree = plan.sortiesAuxiliaires.apresNBarres;
    if (duree != null && i - p.barreEntree >= duree) {
      fermer(i, c[i], "duree_max", false, true);
    }
  }

  /** Ouvre une position à un prix brut donné. Rend faux si le trade est impossible. */
  function ouvrir(
    i: number,
    sens: "long" | "short",
    prixBrut: number,
    barreSignal: number,
    extremeBalayage: number | undefined,
    dernierSommet: number | undefined,
    dernierCreux: number | undefined,
    signalMs: number,
    niveauSignal: number,
    geo: GeoSignal,
  ): boolean {
    const signe = sens === "long" ? 1 : -1;
    const couts = plan.couts;
    const entreeEffective = prixBrut + signe * (couts.spreadTicks + couts.glissementTicks);

    let stop: number;
    if (plan.stop.type === "fixe") {
      stop = prixBrut - signe * plan.stop.ticks;
    } else if (plan.stop.type === "structurel") {
      stop =
        sens === "long"
          ? l[barreSignal] - plan.stop.bufferTicks
          : h[barreSignal] + plan.stop.bufferTicks;
    } else if (plan.stop.type === "extreme_balayage") {
      // Sans balayage identifié, ce stop n'a pas de sens et on ne prend pas le
      // trade. Retomber en silence sur un autre stop changerait la stratégie
      // testée sans que personne ne le voie.
      if (extremeBalayage == null) return false;
      stop =
        sens === "long"
          ? extremeBalayage - plan.stop.bufferTicks
          : extremeBalayage + plan.stop.bufferTicks;
    } else if (plan.stop.type === "dernier_pivot") {
      const pivot = sens === "long" ? dernierCreux : dernierSommet;
      // Sans pivot confirmé, ce stop n'existe pas. On refuse plutôt que de
      // retomber en silence sur un autre : ce serait tester autre chose.
      if (pivot == null) return false;
      stop = sens === "long" ? pivot - plan.stop.bufferTicks : pivot + plan.stop.bufferTicks;
    } else {
      const oppose = sens === "long" ? basNiveau : hautNiveau;
      if (oppose == null) return false;
      stop = sens === "long" ? oppose - plan.stop.bufferTicks : oppose + plan.stop.bufferTicks;
    }

    const risqueTicks = signe * (prixBrut - stop);
    // Un stop du mauvais côté de l'entrée, ou collé dessus, n'est pas un trade :
    // il rendrait un R infini et empoisonnerait toutes les moyennes.
    if (risqueTicks <= 0) return false;

    // ⚠️ ET UN STOP PLUS PROCHE QUE CE QUE COÛTE L'ALLER-RETOUR N'EN EST PAS UN
    // NON PLUS. Le résultat se mesure en multiples du risque : un stop à un
    // tick met un dénominateur minuscule sous une division, et ce seul trade
    // pèse alors des centaines de R. Mesuré sur l'or réel, l'espérance nette
    // sortait à -1,18 R quand la brute valait -0,01 R, et l'écart entier venait
    // d'une poignée de trades au stop collé à l'entrée.
    //
    // Le seuil n'est pas arbitraire : sous le coût d'un aller-retour, la
    // position est perdante par construction, avant même que le marché bouge.
    // Le refus est COMPTÉ, jamais silencieux : c'est souvent le signe que le
    // plan applique une structure trop fine pour l'instrument choisi.
    const coutAllerRetour =
      couts.spreadTicks + 2 * couts.glissementTicks + couts.commissionTicks;
    if (risqueTicks < Math.max(1, coutAllerRetour)) {
      audit.refusesRisqueTropPetit++;
      return false;
    }

    let objectif: number;
    if (plan.objectif.type === "multiple_r") {
      objectif = prixBrut + signe * plan.objectif.r * risqueTicks;
    } else {
      const cible = sens === "long" ? hautNiveau : basNiveau;
      if (cible == null) return false;
      objectif = cible;
      if (signe * (objectif - prixBrut) <= 0) return false;
    }

    position = {
      sens,
      entreeBrute: prixBrut,
      entreeEffective,
      stop,
      stopInitial: stop,
      objectif,
      risqueTicks,
      barreEntree: i,
      msEntree: t[i],
      breakEvenPose: false,
      signalMs,
      niveauSignal,
      geo,
    };
    tradesJour++;
    return true;
  }

  function confirmationsOk(i: number, sens: "long" | "short"): boolean {
    for (const conf of plan.confirmations as BlocConfirmation[]) {
      if (conf.type === "bougie_reaction") {
        if (sens === "long" ? c[i] <= o[i] : c[i] >= o[i]) return false;
      } else if (conf.type === "amplitude_min") {
        if (h[i] - l[i] < conf.ticks) return false;
      } else if (conf.type === "rsi") {
        const v = rsi ? rsi[i] : NaN;
        if (Number.isNaN(v)) return false;
        // ⚠️ Les deux usages sont OPPOSÉS : suivre l'élan, ou jouer l'excès.
        // Se tromper de mode inverse le filtre, et un filtre inversé ne se voit
        // pas dans les chiffres, seulement dans le nombre de trades.
        if (conf.mode === "momentum") {
          if (sens === "long" ? v < conf.seuil : v > 100 - conf.seuil) return false;
        } else {
          if (sens === "long" ? v > 100 - conf.seuil : v < conf.seuil) return false;
        }
      } else if (conf.type === "biais_moyenne") {
        const m = sma ? sma[i] : NaN;
        if (Number.isNaN(m)) return false;
        if (sens === "long" ? c[i] <= m : c[i] >= m) return false;
      }
    }
    return true;
  }

  /** Le sens est-il autorisé par le plan ? */
  function sensAutorise(sens: "long" | "short"): boolean {
    return plan.sens === "les_deux" || plan.sens === sens;
  }

  /** Évalue le déclencheur sur la bougie i, qui vient de clôturer. */
  function evaluerDeclencheur(i: number): "long" | "short" | null {
    // ⚠️ CHAQUE CÔTÉ SE TESTE SÉPARÉMENT. Exiger que les deux existent était un
    // défaut : une trendline n'a très souvent qu'un côté (un soutien montant
    // sans résistance descendante en face), et la stratégie entière ne
    // déclenchait alors jamais rien, en silence.
    const haut = hautNiveau;
    const bas = basNiveau;
    if (haut == null && bas == null) return null;
    const d = plan.declencheur;

    if (d.type === "cassure") {
      const dessus = haut != null && (d.mode === "cloture" ? c[i] > haut : h[i] > haut);
      const dessous = bas != null && (d.mode === "cloture" ? c[i] < bas : l[i] < bas);
      if (dessus) return "long";
      if (dessous) return "short";
      return null;
    }

    if (d.type === "balayage_retour") {
      // Le prix est allé chercher la liquidité au-delà du niveau puis a
      // reclôturé de l'autre côté : le signal est à contre-sens du balayage.
      if (haut != null && h[i] > haut && c[i] < haut) return "short";
      if (bas != null && l[i] < bas && c[i] > bas) return "long";
      return null;
    }

    if (d.type === "retest_apres_cassure") {
      if (cassureSens == null) {
        if (haut != null && c[i] > haut) {
          cassureSens = "long";
          cassureBarre = i;
        } else if (bas != null && c[i] < bas) {
          cassureSens = "short";
          cassureBarre = i;
        }
        return null;
      }
      if (i - cassureBarre > d.delaiMaxBarres) {
        cassureSens = null;
        return null;
      }
      const niveau = cassureSens === "long" ? haut : bas;
      if (niveau == null) {
        cassureSens = null;
        return null;
      }
      const touche =
        cassureSens === "long"
          ? l[i] <= niveau + d.toleranceTicks
          : h[i] >= niveau - d.toleranceTicks;
      if (touche) {
        const sens = cassureSens;
        cassureSens = null;
        return sens;
      }
      return null;
    }

    if (d.type === "entree_dans_zone") {
      if (haut == null || bas == null || zoneSens == null) return null;
      if (i - zoneBarre > d.delaiMaxBarres) return null;

      const dedans = l[i] <= haut && h[i] >= bas;
      if (!dedans) {
        zoneDehors = true;
        return null;
      }
      // ⚠️ ON NE DÉCLENCHE QU'À L'ENTRÉE, pas tant que le prix reste dedans.
      // Sans cette bascule, une zone traversée lentement produirait un signal à
      // chaque bougie et gonflerait le nombre de trades sans qu'aucun setup
      // supplémentaire n'ait eu lieu.
      if (!zoneDehors) return null;
      zoneDehors = false;
      return zoneSens;
    }

    if (d.type === "balayage_puis_fvg") {
      // ── Temps 1 : la liquidité est-elle prise ?
      if (balayageSens == null) {
        if (haut != null && h[i] > haut) {
          balayageSens = "short";
          balayageExtreme = h[i];
          balayageNiveau = haut;
        } else if (bas != null && l[i] < bas) {
          balayageSens = "long";
          balayageExtreme = l[i];
          balayageNiveau = bas;
        } else return null;
        balayageBarre = i;
        barreImpulsion = -1;
        return null;
      }

      // ── Temps 2 : l'impulsion en sens inverse, reconnue à son déséquilibre.
      if (barreImpulsion === -1) {
        if (i - balayageBarre > d.delaiReaction) {
          balayageSens = null;
          return null;
        }
        // Tant qu'aucune réaction n'a eu lieu, un nouvel extrême n'invalide
        // rien : le balayage se prolonge, simplement. C'est APRÈS l'impulsion
        // que le même mouvement devient une invalidation.
        if (balayageSens === "short" && h[i] > balayageExtreme) {
          balayageExtreme = h[i];
          balayageBarre = i;
          return null;
        }
        if (balayageSens === "long" && l[i] < balayageExtreme) {
          balayageExtreme = l[i];
          balayageBarre = i;
          return null;
        }
        if (i < 2) return null;
        if (balayageSens === "short" && h[i] < l[i - 2]) {
          barreImpulsion = i;
          fvgRetour = l[i - 2];
          fvgHaut = l[i - 2];
          fvgBas = h[i];
          fvgDebut = i - 2;
        } else if (balayageSens === "long" && l[i] > h[i - 2]) {
          barreImpulsion = i;
          fvgRetour = h[i - 2];
          fvgHaut = l[i];
          fvgBas = h[i - 2];
          fvgDebut = i - 2;
        }
        return null;
      }

      // ── Temps 3 : le retour dans le déséquilibre, sous invalidation permanente.
      const invalide =
        balayageSens === "short" ? h[i] > balayageExtreme : l[i] < balayageExtreme;
      if (invalide || i - barreImpulsion > d.delaiRetest) {
        balayageSens = null;
        return null;
      }
      const retour = balayageSens === "short" ? h[i] >= fvgRetour : l[i] <= fvgRetour;
      if (retour) {
        const sens = balayageSens;
        balayageSens = null;
        return sens;
      }
      return null;
    }

    // fvg_puis_retest : la bougie de cassure doit AUSSI laisser un déséquilibre
    // à trois bougies. C'est cette combinaison, et pas la cassure seule, qui
    // définit une entrée ICT.
    if (cassureSens == null) {
      if (i < 2) return null;
      const fvgHaussier = l[i] > h[i - 2];
      const fvgBaissier = h[i] < l[i - 2];
      if (haut != null && c[i] > haut && fvgHaussier) {
        cassureSens = "long";
        cassureBarre = i;
        fvgBord = h[i - 2];
        fvgHaut = l[i];
        fvgBas = h[i - 2];
        fvgDebut = i - 2;
      } else if (bas != null && c[i] < bas && fvgBaissier) {
        cassureSens = "short";
        cassureBarre = i;
        fvgBord = l[i - 2];
        fvgHaut = l[i - 2];
        fvgBas = h[i];
        fvgDebut = i - 2;
      }
      return null;
    }
    if (i - cassureBarre > d.delaiMaxBarres) {
      cassureSens = null;
      return null;
    }
    const revenu = cassureSens === "long" ? l[i] <= fvgBord : h[i] >= fvgBord;
    if (revenu) {
      const sens = cassureSens;
      cassureSens = null;
      return sens;
    }
    return null;
  }

  // ─── LA BOUCLE ───────────────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const ms = t[i];
    const jour = horloge.jour(ms);
    const minutes = horloge.minutes(ms);

    if (jour !== jourCourant) {
      if (jourCourant !== -1) reinitialiserJour();
      jourCourant = jour;
      jourAutorise =
        joursAutorises.size === 0 || joursAutorises.has(horloge.jourSemaine(ms) as JourSemaine);
    }
    if (h[i] > hautJour) hautJour = h[i];
    if (l[i] < basJour) basJour = l[i];

    // ── Le niveau. Il n'est disponible qu'une fois sa plage TERMINÉE : le
    //    rendre lisible pendant qu'il se forme laisserait entrer sur un plus
    //    haut qui n'est pas encore le plus haut.
    if (niveauRange) {
      if (minutes >= debutRange && minutes < finRange) {
        if (h[i] > hautEnCours) hautEnCours = h[i];
        if (l[i] < basEnCours) basEnCours = l[i];
      } else if (minutes >= finRange && hautEnCours > -Infinity) {
        hautNiveau = hautEnCours;
        basNiveau = basEnCours;
      }
    } else if (plan.niveau.type === "extremes_veille") {
      hautNiveau = hautVeille;
      basNiveau = basVeille;
    } else if (plan.niveau.type === "trendline") {
      const { pivots: k, touchesMin, toleranceTicks } = plan.niveau;
      const p = i - k;
      if (p >= k) {
        let estSommet = true;
        let estCreux = true;
        for (let j2 = p - k; j2 <= p + k; j2++) {
          if (j2 === p) continue;
          if (h[j2] > h[p]) estSommet = false;
          if (l[j2] < l[p]) estCreux = false;
        }
        if (estSommet && (!sommetB || sommetB.i !== p)) {
          ligneHaut = integrerPivot(ligneHaut, sommetB, p, h[p], toleranceTicks, touchesMin);
          sommetB = { i: p, prix: h[p] };
        }
        if (estCreux && (!creuxB || creuxB.i !== p)) {
          ligneBas = integrerPivot(ligneBas, creuxB, p, l[p], toleranceTicks, touchesMin);
          creuxB = { i: p, prix: l[p] };
        }
      }

      // ⚠️ On EXPOSE le niveau avant de constater la violation, sinon la
      // clôture qui casse la droite ne trouverait plus rien à casser. La droite
      // est marquée morte dans la foulée : elle ne comptera plus aucune touche,
      // et le prochain pivot en ouvrira une nouvelle.
      if (ligneBas && !ligneBas.morte) {
        const v = valeurDroite(ligneBas, i);
        basNiveau = ligneBas.touches >= touchesMin ? v : null;
        if (c[i] < v) ligneBas.morte = true;
      } else basNiveau = null;

      if (ligneHaut && !ligneHaut.morte) {
        const v = valeurDroite(ligneHaut, i);
        hautNiveau = ligneHaut.touches >= touchesMin ? v : null;
        if (c[i] > v) ligneHaut.morte = true;
      } else hautNiveau = null;
    } else if (plan.niveau.type === "liquidite_swing") {
      // Un pivot regarde des DEUX cotes : celui de la bougie i-k n'est
      // confirmable qu'a la bougie i. On ne publie donc le niveau qu'avec ce
      // retard assume. Le publier des sa formation serait du lookahead, et
      // c'est l'erreur la plus repandue dans les backtests de liquidite.
      const k = plan.niveau.pivots;
      const p = i - k;
      if (p >= k) {
        let estSommet = true;
        let estCreux = true;
        for (let j = p - k; j <= p + k; j++) {
          if (j === p) continue;
          if (h[j] > h[p]) estSommet = false;
          if (l[j] < l[p]) estCreux = false;
        }
        if (estSommet) {
          hautNiveau = h[p];
          if (!sommetB || sommetB.i !== p) {
            sommetB = { i: p, prix: h[p] };
          }
        }
        if (estCreux) {
          basNiveau = l[p];
          if (!creuxB || creuxB.i !== p) {
            creuxB = { i: p, prix: l[p] };
          }
        }
      }
    } else if (plan.niveau.type === "moyenne_mobile") {
      const v = smaNiveau ? smaNiveau[i] : NaN;
      // Une moyenne incomplète ne décrit rien : mieux vaut pas de niveau du
      // tout qu'un niveau calculé sur trois bougies.
      const arrondi = Number.isNaN(v) ? null : Math.round(v);
      hautNiveau = arrondi;
      basNiveau = arrondi;
    } else if (plan.niveau.type === "vwap_session") {
      const v = vwap ? vwap[i] : NaN;
      const arrondi = Number.isNaN(v) ? null : Math.round(v);
      hautNiveau = arrondi;
      basNiveau = arrondi;
    } else if (plan.niveau.type === "bollinger") {
      const m = smaNiveau ? smaNiveau[i] : NaN;
      const e = ecartType ? ecartType[i] : NaN;
      if (Number.isNaN(m) || Number.isNaN(e)) {
        hautNiveau = null;
        basNiveau = null;
      } else {
        hautNiveau = Math.round(m + plan.niveau.ecarts * e);
        basNiveau = Math.round(m - plan.niveau.ecarts * e);
      }
    } else if (
      plan.niveau.type === "order_block" ||
      plan.niveau.type === "breaker" ||
      plan.niveau.type === "fvg_zone"
    ) {
      // ── Zones. Une nouvelle zone remplace l'ancienne : un trader ne suit pas
      //    quinze order blocks à la fois, il travaille le dernier en date.
      if (plan.niveau.type === "fvg_zone") {
        const taille = plan.niveau.tailleMinTicks;
        if (i >= 2) {
          if (l[i] - h[i - 2] >= taille) {
            basNiveau = h[i - 2];
            hautNiveau = l[i];
            zoneSens = "long";
            zoneBarre = i;
            zoneDehors = true;
          } else if (l[i - 2] - h[i] >= taille) {
            basNiveau = h[i];
            hautNiveau = l[i - 2];
            zoneSens = "short";
            zoneBarre = i;
            zoneDehors = true;
          }
        }
      } else {
        // Order block et breaker partagent la même détection : une impulsion,
        // puis la dernière bougie de sens opposé qui l'a précédée.
        const mini = plan.niveau.impulsionMinTicks;
        const impulsion = c[i] - o[i];
        if (Math.abs(impulsion) >= mini) {
          const haussiere = impulsion > 0;
          // On remonte au plus dix bougies : au-delà, la « dernière bougie
          // opposée » n'a plus de rapport avec l'impulsion.
          let j = -1;
          for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
            if (haussiere ? c[k] < o[k] : c[k] > o[k]) {
              j = k;
              break;
            }
          }
          if (j >= 0) {
            basNiveau = l[j];
            hautNiveau = h[j];
            // ⚠️ UN BREAKER EST UN ORDER BLOCK QUI A CÉDÉ : il change de camp,
            // une ancienne demande devenant une offre. Confondre les deux
            // inverse le sens du trade, et rien à l'écran ne le montrerait.
            zoneSens =
              plan.niveau.type === "breaker" ? (haussiere ? "short" : "long") : haussiere ? "long" : "short";
            zoneBarre = i;
            zoneDehors = true;
          }
        }
      }

      // La zone expire : une boîte vieille de trois cents bougies ne décrit plus
      // rien, et la garder ferait entrer sur un souvenir.
      if (zoneBarre >= 0 && i - zoneBarre > 300) {
        hautNiveau = null;
        basNiveau = null;
        zoneSens = null;
      }
    } else if (plan.niveau.type === "extremes_n_bougies") {
      const k = plan.niveau.n;
      if (i >= k) {
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = i - k; j < i; j++) {
          if (h[j] > hi) hi = h[j];
          if (l[j] < lo) lo = l[j];
        }
        hautNiveau = hi;
        basNiveau = lo;
      }
    }

    // ── Position ouverte : on ne fait que la gérer.
    if (position) {
      gererPosition(i, minutes);
      continue;
    }

    // ── Ordre en attente.
    if (attente) {
      if (attente.prixLimite == null) {
        // Entrée à l'ouverture de cette bougie, décidée sur la précédente.
        const ouverte = ouvrir(i, attente.sens, o[i], attente.barreSignal, attente.extremeBalayage, attente.dernierSommet, attente.dernierCreux, attente.signalMs, attente.niveauSignal, attente.geo);
        attente = null;
        if (ouverte) {
          gererPosition(i, minutes);
          continue;
        }
      } else if (i > attente.valableJusqua!) {
        audit.limitesExpirees++;
        attente = null;
      } else {
        const touche =
          attente.sens === "long" ? l[i] <= attente.prixLimite : h[i] >= attente.prixLimite;
        if (touche) {
          const ouverte = ouvrir(i, attente.sens, attente.prixLimite, attente.barreSignal, attente.extremeBalayage, attente.dernierSommet, attente.dernierCreux, attente.signalMs, attente.niveauSignal, attente.geo);
          attente = null;
          if (ouverte) {
            gererPosition(i, minutes);
            continue;
          }
        }
      }
    }

    if (hautNiveau != null || basNiveau != null) audit.barresAvecNiveau++;

    // ── Recherche d'un signal. Bougie i clôturée, entrée en i+1 au plus tôt.
    if (position || attente) continue;
    if (!jourAutorise || journeeArretee) continue;
    if (minutes < debutFenetre || minutes >= finFenetre) continue;

    const sens = evaluerDeclencheur(i);
    if (!sens || !sensAutorise(sens)) continue;
    if (!confirmationsOk(i, sens)) continue;

    audit.signaux++;

    const g = plan.gestion;
    if (g.maxTradesParJour != null && tradesJour >= g.maxTradesParJour) {
      audit.refusesParGestion++;
      continue;
    }

    // La machine a etats vient d'oublier le balayage : on le capture ici, sinon
    // le stop d'invalidation n'aurait plus rien a quoi se raccrocher.
    const extremeBalayage =
      plan.declencheur.type === "balayage_puis_fvg" ? balayageExtreme : undefined;
    const dernierSommet = sommetB?.prix;
    const dernierCreux = creuxB?.prix;
    const signalMs = t[i];

    /**
     * La forme du niveau, telle que le trader l'aurait tracee.
     *
     * ⚠️ On la fige AU MOMENT DU SIGNAL : une droite peut mourir ou pivoter
     * ensuite, et redessiner son etat final montrerait autre chose que ce sur
     * quoi la decision a ete prise.
     */
    let trace: TraceSignal | undefined;
    if (plan.niveau.type === "trendline") {
      const ligne = sens === "long" ? ligneHaut : ligneBas;
      if (ligne) {
        trace = {
          forme: "droite",
          a: { ms: t[ligne.i1], prixTicks: ligne.p1 },
          b: { ms: t[ligne.i2], prixTicks: ligne.p2 },
          touches: ligne.points.map((pt) => ({ ms: t[pt.i], prixTicks: pt.prix })),
        };
      }
    } else if (estNiveauZone && hautNiveau != null && basNiveau != null) {
      // Une zone se dessine depuis sa NAISSANCE : la boite d'un order block cree
      // quarante bougies plus tot n'a de sens que si on voit d'ou elle vient.
      const naissance = zoneBarre >= 0 && zoneBarre <= i ? zoneBarre : Math.max(0, i - 60);
      trace = {
        forme: "zone",
        hautTicks: hautNiveau,
        basTicks: basNiveau,
        debutMs: t[naissance],
        finMs: t[i],
      };
    } else {
      const niveau = sens === "long" ? hautNiveau : basNiveau;
      if (niveau != null) trace = { forme: "horizontale", prixTicks: niveau };
    }

    /**
     * La MÉCANIQUE d'entrée, en plus du niveau.
     *
     * ⚠️ On la fige au signal, comme la trace : les variables d'état seront
     * réutilisées par le scénario suivant dès la bougie d'après.
     *
     * ⚠️ ORDRE VOULU : le balayage d'abord, le déséquilibre ensuite. C'est
     * l'ordre des événements, et c'est justement leur ordre qui distingue cette
     * mécanique d'une simple cassure tombée au même endroit.
     */
    const mecanique: TraceMecanique[] = [];
    if (plan.declencheur.type === "balayage_puis_fvg") {
      if (balayageBarre >= 0) {
        mecanique.push({
          forme: "balayage",
          niveauTicks: balayageNiveau,
          extremeTicks: balayageExtreme,
          ms: t[balayageBarre],
        });
      }
      if (fvgDebut >= 0 && fvgHaut > fvgBas) {
        mecanique.push({
          forme: "desequilibre",
          hautTicks: fvgHaut,
          basTicks: fvgBas,
          debutMs: t[fvgDebut],
          finMs: t[i],
          bordTicks: fvgRetour,
        });
      }
    } else if (plan.declencheur.type === "fvg_puis_retest") {
      if (fvgDebut >= 0 && fvgHaut > fvgBas) {
        mecanique.push({
          forme: "desequilibre",
          hautTicks: fvgHaut,
          basTicks: fvgBas,
          debutMs: t[fvgDebut],
          finMs: t[i],
          bordTicks: fvgBord,
        });
      }
    }
    const geo: GeoSignal = {
      trace,
      mecanique: mecanique.length > 0 ? mecanique : undefined,
    };

    // Le niveau que le signal vient de franchir : c'est LUI que le trader doit
    // reconnaître sur le graphique d'inspection.
    const niveauSignal = (sens === "long" ? hautNiveau : basNiveau) ?? c[i];

    if (plan.entree.type === "open_bougie_suivante") {
      if (i + 1 < n) attente = { sens, barreSignal: i, extremeBalayage, dernierSommet, dernierCreux, signalMs, niveauSignal, geo };
    } else {
      const niveau = sens === "long" ? basNiveau : hautNiveau;
      if (niveau == null) continue;
      attente = {
        sens,
        barreSignal: i,
        prixLimite: niveau,
        valableJusqua: i + plan.entree.valableNBarres,
        extremeBalayage,
        dernierSommet,
        dernierCreux,
        signalMs,
        niveauSignal,
        geo,
      };
    }
  }

  // Une position encore ouverte à la fin de la série n'est pas un trade
  // gagnant en devenir : on la solde au dernier prix connu et on l'étiquette.
  if (position && n > 0) fermer(n - 1, c[n - 1], "fin_de_serie", false, true);

  return {
    trades,
    audit,
    debutMs: n > 0 ? t[0] : 0,
    finMs: n > 0 ? t[n - 1] : 0,
  };
}

/** Coûts par défaut volontairement non nuls. Voir l'avertissement dans types.ts. */
export function coutsParDefaut(): Couts {
  return { spreadTicks: 20, glissementTicks: 2, commissionTicks: 6 };
}

/** Fenêtre de contexte par défaut : la journée entière, à Paris. */
export function contexteParDefaut(): Contexte {
  return { fuseau: "Europe/Paris", debut: "00:00", fin: "23:59", jours: [1, 2, 3, 4, 5] };
}

/**
 * LA COURBE DE L'INDICATEUR SUR UNE FENÊTRE, POUR LA DESSINER.
 *
 * ⚠️ Une moyenne mobile, un VWAP ou des bandes de Bollinger ne sont PAS un prix
 * figé : les tracer comme un trait horizontal au moment du signal montrerait un
 * objet qui n'existe pas, et le trader ne reconnaîtrait pas son indicateur. Il
 * doit voir la courbe serpenter entre ses bougies.
 *
 * ⚠️ Recalculée sur la SÉRIE ENTIÈRE puis découpée, jamais sur la seule fenêtre.
 * Une moyenne à 50 périodes calculée sur les 60 bougies visibles n'aurait pas
 * les mêmes valeurs que celle qu'a vue le moteur : on afficherait une courbe
 * plausible et fausse, ce qui est pire que pas de courbe du tout.
 *
 * Les valeurs sont en ticks, `null` là où l'indicateur n'existe pas encore.
 */
export function courbeIndicateur(
  serie: SerieM1,
  plan: PlanExecution,
  debut: number,
  fin: number,
): { nom: string; valeurs: (number | null)[] }[] | undefined {
  const { c, h, l, t } = serie;
  const decoupe = (src: Float64Array) => {
    const out: (number | null)[] = [];
    for (let i = debut; i <= fin; i++) out.push(Number.isNaN(src[i]) ? null : src[i]);
    return out;
  };

  if (plan.niveau.type === "moyenne_mobile") {
    return [{ nom: `MM${plan.niveau.periode}`, valeurs: decoupe(moyenneMobile(c, plan.niveau.periode)) }];
  }
  if (plan.niveau.type === "vwap_session") {
    const horloge = fabriqueHorloge(plan.contexte.fuseau);
    return [{ nom: "VWAP", valeurs: decoupe(vwapSession(h, l, c, t, (ms) => horloge.jour(ms))) }];
  }
  if (plan.niveau.type === "bollinger") {
    const m = moyenneMobile(c, plan.niveau.periode);
    const e = ecartTypeMobile(c, plan.niveau.periode, m);
    const haute = new Float64Array(c.length).fill(NaN);
    const basse = new Float64Array(c.length).fill(NaN);
    for (let i = 0; i < c.length; i++) {
      if (!Number.isNaN(m[i]) && !Number.isNaN(e[i])) {
        haute[i] = m[i] + plan.niveau.ecarts * e[i];
        basse[i] = m[i] - plan.niveau.ecarts * e[i];
      }
    }
    return [
      { nom: "Bollinger +", valeurs: decoupe(haute) },
      { nom: "Bollinger -", valeurs: decoupe(basse) },
      { nom: "Moyenne", valeurs: decoupe(m) },
    ];
  }

  // Une confirmation de moyenne mobile mérite d'être vue elle aussi : c'est un
  // filtre qui décide de la moitié des trades sans jamais apparaître.
  const biais = plan.confirmations.find((x) => x.type === "biais_moyenne");
  if (biais && biais.type === "biais_moyenne") {
    return [{ nom: `MM${biais.periode}`, valeurs: decoupe(moyenneMobile(c, biais.periode)) }];
  }
  return undefined;
}
