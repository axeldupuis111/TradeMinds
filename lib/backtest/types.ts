/**
 * VOCABULAIRE DU BACKTEST : les blocs dont une stratégie peut être faite.
 *
 * ── POURQUOI UN CATALOGUE FERMÉ, ET PAS DU TEXTE LIBRE ──────────────────────
 *
 * Une fiche de stratégie est écrite en français (« j'attends un retest du FVG
 * après le balayage »). On a longtemps refusé de la backtester pour une bonne
 * raison : mécaniser cette phrase oblige à inventer la moitié des seuils, et le
 * chiffre qui sort serait de la fiction avec deux décimales.
 *
 * Ce fichier résout le problème autrement. Le compilateur n'a PAS le droit
 * d'inventer un bloc : il choisit dans ce catalogue et remplit des paramètres.
 * Ce qu'il ne sait pas traduire, il le déclare non couvert au lieu de le
 * deviner. Le trader voit donc exactement quelle part de sa méthode a été
 * testée, et peut corriger chaque paramètre à la main.
 *
 * ⚠️ TOUS LES PRIX SONT DES ENTIERS EN TICKS, JAMAIS DES FLOTTANTS ────────────
 *
 * Un backtest passe son temps à demander « le prix a-t-il touché ce niveau ».
 * En virgule flottante, 2130.45 n'est pas exactement 2130.45, et la réponse à
 * cette question devient instable au dernier chiffre : deux exécutions du même
 * test peuvent classer le même trade en gagnant puis en perdant. On convertit
 * donc tout à l'entrée et le moteur ne compare que des entiers. Un buffer de
 * stop « 1 tick » vaut alors littéralement +1.
 *
 * ⚠️ LE MOTEUR RAISONNE EN R, PAS EN EUROS. Le risque est l'unité : un trade
 * vaut +2R ou -1R. La conversion en devise se fait dans une seconde couche, à
 * partir du risque par trade et du capital de départ. Mélanger les deux ici
 * rendrait les résultats dépendants d'une taille de position, donc
 * incomparables d'un instrument à l'autre.
 */

/**
 * Une série de bougies M1, en colonnes.
 *
 * Format colonnaire et pas un tableau d'objets : trois ans de M1 font environ
 * un million de bougies, et un million d'objets JavaScript sature la mémoire du
 * navigateur là où quatre tableaux typés tiennent dans quelques mégaoctets.
 * C'est aussi le format exact des blocs binaires qu'on télécharge.
 */
export interface SerieM1 {
  /** Nom brut de l'instrument, tel qu'affiché au trader. */
  instrument: string;
  /** Taille d'un tick, en unité de prix (0.01 sur l'or). Sert à réafficher. */
  tailleTick: number;
  /** Horodatage d'OUVERTURE de chaque bougie, en ms epoch. Strictement croissant. */
  t: Float64Array;
  /** Ouverture, en ticks entiers. */
  o: Int32Array;
  /** Plus haut, en ticks entiers. */
  h: Int32Array;
  /** Plus bas, en ticks entiers. */
  l: Int32Array;
  /** Clôture, en ticks entiers. */
  c: Int32Array;
}

// ─── CONTEXTE : quand on a le droit de regarder ────────────────────────────

/** Jours de la semaine, convention JS : 0 = dimanche. */
export type JourSemaine = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Contexte {
  /**
   * Fuseau IANA dans lequel toutes les heures du plan sont exprimées.
   * ⚠️ Jamais UTC par défaut : « 15h30 » n'a de sens que dans une ville, et une
   * stratégie d'ouverture de New York décale de 60 minutes deux fois par an.
   */
  fuseau: string;
  /** Début de la fenêtre où les entrées sont autorisées, "HH:MM" local. */
  debut: string;
  /** Fin de la fenêtre où les entrées sont autorisées, "HH:MM" local. */
  fin: string;
  /** Jours autorisés. Vide = tous les jours présents dans la série. */
  jours: JourSemaine[];
}

// ─── NIVEAU : ce qu'on trace avant d'attendre quoi que ce soit ─────────────

