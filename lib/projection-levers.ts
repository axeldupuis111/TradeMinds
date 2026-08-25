/**
 * LE SEUL LEVIER QUE LE TRADER CONTRÔLE VRAIMENT : SA TAILLE DE POSITION.
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────
 *
 * L'onglet dit au trader que son risque de ruine est de 48 %, et la carte de
 * cohérence lui dit souvent que sa taille de position est démesurée par rapport
 * à la volatilité de sa méthode. Les deux sont vrais, et aucun des deux ne lui
 * montre CE QUE ÇA CHANGERAIT.
 *
 * Or c'est le seul paramètre qu'il peut modifier demain matin sans rien changer
 * d'autre : ni sa méthode, ni ses horaires, ni sa psychologie. Diviser sa taille
 * par deux est une décision qu'il prend seul, en une seconde.
 *
 * ── ⚠️ ET SURTOUT : ÇA COUPE DANS LES DEUX SENS ─────────────────────────────
 *
 * Réduire la taille divise les pertes ET les gains. L'espérance par trade baisse
 * dans la même proportion que le risque de ruine. Un outil qui n'afficherait que
 * la chute du risque de ruine vendrait une solution miracle, alors qu'il s'agit
 * d'un ARBITRAGE : moins de ruine contre moins de gain.
 *
 * On rend donc TOUJOURS les deux colonnes ensemble, exactement comme l'espérance
 * ne s'affiche jamais sans son intervalle. Le prompt du coach énonce déjà cette
 * règle pour lui (« dis l'arbitrage, jamais une performance promise ») ; ce
 * fichier l'applique aux chiffres.
 *
 * ── CE QUE LA MÉTHODE SUPPOSE ───────────────────────────────────────────────
 *
 * Que le trader aurait pris LES MÊMES trades avec une taille différente, et que
 * gains comme pertes évoluent proportionnellement à cette taille. C'est vrai
 * quand seul le nombre de lots change, à distance de stop et objectif
 * inchangés. Ça devient faux s'il change aussi sa méthode, ou si une taille plus
 * petite modifie son comportement, ce qui arrive plus souvent qu'on ne le croit.
 * L'interface doit le dire.
 */

import { MIN_TRADES, projeter, type ProjectionOptions, type ProjectionTrade } from "./projection";

export interface Palier {
  /** Facteur appliqué à la taille de position. 1 = sa taille actuelle. */
  facteur: number;
  /** Part des chemins qui touchent le seuil de ruine, 0..1. */
  risqueDeRuine: number;
  /** Espérance par trade à cette taille, en devise du compte. */
  esperance: number;
  /** Résultat médian à l'horizon, en devise du compte. */
  median: number;
  /** Part des chemins qui finissent au-dessus de zéro, 0..1. */
  partGagnante: number;
}

/**
 * Les tailles proposées, en fractions de la taille actuelle.
 *
 * ⚠️ ON NE PROPOSE PAS D'AUGMENTER. Techniquement le calcul marcherait, et
 * afficher « ×2 » à côté d'un risque de ruine qui monte serait informatif. Mais
 * un onglet qui suggère d'augmenter la taille à quelqu'un dont l'espérance est
 * positive suggère de prendre plus de risque, et ce n'est pas notre métier. On
 * montre uniquement ce que la prudence donnerait.
 */
const FACTEURS = [1, 0.5, 0.33, 0.2] as const;

/**
 * Rejoue la projection à plusieurs tailles de position.
 *
 * ⚠️ MULTIPLIER LES P&L EST EXACTEMENT ÉQUIVALENT à changer le nombre de lots,
 * et rien d'autre : la distance de stop, l'objectif et la séquence des trades
 * restent identiques. C'est ce qui rend le calcul honnête, et c'est aussi ce qui
 * en borne la portée.
 */
export function paliersDeTaille(
  trades: ProjectionTrade[],
  options: ProjectionOptions,
): Palier[] {
  if (trades.length < MIN_TRADES) return [];

  return FACTEURS.map((facteur) => {
    const mis = facteur === 1
      ? trades
      : trades.map((t) => ({ open_time: t.open_time, netPnl: t.netPnl * facteur }));
    const p = projeter(mis, options);
    return {
      facteur,
      risqueDeRuine: p.risqueDeRuine,
      esperance: p.esperance,
      median: p.median,
      partGagnante: p.partGagnante,
    };
  });
}

/**
 * La taille la plus grande dont le risque de ruine tombe sous un seuil.
 *
 * Rend `null` quand aucune ne descend assez bas : dans ce cas, réduire la taille
 * n'est pas le levier, et le dire vaut mieux que proposer le moins pire des
 * paliers comme s'il réglait le problème.
 *
 * ⚠️ Ce n'est PAS une recommandation de taille. C'est la réponse à une question
 * arithmétique que le trader se pose : « jusqu'où faut-il descendre pour que ce
 * chiffre-là devienne acceptable ». Le seuil d'acceptabilité, lui, n'appartient
 * qu'à lui, et l'interface le lui présente comme tel.
 */
export function palierSousLeSeuil(paliers: Palier[], seuilRuine: number): Palier | null {
  const eligibles = paliers.filter((p) => p.risqueDeRuine <= seuilRuine);
  if (eligibles.length === 0) return null;
  return eligibles.reduce((meilleur, p) => (p.facteur > meilleur.facteur ? p : meilleur));
}
