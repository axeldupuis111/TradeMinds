/**
 * Glossaires de référence par école de trading, chargés à la demande.
 *
 * Le coach n'ancrait que le vocabulaire ICT / SMC : 850 tokens sur une seule
 * école et rien sur les autres. Un modèle qui lit ça penche vers ICT quel que
 * soit le trader, alors qu'une bonne partie d'entre eux la rejettent.
 *
 * Le problème n'est pas que le modèle ignore les autres méthodes : il les
 * connaît par son entraînement. Ce qui a échoué sur ICT, c'est une paire
 * notoirement inversée (BSL/SSL) et un sigle mal développé (« BB »). Le travail
 * est donc d'ancrer, école par école, les seuls termes qui se confondent.
 *
 * ÉCONOMIE DU MÉCANISME : on ne charge que les glossaires détectés dans la
 * fiche du trader, deux au maximum. La bibliothèque peut donc s'étendre sans
 * coûter un token de plus à personne. À 450 messages/mois, empiler toutes les
 * écoles aurait coûté ~1 € par abonné pour une marge de 0,93 €.
 *
 * ⚠️ Ces définitions sont servies telles quelles au coach de TOUS les traders
 * concernés. Une définition fausse ancrée ici est pire que pas de définition :
 * toute modification doit être relue par quelqu'un qui trade la méthode.
 */

export type MethodFamily =
  | "ict"
  | "supply_demand"
  | "price_action"
  | "indicators"
  | "wyckoff"
  | "elliott"
  | "harmonics"
  | "ichimoku"
  | "pivots"
  | "market_profile"
  | "trend_following"
  | "mean_reversion"
  | "news_macro"
  | "crypto"
  | "chart_types"
  | "risk";

interface Glossary {
  /**
   * Termes qui n'appartiennent qu'à cette école : un seul suffit à la retenir.
   * « gartley », « ichimoku », « fvg » ne veulent rien dire ailleurs.
   */
  markers: string[];
  /**
   * Termes du vocabulaire de l'école, mais qui sont aussi des mots courants.
   * « base », « vague », « impulsion », « distribution », « momentum » : seuls,
   * ils déclenchaient l'école sur des phrases banales (« je me base sur la
   * tendance » chargeait le glossaire offre/demande). Il en faut DEUX, ou un
   * marqueur sûr, pour retenir l'école.
   */
  weak?: string[];
}

interface GlossaryEntry extends Glossary {
  text: string;
}

/**
 * Ordre = priorité de détection. ICT en premier : c'est l'école dont le
 * vocabulaire est le plus spécifique, donc la moins susceptible d'être
 * détectée par erreur.
 */
