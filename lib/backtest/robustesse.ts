import type { TradeSimule } from "./types";

/**
 * D'OÙ VIENT LE RÉSULTAT, ET CE QUI RESTE QUAND ON EN RETIRE UN MORCEAU.
 *
 * ── LA QUESTION QUE PERSONNE NE POSE ────────────────────────────────────────
 *
 * « +0,4 R par trade sur quatre ans » se lit comme une propriété de la méthode.
 * Ça peut aussi être quatre ans de rien, plus un mois de mars où tout est
 * arrivé. Les deux donnent le même chiffre, et ils ne décrivent pas du tout la
 * même chose : le premier se retrade, le second était une occasion.
 *
 * ⚠️ CE FICHIER NE JUGE PAS, IL DÉCOMPOSE. Il ne dit pas si une stratégie est
 * bonne, il dit où son résultat s'est fabriqué. C'est une addition, pas une
 * prévision, et c'est exactement pour ça qu'on peut s'y fier : rien ici ne
 * dépend d'un modèle, d'un tirage ou d'un choix de seuil discutable.
 *
 * ⚠️ AUCUN CLASSEMENT, AUCUN « MEILLEUR MOIS À GARDER ». Retirer le meilleur
 * mois sert à mesurer la dépendance à un accident, jamais à proposer de filtrer
 * les mois : filtrer sur ce qui a marché est la définition même du
 * sur-apprentissage.
 */

export interface Tranche {
  /** "2024" ou "2024-T3". */
  cle: string;
  trades: number;
  /** Somme des R nets sur la tranche. */
  totalR: number;
}

function cleAnnee(ms: number): string {
  return String(new Date(ms).getUTCFullYear());
}

function cleTrimestre(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-T${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function cleMois(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function decouper(trades: TradeSimule[], cle: (ms: number) => string): Tranche[] {
  const par = new Map<string, Tranche>();
  for (const t of trades) {
    // ⚠️ La date de SORTIE, pas celle du signal. Un trade se solde quand il se
    // ferme : le ranger sur son entrée mettrait un gain de janvier dans le mois
    // de décembre parce que la position a passé le réveillon.
    const k = cle(t.sortieMs);
    const tranche = par.get(k) ?? { cle: k, trades: 0, totalR: 0 };
    tranche.trades++;
    tranche.totalR += t.r;
    par.set(k, tranche);
  }
  return Array.from(par.values()).sort((a, b) => (a.cle < b.cle ? -1 : 1));
}

export interface Concentration {
  annees: Tranche[];
  trimestres: Tranche[];
  /** Somme des R sur tout l'échantillon. */
  totalR: number;
  /**
   * Part du total apportée par le SEUL meilleur mois, en pourcentage.
   *
   * ⚠️ Peut dépasser 100 % : quand le reste de la période perd, un unique mois
   * porte plus que le total. C'est précisément le cas qu'il faut voir, et
   * plafonner l'affichage à 100 le cacherait.
   */
  partDuMeilleurMois: number;
  /** Ce que devient le total si on retire ce mois-là. */
  totalSansLeMeilleurMoisR: number;
  /** Le meilleur mois, pour pouvoir le nommer. */
  meilleurMois: string | null;
  /** Nombre d'années où le total est positif. */
  anneesPositives: number;
  /**
   * L'avantage tient-il sans son meilleur mois ?
   *
   * ⚠️ Ce n'est PAS un verdict de rentabilité. Ça répond à une question et une
   * seule : « ce résultat vient-il d'une méthode ou d'un accident ». Un plan
   * qui perd partout et gagne un peu moins sans son meilleur mois répondra
   * « faux » sans que ça dise du bien de lui.
   */
  tientSansSonMeilleurMois: boolean;
}

/**
 * @param minTranches en dessous, la découpe ne veut rien dire. Deux trades dans
 * un trimestre ne mesurent pas ce trimestre.
 */
export const MIN_TRADES_TRANCHE = 20;

export function concentration(trades: TradeSimule[]): Concentration | null {
  // ⚠️ On ne décompose pas un échantillon trop petit. La page entière refuse de
  // conclure sous cent trades ; le faire ici par tranche serait pire, chaque
  // tranche étant plus petite que le tout.
  if (trades.length < MIN_TRADES_TRANCHE) return null;

  const annees = decouper(trades, cleAnnee);
  const trimestres = decouper(trades, cleTrimestre);
  const mois = decouper(trades, cleMois);
  const totalR = trades.reduce((s, t) => s + t.r, 0);

  let meilleur: Tranche | null = null;
  for (const m of mois) {
    if (!meilleur || m.totalR > meilleur.totalR) meilleur = m;
  }
  const gainDuMeilleur = meilleur ? meilleur.totalR : 0;
  const totalSansLeMeilleurMoisR = totalR - gainDuMeilleur;

  return {
    annees,
    trimestres,
    totalR,
    // Un total nul rendrait une division absurde : on rend 0 plutôt qu'un infini.
    partDuMeilleurMois: totalR === 0 ? 0 : (gainDuMeilleur / totalR) * 100,
    totalSansLeMeilleurMoisR,
    meilleurMois: meilleur?.cle ?? null,
    anneesPositives: annees.filter((a) => a.totalR > 0).length,
    tientSansSonMeilleurMois: totalR > 0 && totalSansLeMeilleurMoisR > 0,
  };
}
