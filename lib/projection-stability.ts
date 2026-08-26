/**
 * LA PROJECTION SUPPOSE QUE DEMAIN RESSEMBLE À HIER. ET SI C'ÉTAIT FAUX ?
 *
 * ── LE DÉFAUT QUE CE FICHIER RÉPARE, ET IL EST DANS L'ONGLET LUI-MÊME ───────
 *
 * Tout l'onglet repose sur une hypothèse énoncée en bas de page : « elle suppose
 * que tes prochains trades ressemblent aux précédents ». On l'écrivait comme une
 * limite qu'on ne pouvait pas vérifier. C'était faux : on peut la TESTER, au
 * moins grossièrement, en comparant la première moitié du journal à la seconde.
 *
 * Si les deux moitiés ne se ressemblent pas, l'hypothèse centrale de la
 * projection est fragile, et le trader doit le savoir AVANT de lire un risque de
 * ruine à deux chiffres. Un avertissement générique en bas de page qu'on aurait
 * pu remplacer par une mesure était de la paresse déguisée en prudence.
 *
 * ── ET ÇA RÉPOND À UNE VRAIE QUESTION : EST-CE QUE JE PROGRESSE ? ───────────
 *
 * Le même calcul, lu à l'endroit, dit au trader si ses résultats récents
 * diffèrent de ses anciens. C'est la question qu'il se pose vraiment, et
 * qu'aucune autre page du produit ne traite : un P&L cumulé monte ou descend
 * sans jamais dire si le trader d'aujourd'hui joue mieux que celui d'il y a
 * trois mois.
 *
 * ── ⚠️ CE QU'ON NE FAIT PAS ─────────────────────────────────────────────────
 *
 * On ne conclut PAS « tu progresses ». Deux moitiés d'un petit échantillon
 * diffèrent presque toujours par le seul effet du hasard, et couper un journal
 * en deux revient à faire une comparaison choisie après coup, comme pour les
 * segments. On exige donc que les intervalles de confiance des deux moitiés ne
 * se RECOUVRENT PAS avant de parler d'un changement, ce qui est un critère
 * exigeant et volontairement conservateur.
 */

import type { ProjectionTrade } from "./projection";

/** 1,96 écarts-types : le même intervalle à 95 % que partout ailleurs. */
const Z_95 = 1.96;

/**
 * Trades minimum dans CHAQUE moitié.
 *
 * ⚠️ Plus bas, la comparaison compare deux bruits. Le seuil est délibérément
 * moins strict que celui de la projection (100) parce qu'on ne rend pas ici un
 * verdict de rentabilité, seulement un signal de non-stationnarité, et parce que
 * le critère de non-recouvrement des intervalles fait déjà l'essentiel du tri.
 */
export const MIN_PAR_MOITIE = 30;

export interface Moitie {
  trades: number;
  esperance: number;
  basse: number;
  haute: number;
}

export interface Stabilite {
  /** `null` quand le journal est trop court pour couper en deux. */
  ancienne: Moitie | null;
  recente: Moitie | null;
  /**
   * Les deux moitiés diffèrent-elles au point que l'hypothèse de la projection
   * devienne douteuse ? Vrai uniquement si les intervalles ne se recouvrent pas.
   */
  aChange: boolean;
  /** Sens du changement quand il y en a un. */
  sens: "amelioration" | "degradation" | null;
}

function moitie(trades: ProjectionTrade[]): Moitie {
  const pnls = trades.map((t) => t.netPnl);
  const mu = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance =
    pnls.length < 2 ? 0 : pnls.reduce((s, v) => s + (v - mu) ** 2, 0) / (pnls.length - 1);
  const erreurType = pnls.length > 1 ? Math.sqrt(variance) / Math.sqrt(pnls.length) : 0;
  return {
    trades: pnls.length,
    esperance: mu,
    basse: mu - Z_95 * erreurType,
    haute: mu + Z_95 * erreurType,
  };
}

/**
 * Compare la première moitié du journal à la seconde.
 *
 * ⚠️ LA COUPE SE FAIT DANS L'ORDRE CHRONOLOGIQUE, évidemment, mais il faut le
 * dire : l'appelant reçoit souvent ses trades triés par identifiant. Une coupe
 * sur un ordre arbitraire comparerait deux échantillons aléatoires du même
 * journal, ce qui ne montrerait jamais rien et donnerait l'illusion d'une
 * stabilité rassurante.
 */
export function mesurerStabilite(trades: ProjectionTrade[]): Stabilite {
  const vide: Stabilite = { ancienne: null, recente: null, aChange: false, sens: null };
  if (trades.length < MIN_PAR_MOITIE * 2) return vide;

  const chronologiques = trades
    .slice()
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
  const milieu = Math.floor(chronologiques.length / 2);

  const ancienne = moitie(chronologiques.slice(0, milieu));
  const recente = moitie(chronologiques.slice(milieu));

  // ⚠️ NON-RECOUVREMENT DES INTERVALLES, PAS SIMPLE DIFFÉRENCE DES MOYENNES.
  // Deux moitiés d'un petit échantillon ont presque toujours des moyennes
  // différentes ; ça ne veut rien dire. Exiger que les fourchettes ne se
  // touchent pas est conservateur, et c'est le but : on ne signale un
  // changement que quand il saute aux yeux.
  const disjoints = recente.basse > ancienne.haute || recente.haute < ancienne.basse;

  return {
    ancienne,
    recente,
    aChange: disjoints,
    sens: disjoints ? (recente.esperance > ancienne.esperance ? "amelioration" : "degradation") : null,
  };
}
