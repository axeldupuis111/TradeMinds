/**
 * CE QUE CET ÉTAT T'A COÛTÉ, À TOI.
 *
 * ── LE DÉFAUT QUE CE FICHIER RÉPARE ─────────────────────────────────────────
 *
 * La page Session affiche un avertissement quand le trader coche un état
 * « risqué ». La liste des états risqués est CODÉE EN DUR : anxieux, frustré,
 * FOMO, revenge. C'est une norme extérieure, exactement ce que le reste du
 * produit refuse de faire depuis qu'on mesure le respect des règles ÉCRITES par
 * le trader plutôt que de règles qu'on lui imposerait.
 *
 * Deux problèmes concrets, pas seulement de principe :
 *
 *  1. **Elle peut être fausse pour lui.** Certains traders exécutent très bien
 *     sous tension et se relâchent quand tout va bien. Leur afficher « attention,
 *     état risqué » quand ils sont frustrés, alors que leurs chiffres disent
 *     l'inverse, décrédibilise l'avertissement ET tout le reste.
 *  2. **Elle rate ce qui le concerne.** L'excès de confiance ne figure pas dans
 *     la liste des états risqués, et c'est pourtant un des plus coûteux. Un
 *     trader qui perd systématiquement quand il se sent « confiant » ne verra
 *     jamais rien.
 *
 * On remplace donc l'hypothèse par SA mesure : sur ses trades passés dans cet
 * état, combien a-t-il gagné ou perdu. Un chiffre qu'il peut vérifier, au moment
 * exact où il décide d'ouvrir sa séance.
 *
 * ⚠️ ET QUAND ON N'A PAS ASSEZ DE DONNÉES, ON NE DIT RIEN DE PERSONNEL. On
 * retombe alors sur l'avertissement générique, qui redevient ce qu'il aurait
 * toujours dû être : un défaut faute de mieux, pas une vérité.
 */

/** Un trade clôturé, réduit à ce que la mesure demande. */
export interface TradeEmotion {
  emotion: string | null;
  netPnl: number;
}

export interface CoutEtat {
  /** L'état mesuré, tel qu'enregistré sur les trades. */
  emotion: string;
  trades: number;
  /** P&L net cumulé dans cet état. Négatif = il lui coûte de l'argent. */
  netPnl: number;
  /** P&L net moyen par trade dans cet état. */
  esperance: number;
  /**
   * L'écart avec ce qu'il fait dans TOUS LES AUTRES états.
   *
   * ⚠️ C'est ce chiffre qui porte l'information, pas l'espérance brute. Un
   * trader globalement perdant perd aussi quand il est calme : lui dire « tu
   * perds 80 € par trade quand tu es frustré » ne lui apprend rien s'il en perd
   * 75 le reste du temps. L'écart, lui, isole ce que l'ÉTAT change.
   */
  ecartAvecLeReste: number;
}

/**
 * ⚠️ EN DESSOUS, ON NE DIT RIEN DE PERSONNEL.
 *
 * Même seuil que l'analyse de segments, et pour la même raison : sous vingt
 * trades, un écart est une fluctuation d'échantillonnage, quelle que soit son
 * ampleur. Le baisser remplirait l'écran d'avertissements spectaculaires et
 * faux, juste avant que le trader ouvre une position.
 */
export const MIN_TRADES_ETAT = 20;

/**
 * Ce que cet état a coûté au trader, comparé à tous les autres.
 *
 * Rend `null` quand l'échantillon est trop mince : l'appelant retombe alors sur
 * son message générique plutôt que d'inventer un chiffre.
 */
export function coutDeLEtat(trades: TradeEmotion[], emotion: string): CoutEtat | null {
  if (!emotion) return null;

  const dedans = trades.filter((t) => t.emotion === emotion);
  if (dedans.length < MIN_TRADES_ETAT) return null;

  // ⚠️ Le reste, c'est tout ce qui porte un AUTRE état renseigné. Les trades
  // sans état ne comptent pas : on ne sait pas dans quel état ils ont été pris,
  // et les verser dans « le reste » ferait porter à cette moyenne des trades qui
  // étaient peut-être dans le même état que celui qu'on mesure.
  const dehors = trades.filter((t) => t.emotion && t.emotion !== emotion);

  const somme = (xs: TradeEmotion[]) => xs.reduce((s, t) => s + t.netPnl, 0);
  const esperance = somme(dedans) / dedans.length;
  const esperanceDehors = dehors.length > 0 ? somme(dehors) / dehors.length : 0;

  return {
    emotion,
    trades: dedans.length,
    netPnl: somme(dedans),
    esperance,
    ecartAvecLeReste: esperance - esperanceDehors,
  };
}

/**
 * Faut-il alerter le trader sur cet état ?
 *
 * ⚠️ ON N'ALERTE QUE SI SES CHIFFRES LE DISENT, et pas parce qu'une liste
 * décrète que « frustré » est risqué. Deux conditions cumulées : l'état lui
 * coûte de l'argent en valeur absolue, ET il lui en coûte plus que le reste de
 * son activité. La seconde évite de sonner l'alarme chez un trader globalement
 * perdant à qui l'état n'ajoute rien.
 */
export function etatAAlerter(cout: CoutEtat | null): boolean {
  if (!cout) return false;
  return cout.esperance < 0 && cout.ecartAvecLeReste < 0;
}

/**
 * L'inverse, et il compte autant : cet état lui RÉUSSIT-il ?
 *
 * ⚠️ Sert à taire l'avertissement générique quand il est démenti par les faits.
 * Afficher « attention, état risqué » à quelqu'un qui gagne dans cet état est
 * la façon la plus rapide de lui apprendre à ignorer nos avertissements, y
 * compris ceux qui comptent.
 */
export function etatFavorable(cout: CoutEtat | null): boolean {
  if (!cout) return false;
  return cout.esperance > 0 && cout.ecartAvecLeReste > 0;
}