const GLOSSARIES: Record<MethodFamily, GlossaryEntry> = {
  ict: {
    markers: [
      "ict", "smc", "smart money", "fvg", "fair value gap", "order block",
      "killzone", "kill zone", "bsl", "ssl", "breaker", "choch", "mss",
      "bos", "judas", "silver bullet", "po3",
    ],
    weak: [
      "liquidite", "liquidity", "displacement", "deplacement", "imbalance",
    ],
    text: `VOCABULAIRE ICT / SMC, DÉFINITIONS DE RÉFÉRENCE. Ce sont les bonnes : emploie-les telles quelles, sans les improviser. Une inversion rend ton conseil dangereux.
- Liquidité : ordres en attente regroupés là où tout le monde place ses stops, au-dessus des sommets et sous les creux.
- BSL (Buy Side Liquidity) : liquidité côté ACHAT, située AU-DESSUS du prix (sommets, sommets égaux). Ce sont des ordres d'achat en attente : stops de protection des vendeurs, et achats de cassure.
- SSL (Sell Side Liquidity) : liquidité côté VENTE, située SOUS le prix (creux, creux égaux). Ordres de vente en attente : stops de protection des acheteurs, et ventes de cassure.
- Balayage (sweep, raid) : le prix traverse le niveau, déclenche ces ordres, puis fait demi-tour.
- SENS DE L'ENTRÉE, LE POINT LE PLUS FAUSSÉ : on entre CONTRE le sens du balayage, jamais dans son sens. BSL balayée puis rejetée, avec un mouvement franc vers le bas, la lecture est VENDEUSE. SSL balayée puis rejetée vers le haut, la lecture est ACHETEUSE. Dire l'inverse est une faute grave.
- Cela n'oblige pas à trader à contre-tendance. C'est le côté de liquidité chassé qui décide : dans une tendance haussière, on guette le balayage d'une SSL sous un creux précédent, puis on cherche l'achat DANS le sens de la tendance.
- Déplacement : mouvement rapide et franc qui s'éloigne du niveau balayé. C'est lui qui valide le rejet, et il laisse souvent le FVG.
- FVG (Fair Value Gap) : déséquilibre sur trois bougies, la mèche de la première et celle de la troisième ne se recouvrent pas. Sert de zone d'entrée quand le prix y revient.
- OB (Order Block) : dernière bougie de sens opposé avant le déplacement.
- BB = Breaker Block : un order block cassé, sur lequel le prix revient par l'autre côté et qui joue alors le rôle inverse. "BB" ne signifie PAS "Break of Break" : cette expression n'existe pas, ne l'emploie jamais.
- BOS (Break of Structure) : cassure d'un point de structure DANS le sens de la tendance, donc continuation.
- MSS ou CHoCH (Market Structure Shift, Change of Character) : cassure d'un point de structure CONTRE la tendance précédente. C'est ce qui confirme un retournement après un balayage.
- Killzone : plage horaire sur laquelle la méthode concentre ses setups (ouvertures de Londres et de New York principalement). C'est une fenêtre de sélection, jamais un signal en soi : être dans la killzone ne justifie aucune entrée.
- PO3 (Power of Three) : lecture d'une séance en trois temps, accumulation puis manipulation puis distribution. La manipulation est le balayage qui piège, avant le vrai mouvement.
- Judas swing : le faux mouvement du début de séance, dans le sens inverse du vrai, qui prend la liquidité avant le retournement. C'est la phase de manipulation du PO3 vue à l'échelle de l'ouverture.
- Silver Bullet : setup sur une fenêtre horaire fixe et étroite, où l'on ne cherche qu'un retour dans un FVG formé pendant cette fenêtre. Comme la killzone, c'est un filtre de temps, pas un signal.`,
  },

  supply_demand: {
    markers: [
      "supply", "demand", "zone d'offre", "zone de demande",
      "zones de demande", "zones d'offre", "drop base rally",
      "rally base drop", "dbr", "rbd", "zone fraiche",
    ],
    weak: [
      "base", "desequilibre", "offre et demande",
    ],
    text: `VOCABULAIRE OFFRE / DEMANDE (SUPPLY & DEMAND), DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Zone de demande : zone d'où le prix est reparti à la hausse de façon franche, en laissant derrière lui des ordres d'achat non exécutés. Zone d'offre : la symétrique, d'où le prix est reparti à la baisse.
- Base : la consolidation étroite d'où part le mouvement. C'est elle qu'on trace, pas le mouvement.
- Les quatre schémas : drop-base-rally et rally-base-rally donnent des zones de DEMANDE ; rally-base-drop et drop-base-drop donnent des zones d'OFFRE. Les deux premiers de chaque paire sont des retournements, les seconds des continuations.
- Déséquilibre : la sortie de zone doit être rapide et directionnelle. C'est la preuve qu'il restait des ordres non servis ; une sortie molle ne qualifie pas la zone.
- Fraîcheur : une zone jamais retestée est dite fraîche. Chaque retour y consomme des ordres et l'affaiblit, donc le premier retest est le plus fort.
- NE CONFONDS PAS avec un simple support ou une résistance : une zone offre/demande se justifie par le déséquilibre qui en est parti, pas par le nombre de fois où le prix y a touché.`,
  },

  price_action: {
    markers: [
      "price action", "pin bar", "engulfing", "avalement", "double top",
      "double bottom", "epaule tete epaule", "biseau",
    ],
    weak: [
      "support", "resistance", "chandelier", "bougie", "pullback",
      "breakout", "cassure", "retest", "triangle",
    ],
    text: `VOCABULAIRE PRICE ACTION CLASSIQUE, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Support et résistance : niveaux où le prix a déjà réagi plusieurs fois. Après cassure, le rôle s'inverse (polarité) : une résistance cassée devient support.
- Tendance : haussière quand les sommets ET les creux montent, baissière quand ils descendent, range sinon. Un seul des deux ne suffit pas à conclure.
- Pullback : retour contre la tendance vers un niveau ou une moyenne, avant reprise. À distinguer d'un retournement, que seule la structure tranche.
- Pin bar : bougie à longue mèche et petit corps, qui matérialise le rejet d'un niveau. La mèche doit dépasser le niveau, la clôture revenir de l'autre côté.
- Engulfing (avalement) : bougie dont le CORPS englobe entièrement celui de la précédente, en sens opposé. Les mèches ne comptent pas dans la définition.
- Cassure et faux signal : une cassure sans continuation immédiate est suspecte. Le retest du niveau cassé est la confirmation la plus employée, au prix d'entrées manquées.
- Figures : double sommet et double creux, épaule-tête-épaule, triangles et biseaux. Leur objectif classique se projette de la hauteur de la figure depuis le point de cassure. Ce sont des repères, pas des certitudes.`,
  },

  indicators: {
    markers: [
      "rsi", "macd", "fibonacci", "fibo", "stochastique", "bollinger", "ema",
      "sma", "mm50", "mm200", "atr",
    ],
    weak: [
      "retracement", "moyenne mobile", "divergence", "surachat", "survente",
    ],
    text: `VOCABULAIRE DES INDICATEURS, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles, et rappelle les pièges quand ils s'appliquent.
- RSI : oscillateur borné 0-100, 14 périodes par défaut. Au-dessus de 70 on parle de surachat, sous 30 de survente. PIÈGE MAJEUR : en tendance forte le RSI reste en zone extrême très longtemps ; ce n'est PAS un signal de retournement à lui seul.
- Divergence : le prix fait un nouvel extrême que l'indicateur ne confirme pas. Haussière quand le prix fait un creux plus bas et l'indicateur un creux plus haut, baissière à l'inverse.
- MACD : écart entre deux moyennes exponentielles (12 et 26), accompagné d'une ligne de signal (9). L'histogramme est l'écart entre la ligne MACD et sa ligne de signal, pas un troisième indicateur.
- Fibonacci : retracements à 23,6 / 38,2 / 50 / 61,8 / 78,6 % d'une impulsion, extensions à 127,2 / 161,8 % pour les objectifs. Le 61,8 % est le plus suivi. À SAVOIR : le 50 % n'est pas un ratio de Fibonacci, il est conservé par usage.
- Moyennes mobiles : simple (SMA) ou exponentielle (EMA), cette dernière réagissant plus vite. Croisement doré = la 50 passe au-dessus de la 200 ; croisement de la mort = l'inverse. Toutes sont retardées par construction.
- Bandes de Bollinger : moyenne 20 périodes encadrée de deux écarts-types. Le resserrement signale une compression de volatilité, souvent avant expansion. Toucher une bande n'est pas un signal en soi.
- Stochastique : compare la clôture à l'amplitude des N dernières périodes (14 par défaut), borné 0-100, avec une ligne %K et sa moyenne %D. Au-dessus de 80 on parle de surachat, sous 20 de survente. Il souffre du MÊME piège que le RSI en tendance forte.
- ATR : amplitude moyenne sur N périodes. Sert à dimensionner un stop ou un objectif selon la volatilité, pas à donner une direction.`,
  },

  wyckoff: {
    markers: [
      "wyckoff", "spring", "upthrust", "utad", "volume profile",
      "profil de volume", "poc", "vah", "order flow", "footprint", "vwap",
      "absorption",
    ],
    weak: [
      "accumulation", "distribution", "delta", "val",
    ],
    text: `VOCABULAIRE WYCKOFF ET VOLUME, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Accumulation : phase de range qui suit une baisse, pendant laquelle l'offre est absorbée par des acheteurs patients. Distribution : la symétrique après une hausse.
- Spring : brève cassure SOUS le bas d'un range d'accumulation, immédiatement suivie d'un retour dans le range. C'est un piège à vendeurs, la lecture est HAUSSIÈRE.
- Upthrust (et UTAD) : brève cassure AU-DESSUS du haut d'un range de distribution, suivie d'un retour dedans. Piège à acheteurs, lecture BAISSIÈRE. Ne confonds jamais les deux : spring en bas et haussier, upthrust en haut et baissier.
- Repères de phase, en accumulation : PS (preliminary support), SC (selling climax), AR (automatic rally), ST (secondary test), LPS (last point of support), SOS (sign of strength). En distribution, les symétriques : PSY (preliminary supply), BC (buying climax), AR (automatic reaction), ST, UT puis UTAD, LPSY (last point of supply), SOW (sign of weakness).
- POC (point of control) : le prix auquel le plus de volume s'est échangé sur la période observée. Il agit souvent comme aimant.
- VAH et VAL : bornes haute et basse de la zone contenant environ 70 % du volume de la période. En dehors, le marché est en déséquilibre.
- VWAP : prix moyen pondéré par les volumes depuis un point d'ancrage. Sert de référence de valeur, surtout en intraday.
- Delta : différence entre volume exécuté à l'achat et à la vente. Absorption : un volume important qui ne fait PAS bouger le prix, signe qu'un participant absorbe les ordres en face.`,
  },

  elliott: {
    markers: [
      "elliott", "zigzag", "sous-vague", "vague 1", "vague 2", "vague 3",
      "vague 4", "vague 5", "vague a", "vague b", "vague c",
    ],
    weak: [
      "vague", "impulsion", "corrective", "abc", "wave", "flat",
      "correction plate", "diagonale",
    ],
    text: `VOCABULAIRE ELLIOTT, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Structure : une impulsion se compte en 5 vagues (1-2-3-4-5) dans le sens de la tendance de degré supérieur, une correction en 3 (A-B-C).
- TROIS RÈGLES ABSOLUES, qui invalident un décompte si elles sont violées : la vague 2 ne retrace jamais 100 % de la vague 1 ; la vague 3 n'est jamais la plus courte des trois vagues motrices (1, 3, 5) ; la vague 4 n'entre jamais dans la zone de prix de la vague 1 (seule exception : les diagonales).
- Proportions usuelles : la vague 3 est le plus souvent la plus longue, fréquemment à 161,8 % de la vague 1. Ce sont des tendances, pas des règles.
- Corrections : zigzag (5-3-5), plat (3-3-5), triangle (3-3-3-3-3).
- Degrés : les vagues s'emboîtent, chaque vague contient des sous-vagues d'un degré inférieur. Toujours préciser le degré dont on parle.
- À DIRE AU TRADER : un décompte est une lecture, pas une prédiction. Il se révise quand le prix invalide une règle, et deux analystes compétents peuvent compter différemment.`,
  },

  harmonics: {
    markers: [
      "harmonique", "harmonic", "gartley", "butterfly", "papillon", "crab",
      "crabe", "shark", "cypher", "prz", "xabcd",
    ],
    weak: [
      "bat",
    ],
    text: `VOCABULAIRE DES FIGURES HARMONIQUES, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles ; ce sont les ratios qui définissent la figure, pas sa silhouette.
- Structure commune : cinq points X-A-B-C-D. L'entrée se cherche au point D, dans la PRZ (potential reversal zone).
- Gartley : B à 61,8 % de XA, D à 78,6 % de XA.
- Bat : B entre 38,2 et 50 % de XA, D à 88,6 % de XA.
- Butterfly : B à 78,6 % de XA, D en EXTENSION à 127,2-161,8 % de XA.
- Crab : B entre 38,2 et 61,8 % de XA, D en extension à 161,8 % de XA. C'est la plus profonde des quatre.
- CE QUI LES SÉPARE : chez Gartley et Bat, D reste À L'INTÉRIEUR de l'amplitude XA. Chez Butterfly et Crab, D DÉPASSE X. Confondre les deux familles inverse la zone d'entrée.
- Cypher : sa signature est le point D à 78,6 % du segment XC, et non de XA comme les quatre précédentes. C se situe au-delà de A.
- Shark : elle se compte sur les points 0-X-A-B-C et non X-A-B-C-D, et l'entrée se fait en C, au-delà de X. Ses bandes de ratios varient selon les auteurs : si le trader l'emploie, demande-lui les siennes plutôt que d'en avancer.
- ABCD simple : le segment CD reproduit AB en amplitude, souvent en durée.
- Une figure dont les ratios ne tombent pas n'est pas « approximativement » valide : c'est une autre figure, ou aucune.`,
  },

  ichimoku: {
    markers: [
      "ichimoku", "kumo", "tenkan", "kijun", "senkou", "chikou", "kinko hyo",
    ],
    weak: [
      "nuage",
    ],
    text: `VOCABULAIRE ICHIMOKU, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Tenkan-sen (conversion, 9 périodes) et Kijun-sen (base, 26) : moyenne du plus haut et du plus bas sur la période. Ce ne sont PAS des moyennes mobiles de clôture.
- Senkou Span A : moyenne de Tenkan et Kijun, projetée 26 périodes VERS L'AVANT.
- Senkou Span B : moyenne des extrêmes sur 52 périodes, projetée 26 périodes VERS L'AVANT.
- Kumo (nuage) : la zone entre Senkou A et B. Support ou résistance visible à l'avance, puisque projeté dans le futur.
- Chikou Span : la clôture actuelle reportée 26 périodes VERS L'ARRIÈRE.
- PIÈGE LE PLUS FRÉQUENT : Senkou se projette en avant, Chikou en arrière. Les intervertir inverse toute la lecture du graphique.
- Lecture classique : position du prix par rapport au Kumo, croisement Tenkan/Kijun, et Chikou dégagé du prix passé. Les trois se lisent ensemble, jamais isolément.`,
  },

  pivots: {
    markers: [
      "pivot", "camarilla", "woodie", "point pivot",
    ],
    weak: [
      "r1", "r2", "r3", "s1", "s2", "s3", "fibonacci pivot",
    ],
    text: `VOCABULAIRE DES POINTS PIVOTS, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Pivot classique : P = (plus haut + plus bas + clôture) / 3 de la séance PRÉCÉDENTE. Puis R1 = 2P − plus bas, S1 = 2P − plus haut, et les niveaux suivants par report de l'amplitude.
- Woodie : donne plus de poids à la clôture, P = (plus haut + plus bas + 2 × clôture) / 4.
- Camarilla : niveaux resserrés autour de la clôture, obtenus en appliquant des coefficients à l'amplitude de la veille. H3 et L3 servent souvent de bornes de retournement, H4 et L4 de seuils de cassure.
- RÈGLE DE CALCUL : les pivots se calculent sur la séance précédente et valent pour toute la séance en cours. Les recalculer en intraday n'a pas de sens et fabrique des niveaux qui n'existent pour personne.
- Leur intérêt vient de ce que beaucoup d'intervenants regardent les mêmes niveaux, pas d'une propriété du marché.`,
  },

  market_profile: {
    markers: [
      "market profile", "profil de marche", "tpo", "initial balance",
      "single print", "double distribution",
    ],
    weak: [
      "zone de valeur", "value area",
    ],
    text: `VOCABULAIRE MARKET PROFILE (TPO), DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- TPO (time price opportunity) : chaque lettre marque une unité de TEMPS passée à un prix. C'est la différence avec le profil de volume, qui compte les contrats échangés : le premier mesure la durée, le second la quantité.
- Initial balance (IB) : l'amplitude de la première heure de séance. Sa cassure d'un côté oriente souvent la journée.
- Zone de valeur : la plage contenant environ 70 % des TPO. POC : la ligne la plus longue du profil.
- Single prints : prix traversés une seule fois, laissés par un mouvement rapide. Ils sont souvent revisités plus tard.
- Journées types : normale, en tendance, neutre, double distribution. Nommer le type de journée aide à choisir entre suivre et faire du retour à la moyenne.`,
  },

  trend_following: {
    markers: [
      "suivi de tendance", "trend following", "donchian", "tortue", "turtle",
      "canal de donchian", "pyramidage", "breakout system",
    ],
    weak: [
      "momentum",
    ],
    text: `VOCABULAIRE DU SUIVI DE TENDANCE, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Canal de Donchian : plus haut et plus bas des N dernières périodes. L'entrée se fait à la cassure du canal, dans le sens de la cassure.
- Système des Tortues : entrée à la cassure de 20 périodes, sortie à 10, taille de position calculée à partir de l'ATR, et pyramidage par paliers d'une fraction d'ATR.
- Anti-martingale : on augmente la taille quand le système gagne, jamais quand il perd. C'est l'inverse exact de la martingale, et le seul des deux qui soit défendable.
- CE QU'IL FAUT DIRE AU TRADER : le suivi de tendance a par construction un TAUX DE RÉUSSITE FAIBLE, souvent sous 40 %, compensé par de rares gains très supérieurs aux pertes. Juger ce style sur son winrate est un contresens : c'est l'espérance et la taille des gagnants qui comptent.`,
  },

  mean_reversion: {
    markers: [
      "retour a la moyenne", "mean reversion", "range trading", "fade",
      "scalp range",
    ],
    weak: [
      "deviation", "contre tendance", "bornes", "range",
    ],
    text: `VOCABULAIRE DU RETOUR À LA MOYENNE, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Range : zone bornée par un plafond et un plancher tenus plusieurs fois. On vend le haut et on achète le bas TANT QUE les bornes tiennent.
- Déviation : sortie brève d'une borne suivie d'un retour à l'intérieur. C'est ce retour qui constitue le signal, pas la sortie elle-même.
- Fader : prendre position contre le mouvement en cours, en pariant sur son épuisement. « Fader la borne haute » = vendre le haut du range.
- Retour à la moyenne : hypothèse qu'un écart excessif à une moyenne se referme. L'écart se mesure (écart-type, ATR), il ne s'estime pas à l'œil.
- PROFIL INVERSE DU SUIVI DE TENDANCE : taux de réussite élevé, gains petits, pertes rares mais grosses quand le range casse. D'où la règle : l'invalidation doit être définie AVANT l'entrée, sinon un seul range cassé efface des semaines.
- Les deux styles ne se combinent pas sur le même horizon : sur un même graphique, il faut choisir.`,
  },

  news_macro: {
    markers: [
      "nfp", "cpi", "fomc", "pmi", "news trading", "calendrier economique",
      "straddle", "banque centrale", "taux directeur",
    ],
    weak: [
      "annonce", "annonces", "consensus", "macro",
    ],
    text: `VOCABULAIRE DU TRADING D'ANNONCES, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Les publications qui bougent le marché : NFP (emploi américain), CPI (inflation), FOMC (banque centrale américaine), PMI, PIB, décisions de taux.
- CE QUI FAIT LE MOUVEMENT : l'ÉCART entre le chiffre publié et le consensus attendu, pas la qualité absolue du chiffre. Un chiffre objectivement bon mais INFÉRIEUR aux attentes déçoit le marché, et inversement.
- Le SENS de la réaction dépend de l'actif et de la donnée, il n'y a pas de règle universelle. Une inflation plus forte que prévu soutient généralement la devise (resserrement anticipé) tout en pesant sur les indices actions. Ne donne jamais une direction sans dire de quel actif tu parles.
- Straddle : se positionner des deux côtés avant l'annonce pour capter la direction quelle qu'elle soit.
- LE RISQUE PRINCIPAL N'EST PAS LA DIRECTION, C'EST L'EXÉCUTION : élargissement des spreads, glissement, et stops qui ne sont pas garantis dans ces secondes-là. Un plan correct sur le papier peut coûter plusieurs fois le risque prévu.
- Le calendrier économique de TradeDiscipline sert précisément à repérer ces fenêtres à l'avance.`,
  },

  crypto: {
    markers: [
      "funding", "open interest", "perpetuel", "perp", "altseason",
      "onchain", "halving", "defi", "altcoin", "dominance",
    ],
    weak: [
      "liquidation", "liquidations",
    ],
    text: `VOCABULAIRE CRYPTO, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Funding rate : paiement périodique entre positions longues et courtes sur les contrats perpétuels, qui maintient le prix collé au spot. Positif, les longs paient les shorts, signe d'un positionnement acheteur excessif ; négatif, l'inverse.
- Open interest : nombre de contrats ouverts. Prix qui monte avec OI en hausse = argent frais qui entre ; prix qui monte avec OI en baisse = rachat de vendeurs, mouvement moins solide.
- Liquidation : fermeture forcée d'une position à effet de levier. Une cascade se produit quand des liquidations en déclenchent d'autres, d'où les mèches violentes.
- Dominance BTC : part de la capitalisation totale détenue par le bitcoin.
- SPÉCIFICITÉ À RAPPELER : le marché est ouvert 24/7, il n'y a ni séance ni clôture officielle. Les repères construits sur des séances (pivots, initial balance) doivent être ancrés explicitement, sinon ils ne veulent rien dire.`,
  },

  chart_types: {
    markers: [
      "heikin", "heiken", "renko", "kagi", "point and figure",
    ],
    weak: [
      "brique", "briques", "ligne de rupture",
    ],
    text: `VOCABULAIRE DES TYPES DE GRAPHIQUES ALTERNATIFS, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Heikin Ashi : bougies recalculées. La clôture HA est la moyenne des quatre prix de la période (ouverture, plus haut, plus bas, clôture) ; l'ouverture HA est la moyenne de l'ouverture et de la clôture de la bougie HA PRÉCÉDENTE, ce qui fait qu'elle dépend de tout l'historique. AVERTISSEMENT À DONNER : les prix affichés NE SONT PAS les prix réels du marché. On ne place jamais un stop ni un objectif sur une valeur lue en Heikin Ashi ; on les lit sur le graphique en chandeliers classiques.
- Renko : briques d'amplitude fixe, sans axe de temps. Une nouvelle brique n'apparaît qu'au franchissement du seuil, donc une brique peut représenter une seconde ou une journée.
- Kagi, point & figure : même logique de filtrage du bruit, l'information temporelle est volontairement supprimée.
- CE QUE TOUS PARTAGENT : ils lissent le bruit au prix de la temporalité, ce qui rend les figures plus lisibles mais retarde les signaux. Le journal, lui, enregistre des heures réelles : ne confonds pas ce que le trader voit et ce que ses trades enregistrent.`,
  },

  risk: {
    markers: [
      "r multiple", "multiple de r", "esperance", "expectancy", "drawdown",
      "martingale", "kelly", "money management", "gestion du risque",
      "position sizing", "risque par trade",
    ],
    weak: [
      "risk reward",
    ],
    text: `VOCABULAIRE DE GESTION DU RISQUE, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles ; ce vocabulaire vaut pour toutes les méthodes.
- R : le risque engagé sur un trade, pris comme unité. Un gain de 2R rapporte deux fois ce qui était risqué. Raisonner en R rend les trades comparables entre eux quelle que soit la taille.
- Espérance = (taux de réussite × gain moyen) − (taux d'échec × perte moyenne). C'EST ELLE QUI DÉCIDE SI UNE MÉTHODE EST VIABLE, jamais le taux de réussite seul : 30 % de réussite à 5R bat 70 % à 0,5R.
- Drawdown : baisse depuis le plus haut du capital. Asymétrie à rappeler : une perte de 50 % exige un gain de 100 % pour revenir à l'équilibre.
- Martingale : doubler la taille après une perte. Sur un capital fini, la ruine est mathématiquement certaine. NE LA RECOMMANDE JAMAIS, même si le trader la demande : explique pourquoi et propose autre chose.
- Kelly : fraction théoriquement optimale du capital à engager. En pratique on emploie une fraction de Kelly, la formule pleine étant trop volatile.
- Risque fixe en pourcentage plutôt que lot fixe : la taille suit le capital, à la hausse comme à la baisse.`,
  },
};