export type BlocNiveau =
  /**
   * Plus haut et plus bas d'une plage horaire de la journée, la « bougie de
   * référence » des stratégies d'ouverture de session.
   * ⚠️ Le niveau n'existe qu'une fois la plage TERMINÉE.
   */
  | { type: "range_horaire"; debut: string; fin: string }
  /** Plus haut et plus bas des N bougies précédant celle qu'on examine. */
  | { type: "extremes_n_bougies"; n: number }
  /** Plus haut et plus bas de la veille, dans le fuseau du contexte. */
  | { type: "extremes_veille" }
  /**
   * Les « anciens sommets et creux » où dorment les stops : BSL au-dessus du
   * dernier sommet pivot, SSL sous le dernier creux pivot.
   *
   * ⚠️ Un pivot n'est confirmé que `pivots` bougies APRÈS s'être formé, puisque
   * sa définition regarde des deux côtés. Le moteur ne l'expose donc qu'à ce
   * moment-là. Le lire dès sa formation serait du lookahead pur, et c'est
   * l'erreur la plus répandue dans les backtests de liquidité.
   */
  | { type: "liquidite_swing"; pivots: number }
  /**
   * UNE TRENDLINE : une droite sur laquelle le prix REBONDIT au moins trois
   * fois sans jamais clôturer de l'autre côté.
   *
   * Les trois éléments de cette définition comptent autant l'un que l'autre, et
   * en oublier un donne un objet qui n'est pas une trendline :
   *
   * 1. **TROIS TOUCHES AU MINIMUM** (`touchesMin`). Deux points suffisent à
   *    tracer une droite, et c'est bien le problème : par deux creux
   *    quelconques il passe toujours une droite. C'est la TROISIÈME touche qui
   *    fait qu'elle décrit quelque chose plutôt que de relier deux hasards.
   * 2. **N'IMPORTE QUEL SENS.** Un soutien peut descendre, une résistance peut
   *    monter, et une droite peut être horizontale. Exiger des creux ascendants
   *    revient à écarter la moitié des trendlines que les traders tracent.
   * 3. **RESTÉE INTACTE.** Si une bougie a clôturé de l'autre côté avant la
   *    troisième touche, la droite est morte et ne compte plus. C'est ce qui
   *    distingue une trendline respectée d'une droite déjà traversée.
   *
   * La droite garde ses deux points d'ancrage d'origine : les touches suivantes
   * la CONFIRMENT sans la faire pivoter, exactement comme un trait tracé à la
   * main sur un graphique.
   *
   * ⚠️ Le niveau n'est exposé qu'une fois `touchesMin` atteint. Avant, ce n'est
   * qu'une droite candidate, et la casser ne veut rien dire.
   */
  | {
      type: "trendline";
      /** Bougies de chaque côté pour qu'un pivot soit reconnu. */
      pivots: number;
      /** Touches nécessaires pour que la droite devienne une trendline. */
      touchesMin: number;
      /** Écart maximal, en ticks, pour qu'un pivot compte comme une touche. */
      toleranceTicks: number;
    }
  // ─── Indicateurs : le niveau est une COURBE, pas un prix figé ───────────
  /**
   * Moyenne mobile simple. Le niveau se déplace à chaque bougie.
   * ⚠️ Elle n'existe qu'une fois `periode` bougies écoulées : avant, il n'y a
   * pas de moyenne, et en calculer une sur un historique incomplet reviendrait
   * à comparer le prix à un chiffre qui ne décrit rien.
   */
  | { type: "moyenne_mobile"; periode: number }
  /**
   * VWAP de séance : prix moyen pondéré par le volume depuis l'ouverture.
   *
   * ⚠️ ON N'A PAS LE VOLUME. Les bougies stockées sont OHLC seulement, donc on
   * pondère par l'AMPLITUDE de chaque bougie, qui lui est fortement corrélée.
   * C'est une approximation, elle est déclarée comme telle à l'écran, et elle
   * ne doit jamais être présentée comme le VWAP du courtier.
   */
  | { type: "vwap_session" }
  /**
   * Bandes de Bollinger : la bande haute et la bande basse forment les deux
   * côtés du niveau. Une cassure en sort, un balayage-retour y revient.
   */
  | { type: "bollinger"; periode: number; ecarts: number }
  // ─── Zones : un niveau qui a une ÉPAISSEUR et un sens ───────────────────
  /**
   * ORDER BLOCK : la dernière bougie de sens opposé avant l'impulsion qui casse
   * la structure. Zone de demande sous le prix (achat), d'offre au-dessus
   * (vente).
   *
   * ⚠️ Contrairement à un niveau, une zone porte un SENS : une zone de demande
   * ne s'achète pas et ne se vend pas indifféremment. Le moteur le retient, et
   * `entree_dans_zone` ne déclenche que dans ce sens-là.
   */
  | { type: "order_block"; impulsionMinTicks: number }
  /**
   * FVG : le déséquilibre à trois bougies, pris comme ZONE d'entrée et non
   * comme simple condition. C'est la façon dont la plupart des traders ICT
   * l'emploient : ils attendent le retour DANS la boîte.
   */
  | { type: "fvg_zone"; tailleMinTicks: number }
  /**
   * BREAKER : un order block que le prix a traversé. Il change alors de camp,
   * une ancienne demande devenant une offre. C'est la nuance que les traders
   * distinguent d'un simple order block, et la confondre inverse le sens du
   * trade.
   */
  | { type: "breaker"; impulsionMinTicks: number };

