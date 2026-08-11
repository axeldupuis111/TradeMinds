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

export type MethodFamily = "ict" | "supply_demand" | "price_action" | "indicators" | "wyckoff";

interface Glossary {
  /** Termes déclencheurs, en minuscules et sans accent. */
  markers: string[];
  text: string;
}

/**
 * Ordre = priorité de détection. ICT en premier : c'est l'école dont le
 * vocabulaire est le plus spécifique, donc la moins susceptible d'être
 * détectée par erreur.
 */
const GLOSSARIES: Record<MethodFamily, Glossary> = {
  ict: {
    markers: [
      "ict", "smc", "smart money", "fvg", "fair value gap", "order block",
      "killzone", "kill zone", "bsl", "ssl", "liquidity", "liquidite",
      "breaker", "bos", "choch", "mss", "displacement", "deplacement",
      "imbalance", "judas", "silver bullet", "po3",
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
- MSS ou CHoCH (Market Structure Shift, Change of Character) : cassure d'un point de structure CONTRE la tendance précédente. C'est ce qui confirme un retournement après un balayage.`,
  },

  supply_demand: {
    markers: [
      "supply", "demand", "offre et demande", "zone d'offre", "zone de demande",
      "drop base rally", "rally base drop", "dbr", "rbd", "zone fraiche",
      "base", "desequilibre",
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
      "price action", "support", "resistance", "pin bar", "engulfing", "avalement",
      "chandelier", "bougie", "pullback", "breakout", "cassure", "retest",
      "double top", "double bottom", "epaule tete epaule", "triangle", "biseau",
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
      "rsi", "macd", "fibonacci", "fibo", "retracement", "stochastique",
      "bollinger", "moyenne mobile", "ema", "sma", "mm50", "mm200", "atr",
      "divergence", "surachat", "survente", "ichimoku",
    ],
    text: `VOCABULAIRE DES INDICATEURS, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles, et rappelle les pièges quand ils s'appliquent.
- RSI : oscillateur borné 0-100, 14 périodes par défaut. Au-dessus de 70 on parle de surachat, sous 30 de survente. PIÈGE MAJEUR : en tendance forte le RSI reste en zone extrême très longtemps ; ce n'est PAS un signal de retournement à lui seul.
- Divergence : le prix fait un nouvel extrême que l'indicateur ne confirme pas. Haussière quand le prix fait un creux plus bas et l'indicateur un creux plus haut, baissière à l'inverse.
- MACD : écart entre deux moyennes exponentielles (12 et 26), accompagné d'une ligne de signal (9). L'histogramme est l'écart entre la ligne MACD et sa ligne de signal, pas un troisième indicateur.
- Fibonacci : retracements à 23,6 / 38,2 / 50 / 61,8 / 78,6 % d'une impulsion, extensions à 127,2 / 161,8 % pour les objectifs. Le 61,8 % est le plus suivi. À SAVOIR : le 50 % n'est pas un ratio de Fibonacci, il est conservé par usage.
- Moyennes mobiles : simple (SMA) ou exponentielle (EMA), cette dernière réagissant plus vite. Croisement doré = la 50 passe au-dessus de la 200 ; croisement de la mort = l'inverse. Toutes sont retardées par construction.
- Bandes de Bollinger : moyenne 20 périodes encadrée de deux écarts-types. Le resserrement signale une compression de volatilité, souvent avant expansion. Toucher une bande n'est pas un signal en soi.
- ATR : amplitude moyenne sur N périodes. Sert à dimensionner un stop ou un objectif selon la volatilité, pas à donner une direction.`,
  },

  wyckoff: {
    markers: [
      "wyckoff", "accumulation", "distribution", "spring", "upthrust", "utad",
      "volume profile", "profil de volume", "poc", "vah", "val", "order flow",
      "delta", "absorption", "footprint", "vwap",
    ],
    text: `VOCABULAIRE WYCKOFF ET VOLUME, DÉFINITIONS DE RÉFÉRENCE. Emploie-les telles quelles.
- Accumulation : phase de range qui suit une baisse, pendant laquelle l'offre est absorbée par des acheteurs patients. Distribution : la symétrique après une hausse.
- Spring : brève cassure SOUS le bas d'un range d'accumulation, immédiatement suivie d'un retour dans le range. C'est un piège à vendeurs, la lecture est HAUSSIÈRE.
- Upthrust (et UTAD) : brève cassure AU-DESSUS du haut d'un range de distribution, suivie d'un retour dedans. Piège à acheteurs, lecture BAISSIÈRE. Ne confonds jamais les deux : spring en bas et haussier, upthrust en haut et baissier.
- Repères de phase : SC (selling climax), AR (automatic rally), ST (secondary test), LPS (last point of support) en accumulation ; BC, AD, UT en distribution.
- POC (point of control) : le prix auquel le plus de volume s'est échangé sur la période observée. Il agit souvent comme aimant.
- VAH et VAL : bornes haute et basse de la zone contenant environ 70 % du volume de la période. En dehors, le marché est en déséquilibre.
- VWAP : prix moyen pondéré par les volumes depuis un point d'ancrage. Sert de référence de valeur, surtout en intraday.
- Delta : différence entre volume exécuté à l'achat et à la vente. Absorption : un volume important qui ne fait PAS bouger le prix, signe qu'un participant absorbe les ordres en face.`,
  },
};

/** Deux glossaires au maximum : au-delà, le préfixe coûte plus qu'il ne rapporte. */
export const MAX_GLOSSARIES = 2;

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

  const scored = (Object.entries(GLOSSARIES) as [MethodFamily, Glossary][])
    .map(([family, g]) => {
      const hits = g.markers.filter((m) => matchesWord(haystack, normalize(m))).length;
      return { family, hits };
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
