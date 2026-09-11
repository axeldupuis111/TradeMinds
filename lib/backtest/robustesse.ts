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
  /**
   * `null` quand le total est négatif ou nul : il n'y a alors rien à répartir,
   * et un pourcentage donnerait à une absurdité l'air d'une mesure.
   */
  partDuMeilleurMois: number | null;
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
  /**
   * La forme de la répartition, en trois états.
   *
   * ⚠️⚠️ NÉ D'UNE CONTRADICTION VUE À L'ÉCRAN. Un booléen ne suffisait pas : un
   * mois apportait 58 % du total, le reste restait positif, et la page affichait
   * donc « ce résultat ne repose pas sur un seul accident » juste au-dessus de
   * « ton meilleur mois apporte 58 % du total ». Les deux phrases étaient vraies
   * et se contredisaient. Un résultat dont la moitié vient d'un mois n'est pas
   * « réparti », même si le reste ne perd pas.
   */
  forme: FormeDeLaRepartition;
}

export type FormeDeLaRepartition =
  /** Aucun mois ne domine : le résultat vient de partout. */
  | "reparti"
  /** Le reste tient debout, mais un seul mois pèse la moitié ou plus. */
  | "domine_par_un_mois"
  /** Sans son meilleur mois, il ne reste rien. */
  | "repose_sur_un_mois"
  /**
   * Le total est negatif : il n'y a aucun resultat a repartir.
   *
   * ⚠️ Ce n'est pas « mal reparti », c'est « la question ne se pose pas ». Un
   * pourcentage du total, quand le total perd, rend des phrases comme « ton
   * meilleur mois apporte -137 % du total » : exactes et illisibles.
   */
  | "rien_a_repartir";

/**
 * À partir de quelle part un seul mois « domine » le résultat.
 *
 * ⚠️ La moitié, et pas un seuil plus subtil : au-delà, il y a plus de résultat
 * dans un mois que dans tous les autres réunis, et aucune façon de présenter ça
 * comme une méthode régulière.
 */
export const PART_QUI_DOMINE = 50;

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

  const tient = totalR > 0 && totalSansLeMeilleurMoisR > 0;

  /**
   * ⚠️⚠️ UNE PART DE TOTAL NE VEUT RIEN DIRE QUAND LE TOTAL EST NÉGATIF.
   *
   * Vu à l'écran : « ton meilleur mois est 2025-10, il apporte -137 % du
   * total ». Arithmétiquement exact (un mois à +9,27 R divisé par un total de
   * -6,76 R) et parfaitement illisible : un pourcentage négatif, pour un mois
   * positif, d'un total qui perd. Et la phrase enchaînait sur « sans lui, il ne
   * reste rien », alors que sans lui c'est PIRE.
   *
   * La vérité est plus simple : quand le total est négatif, il n'y a aucun
   * résultat à répartir, donc la question « un seul mois le porte-t-il ? » ne
   * se pose pas. On rend `null` plutôt qu'un nombre qui aurait l'air d'une
   * mesure.
   */
  const part = totalR > 0 ? (gainDuMeilleur / totalR) * 100 : null;

  return {
    annees,
    trimestres,
    totalR,
    partDuMeilleurMois: part,
    totalSansLeMeilleurMoisR,
    meilleurMois: meilleur?.cle ?? null,
    anneesPositives: annees.filter((a) => a.totalR > 0).length,
    tientSansSonMeilleurMois: tient,
      forme:
      part == null
        ? "rien_a_repartir"
        : !tient
          ? "repose_sur_un_mois"
          : part >= PART_QUI_DOMINE
            ? "domine_par_un_mois"
            : "reparti",
  };
}