// ─── DÉCLENCHEUR : le signal, évalué sur bougies CLÔTURÉES uniquement ──────

export type BlocDeclencheur =
  /** Le prix franchit le niveau. `cloture` est le mode honnête, `meche` compte le simple contact. */
  | { type: "cassure"; mode: "cloture" | "meche" }
  /**
   * Balayage puis retour : la bougie dépasse le niveau puis reclôture du côté
   * d'où elle venait. Le signal est à contre-sens de la cassure.
   */
  | { type: "balayage_retour" }
  /**
   * Cassure, puis retour toucher le niveau dans les N bougies suivantes.
   * `toleranceTicks` élargit la zone de contact.
   */
  | { type: "retest_apres_cassure"; delaiMaxBarres: number; toleranceTicks: number }
  /**
   * Cassure laissant un déséquilibre à trois bougies (FVG), puis retest de ce
   * déséquilibre dans les N bougies. C'est la forme la plus courante des
   * méthodes ICT, et celle qu'on doit savoir rejouer telle quelle.
   */
  | { type: "fvg_puis_retest"; delaiMaxBarres: number }
  /**
   * BALAYAGE DE LIQUIDITÉ PUIS RETOUR DANS LE FVG. C'est un RETOURNEMENT, à ne
   * pas confondre avec `fvg_puis_retest` qui est une continuation après cassure.
   *
   * Trois temps, et le scénario meurt si l'un manque :
   * 1. le prix va chercher la liquidité au-delà d'un pivot (BSL ou SSL) ;
   * 2. dans les `delaiReaction` bougies, une impulsion en sens inverse laisse un
   *    déséquilibre à trois bougies ;
   * 3. dans les `delaiRetest` bougies, le prix revient dans ce déséquilibre.
   *
   * ⚠️ INVALIDATION PERMANENTE : si le prix dépasse à nouveau l'extrême du
   * balayage avant l'entrée, le scénario est annulé. C'est la règle « le
   * retracement ne doit pas dépasser la prise de liquidité », et sans elle on
   * entre à contresens d'un marché qui continue.
   */
  | { type: "balayage_puis_fvg"; delaiReaction: number; delaiRetest: number }
  /**
   * LE PRIX REVIENT DANS LA ZONE, et on entre dans le sens de la zone.
   *
   * C'est l'entrée classique sur order block, breaker ou FVG : on ne casse
   * rien, on attend que le prix revienne dans la boîte. À n'employer qu'avec un
   * niveau qui est une zone : sur un niveau sans épaisseur, il n'y a pas de
   * dedans.
   *
   * ⚠️ Le signal ne se déclenche qu'à l'ENTRÉE dans la zone, pas tant que le
   * prix y reste. Sans cette bascule, une zone traversée lentement produirait un
   * signal à chaque bougie et gonflerait le nombre de trades sans raison.
   */
  | { type: "entree_dans_zone"; delaiMaxBarres: number };