/** Deux glossaires au maximum : au-delà, le préfixe coûte plus qu'il ne rapporte. */
export const MAX_GLOSSARIES = 2;

/** Toutes les écoles déclarées. Sert au test qui vérifie qu'aucune n'échappe
 *  au contrôle de collision quand on en ajoute une. */
export const ALL_METHOD_FAMILIES = Object.keys(GLOSSARIES) as MethodFamily[];

/** Minuscules, sans accent : la détection ne doit pas dépendre de la saisie. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    // Bloc « Combining Diacritical Marks » écrit en échappement : la classe de
    // caractères littérale est invisible à la relecture et se perd aux copies.
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Cherche un terme sur des frontières de mot, jamais en sous-chaîne.
 *
 * La comparaison naïve faisait matcher les sigles courts à l'intérieur de mots
 * ordinaires : « ema » dans « demande » classait un trader offre/demande dans
 * les indicateurs. Les sigles de trading sont justement courts, donc le défaut
 * touchait précisément les marqueurs les plus discriminants.
 */
function matchesWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Repère les écoles employées par le trader dans le texte de sa fiche.
 *
 * On ne détecte QUE sur sa fiche, jamais sur la conversation : le prompt
 * système est mis en cache, et le faire varier d'un message à l'autre
 * relancerait une écriture complète du préfixe à chaque tour.
 */