// ─── CONFIRMATIONS : filtres facultatifs, TOUS doivent passer ──────────────

export type BlocConfirmation =
  /** La bougie de signal doit clôturer dans le sens du trade. */
  | { type: "bougie_reaction" }
  /** On n'entre que dans le sens de la moyenne mobile simple à N périodes. */
  | { type: "biais_moyenne"; periode: number }
  /** La bougie de signal doit avoir une amplitude minimale. */
  | { type: "amplitude_min"; ticks: number }
  /**
   * RSI, dans l'un des deux usages que les traders en font et qui sont
   * OPPOSÉS : suivre l'élan, ou jouer l'excès.
   *
   * `momentum` : on n'achète que si le RSI est au-dessus du seuil, donc dans le
   * sens de la force. `exces` : on n'achète que s'il est SOUS le seuil
   * symétrique, donc en survente. Confondre les deux inverse le filtre, et un
   * filtre inversé ne se voit pas dans les chiffres, seulement dans le nombre
   * de trades.
   */
  | { type: "rsi"; periode: number; seuil: number; mode: "momentum" | "exces" };

// ─── ENTRÉE ────────────────────────────────────────────────────────────────

export type BlocEntree =
  /**
   * Entrée à l'ouverture de la bougie SUIVANT le signal.
   * ⚠️ C'est la seule entrée honnête en M1 : au moment où on décide, la bougie
   * de signal vient de clôturer et le prix d'ouverture suivant est inconnu.
   */
  | { type: "open_bougie_suivante" }
  /** Ordre limite posé au niveau, valable N bougies puis annulé. */
  | { type: "limite_au_niveau"; valableNBarres: number };

// ─── SORTIES ───────────────────────────────────────────────────────────────

export type BlocStop =
  /** Extrême de la bougie de signal, plus un buffer. */
  | { type: "structurel"; bufferTicks: number }
  /** Distance fixe depuis l'entrée. */
  | { type: "fixe"; ticks: number }
  /** Côté opposé du niveau, plus un buffer. */
  | { type: "niveau_oppose"; bufferTicks: number }
  /**
   * Au-delà de l'extrême du balayage de liquidité, plus un buffer. C'est le
   * seul stop qui traduise « le scénario est invalidé » : au-dessus de ce prix,
   * la prise de liquidité n'était pas un piège.
   * Ne vaut qu'avec le déclencheur `balayage_puis_fvg`.
   */
  | { type: "extreme_balayage"; bufferTicks: number }
  /**
   * Derrière le dernier sommet pivot confirmé (en vente) ou le dernier creux
   * (en achat), plus un buffer.
   *
   * C'est le « stop derrière le dernier sommet » que décrivent les traders de
   * trendline, et il est BEAUCOUP plus large qu'un stop sur la bougie de
   * signal : sur le Nasdaq en M3, trente points contre sept. Cette différence
   * décide à elle seule si les coûts mangent le risque ou non.
   */
  | { type: "dernier_pivot"; bufferTicks: number };

export type BlocObjectif =
  /** Multiple du risque initial. 2 = on vise deux fois la distance du stop. */
  | { type: "multiple_r"; r: number }
  /** Côté opposé du niveau. */
  | { type: "niveau_oppose" };

export interface SortiesAuxiliaires {
  /** Stop ramené à l'entrée dès que le trade atteint ce multiple de R. */
  breakEvenApresR?: number;
  /** Tout est liquidé à cette heure locale, "HH:MM". */
  finDeSession?: string;
  /** Tout est liquidé après N bougies en position. */
  apresNBarres?: number;
}

// ─── GESTION : les garde-fous, déjà présents dans la fiche du trader ───────

export interface Gestion {
  /**
   * Part du capital risquée par trade, en pourcent.
   *
   * ⚠️ LE MOTEUR L'IGNORE VOLONTAIREMENT, et ce n'est pas un oubli. Un résultat
   * mesuré en R ne dépend d'aucune taille de position : c'est ce qui le rend
   * comparable d'un instrument et d'un trader à l'autre. Ce champ sert à la
   * LECTURE, en aval : traduire les R en pourcents de capital, et surtout
   * confronter le risque par trade aux garde-fous. « -1690 R » ne dit rien à
   * personne ; « trois pertes d'affilée à 5 %, soit -15 % dans la journée »
   * dit tout, et c'est une multiplication, pas une prévision.
   */
  risqueParTradePct?: number;
  /** Plafond de trades ouverts dans la journée. */
  maxTradesParJour?: number;
  /** Arrêt de la journée après N pertes d'affilée. */
  maxPertesConsecutives?: number;
  /** Arrêt de la journée quand le cumul du jour descend sous -X R. */
  maxPerteJournaliereR?: number;
}

// ─── COÛTS ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ AUCUNE VALEUR PAR DÉFAUT N'EST NULLE, ET C'EST LE POINT LE PLUS IMPORTANT
 * DU FICHIER. Un backtest à coûts zéro rend positives des stratégies qui
 * perdent de l'argent : l'espérance d'une méthode M1 se compte en centièmes de
 * R, et un aller-retour réel coûte souvent davantage. Un outil qui laisse le
 * spread à 0 par défaut ne mesure pas une stratégie, il en fabrique une.
 */
export interface Couts {
  /** Écart achat-vente, en ticks. Payé à l'entrée et à la sortie. */
  spreadTicks: number;
  /** Glissement, en ticks. Payé à l'entrée et sur les sorties au marché (stop). */
  glissementTicks: number;
  /**
   * Commission de l'aller-retour, exprimée en ticks pour rester dans l'unité du
   * moteur. L'interface la calcule depuis les frais réels du courtier.
   */
  commissionTicks: number;
}

// ─── LE PLAN COMPLET ───────────────────────────────────────────────────────

export interface PlanExecution {
  instrument: string;
  /**
   * Unité de temps de lecture, en minutes. Les bougies stockées sont des M1 et
   * sont regroupées avant l'exécution.
   *
   * ⚠️ Presque personne ne trade en M1 : lire une stratégie de M3 sur des
   * bougies d'une minute change TOUT, à commencer par la taille des stops
   * structurels. Absent ou 1 = M1.
   */
  uniteDeTemps?: number;
  /** Sens autorisés. */
  sens: "long" | "short" | "les_deux";
  contexte: Contexte;
  niveau: BlocNiveau;
  declencheur: BlocDeclencheur;
  /** Facultatifs. Tous doivent passer pour que l'entrée soit prise. */
  confirmations: BlocConfirmation[];
  entree: BlocEntree;
  stop: BlocStop;
  objectif: BlocObjectif;
  sortiesAuxiliaires: SortiesAuxiliaires;
  gestion: Gestion;
  couts: Couts;
}

// ─── RÉSULTATS ─────────────────────────────────────────────────────────────

/** Pourquoi un trade s'est terminé. Sert aussi à l'audit. */
export type MotifSortie =
  | "stop"
  | "objectif"
  | "break_even"
  | "fin_de_session"
  | "duree_max"
  | "fin_de_serie";

/** Un point du graphique : un instant et un prix, en ticks. */
export interface PointTrace {
  ms: number;
  prixTicks: number;
}