export function detectMethodFamilies(strategyText: string): MethodFamily[] {
  if (!strategyText.trim()) return [];
  const haystack = normalize(strategyText);

  const scored = (Object.entries(GLOSSARIES) as [MethodFamily, GlossaryEntry][])
    .map(([family, g]) => {
      const strong = g.markers.filter((m) => matchesWord(haystack, normalize(m))).length;
      const weak = (g.weak ?? []).filter((m) => matchesWord(haystack, normalize(m))).length;
      // Un terme propre à l'école suffit. Un mot courant, non : « je me base
      // sur la tendance » chargeait le glossaire offre/demande, « une vague de
      // volatilité » celui d'Elliott. Il en faut deux, ou un terme propre.
      const retenue = strong > 0 || weak >= 2;
      // Le classement pondère : deux écoles à égalité de termes, celle qui a
      // les plus spécifiques passe devant.
      return { family, hits: retenue ? strong * 2 + weak : 0 };
    })
    .filter((s) => s.hits > 0)
    // Le plus de termes reconnus d'abord ; à égalité, l'ordre de déclaration
    // tranche, ce qui garde le résultat stable donc le cache valide.
    .sort((a, b) => b.hits - a.hits);

  return scored.slice(0, MAX_GLOSSARIES).map((s) => s.family);
}

/** Assemble les glossaires des écoles détectées. "" si aucune. */
export function renderMethodGlossaries(families: MethodFamily[]): string {
  if (families.length === 0) return "";
  return families.map((f) => GLOSSARIES[f].text).join("\n\n");
}

/** Raccourci : de la fiche du trader au bloc prêt à insérer. */
export function glossariesForStrategy(strategyText: string): string {
  return renderMethodGlossaries(detectMethodFamilies(strategyText));
}