/**
 * LA GÉOMÉTRIE QUI A PRODUIT LE SIGNAL, POUR LA REDESSINER TELLE QU'ELLE EST.
 *
 * ⚠️ NÉ D'UN CONSTAT SANS APPEL : le graphique d'inspection traçait le niveau
 * comme une HORIZONTALE, y compris pour une trendline. Un trader regardait donc
 * son setup et n'y reconnaissait ni tendance, ni trendline, ni rien : il voyait
 * des bougies et trois traits plats. Le but de cette section est qu'il puisse
 * dire « oui, c'est ma méthode » ou « non » ; sans la vraie géométrie, il ne
 * peut dire ni l'un ni l'autre, et toute la boucle de vérification tombe.
 *
 * Le moteur porte donc ce que le trader aurait tracé à la main.
 */
export type TraceSignal =
  /** Une trendline : ses deux ancrages, prolongée, plus ses touches. */
  | { forme: "droite"; a: PointTrace; b: PointTrace; touches: PointTrace[] }
  /** Un niveau horizontal : ancien sommet, plus haut de la veille, etc. */
  | { forme: "horizontale"; prixTicks: number }
  /** Une plage de prix bornée dans le temps : range d'ouverture, déséquilibre. */
  | { forme: "zone"; hautTicks: number; basTicks: number; debutMs: number; finMs: number };

/**
 * Ce que la MÉCANIQUE D'ENTRÉE a construit, en plus du niveau.
 *
 * ⚠️ NÉ DU MÊME CONSTAT QUE `TraceSignal`, POUSSÉ D'UN CRAN. On dessinait le
 * niveau franchi, et rien de ce qui déclenche vraiment l'entrée : un trader ICT
 * qui attend « le balayage puis le déséquilibre » voyait une ligne et une
 * bougie d'entrée, sans la mèche qui a pris la liquidité ni la boîte dans
 * laquelle il revient. Il ne pouvait donc pas dire si la machine avait reconnu
 * SA mécanique ou une autre qui tombe au même endroit par hasard.
 *
 * Un déclencheur peut en produire plusieurs : `balayage_puis_fvg` en pose deux,
 * la prise de liquidité ET le déséquilibre, parce que ce sont deux événements
 * distincts dont l'ordre fait toute la méthode.
 */
export type TraceMecanique =
  /** Le déséquilibre à trois bougies, avec le bord que le prix revient toucher. */
  | {
      forme: "desequilibre";
      hautTicks: number;
      basTicks: number;
      debutMs: number;
      finMs: number;
      /** Le bord retesté. C'est LUI qui décide, pas le milieu de la boîte. */
      bordTicks: number;
    }
  /** La prise de liquidité : d'où le prix est parti chercher, et jusqu'où. */
  | {
      forme: "balayage";
      /** Le niveau dont la liquidité a été prise. */
      niveauTicks: number;
      /** La pointe de la mèche, au-delà du niveau. */
      extremeTicks: number;
      ms: number;
    };

export interface TradeSimule {
  /**
   * Ouverture de la bougie de SIGNAL, ms epoch. Une bougie avant l'entrée.
   *
   * ⚠️ Sert à DESSINER le trade pour que le trader vérifie de ses yeux que la
   * machine a bien reconnu son setup. C'est la seule vérification qui compte :
   * trois fois de suite, sur cette fonctionnalité, c'est un graphique et non un
   * texte qui a révélé qu'on testait autre chose que la méthode décrite.
   */
  signalMs: number;
  /**
   * Valeur du niveau au moment du signal, en ticks. Pour une trendline, c'est
   * la hauteur de la droite à cet instant, donc ce que le trader doit
   * reconnaître ou démentir.
   */
  niveauSignal: number;
  /**
   * De quoi REDESSINER le niveau tel que le trader l'aurait tracé.
   * Absent quand la forme n'est pas encore modélisée pour ce bloc.
   */
  trace?: TraceSignal;
  /**
   * Ce que la mécanique d'entrée a construit : déséquilibre, balayage.
   * Vide quand le déclencheur n'a pas de forme propre (une simple cassure n'en
   * a pas : le niveau EST toute sa géométrie).
   */
  mecanique?: TraceMecanique[];
  /** Ouverture de la bougie d'ENTRÉE, ms epoch. */
  entreeMs: number;
  /** Ouverture de la bougie de SORTIE, ms epoch. */
  sortieMs: number;
  sens: "long" | "short";
  /** Prix d'entrée effectif, coûts d'entrée inclus, en ticks. */
  entreeTicks: number;
  /** Prix de sortie effectif, coûts de sortie inclus, en ticks. */
  sortieTicks: number;
  /** Distance entrée-stop initiale, en ticks. C'est le 1R du trade. */
  risqueTicks: number;
  /** Résultat en multiples de R, coûts déduits. */
  r: number;
  /** Le même résultat SANS aucun coût. Sert à l'audit de coûts. */
  rBrut: number;
  motif: MotifSortie;
  /**
   * Vrai si le stop et l'objectif étaient tous deux atteignables dans la même
   * bougie. On tranche alors au stop, faute de savoir lequel est venu en
   * premier. Le compte de ces cas est publié : c'est de l'incertitude assumée,
   * pas un détail d'implémentation.
   */
  collisionMemeBarre: boolean;
}

export interface AuditExecution {
  /** Bougies parcourues. */
  bougies: number;
  /** Signaux détectés, avant filtres de gestion. */
  signaux: number;
  /** Signaux refusés par un plafond de gestion (trades/jour, pertes d'affilée). */
  refusesParGestion: number;
  /** Ordres limites expirés sans être touchés. */
  limitesExpirees: number;
  /**
   * Signaux refusés parce que le stop tombait plus près que ce que coûte un
   * aller-retour.
   *
   * ⚠️ CE COMPTEUR EXISTE PARCE QUE SON ABSENCE FAUSSAIT TOUT. Le résultat d'un
   * trade est mesuré en multiples de son risque : un stop à un tick met un
   * denominateur minuscule sous une division, et ce seul trade pèse alors des
   * centaines de R. Mesuré sur l'or réel, l'espérance nette sortait à -1,18 R
   * quand la brute valait -0,01 R, et l'écart entier venait de poignées de
   * trades au stop collé à l'entrée. Ce ne sont pas des trades : personne ne
   * risque un dixième de centime pour en payer quarante-deux.
   */
  refusesRisqueTropPetit: number;
  /**
   * Journées où un garde-fou a coupé court (pertes d'affilée, perte du jour).
   *
   * ⚠️ SANS CE COMPTEUR, L'ÉCRAN MENT PAR OMISSION. Une journée arrêtée ne
   * produit plus AUCUN signal : `refusesParGestion` reste donc à zéro et le
   * trader lit « 0 refusés par tes garde-fous » alors que sa règle a coupé
   * quarante journées. Le plafond de trades, lui, refuse des signaux qu'on a
   * bien vus : les deux mécanismes ne se comptent pas au même endroit.
   */
  journeesArretees: number;
  /**
   * Bougies pendant lesquelles au moins un côté du niveau existait.
   *
   * ⚠️ SANS CE COMPTEUR, UN RÉSULTAT VIDE EST MUET. Un plan qui ne rend aucun
   * trade a deux causes très différentes : soit le niveau n'a jamais existé
   * (largeur de pivot absurde, trendline jamais confirmée), soit il existait et
   * n'a jamais été franchi. La première se corrige en deux clics, la seconde
   * veut dire que la méthode ne se déclenche pas. Les confondre laisse le
   * trader devant un zéro sans issue.
   */
  barresAvecNiveau: number;
  /** Droites candidates ouvertes, et celles qui ont atteint leur compte de touches. */
  droitesTracees: number;
  droitesConfirmees: number;
  /** Trades dont le stop et l'objectif tombaient dans la même bougie. */
  collisions: number;
  /**
   * Coût total payé, en R cumulés. Il doit égaler l'écart entre la somme des
   * `rBrut` et celle des `r` : un test le vérifie, parce qu'un audit de coûts
   * calculé à part de l'exécution finit toujours par mentir.
   */
  coutTotalR: number;
}

export interface ResultatBacktest {
  trades: TradeSimule[];
  audit: AuditExecution;
  /** Première et dernière bougie effectivement parcourues, ms epoch. */
  debutMs: number;
  finMs: number;
}
