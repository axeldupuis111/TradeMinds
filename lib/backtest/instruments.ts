/**
 * LES INSTRUMENTS BACKTESTABLES, ET CE QU'ILS COÛTENT VRAIMENT.
 *
 * Ce fichier est la source de vérité partagée entre le script d'import et
 * l'application. Un instrument absent d'ici n'est pas backtestable, et c'est
 * volontaire : chaque ligne engage une taille de tick et un coût par défaut, et
 * ces deux nombres décident du résultat plus sûrement que la stratégie testée.
 *
 * ⚠️ LA TAILLE DE TICK N'EST PAS DEVINABLE. Elle a été MESURÉE sur les données
 * réelles de chaque instrument (nombre de décimales publiées par la source).
 * L'or, par exemple, cote à trois décimales et pas deux. Se tromper la rend
 * soit trop grossière (on perd des touches de stop), soit trop fine (les prix
 * débordent de l'entier 32 bits et le backtest rend n'importe quoi).
 *
 * ⚠️ LES COÛTS SONT EN UNITÉS DE PRIX, PAS EN TICKS. Le moteur, lui, travaille
 * en ticks. La conversion se fait dans `coutsPourInstrument`, une seule fois. Un
 * spread écrit directement en ticks est un piège : « 20 » vaut 0,20 $ sur un
 * instrument à deux décimales et 0,02 $ sur le même à trois.
 *
 * ⚠️ CES COÛTS SONT DES ORDRES DE GRANDEUR DE COURTIER AU DÉTAIL, pas une
 * promesse. Ils sont éditables dans l'interface, et le vrai chiffre du trader
 * est dans son journal. Ils ne sont là que pour qu'aucun backtest ne démarre
 * jamais à zéro.
 */

import type { Couts } from "./types";

export type CategorieInstrument = "devises" | "metaux" | "indices" | "energie" | "crypto";

export interface Instrument {
  /** Identifiant interne et nom du dossier de stockage. */
  code: string;
  /** Nom affiché au trader. */
  nom: string;
  /** Identifiant chez la source de données. */
  source: string;
  categorie: CategorieInstrument;
  /** Mesurée sur les données réelles. Voir l'avertissement ci-dessus. */
  tailleTick: number;
  /** Écart achat-vente typique, en unités de prix. */
  spread: number;
  /** Glissement typique sur ordre au marché, en unités de prix. */
  glissement: number;
  /** Commission de l'aller-retour, en unités de prix. */
  commission: number;
  /** Nombre de décimales à afficher. */
  decimales: number;
  /**
   * L'ORDRE DE GRANDEUR DU PRIX, ET RIEN DE PLUS.
   *
   * ⚠️⚠️ LA COMPILATION DEMANDAIT AU MODÈLE UNE FRACTION D'UN NOMBRE QU'ELLE NE
   * LUI DONNAIT PAS. La règle du prompt dit qu'une tolérance de trendline vaut
   * environ un millième du prix ; l'écran ne lui envoyait que le spread. Vu à
   * l'écran, sur l'or : « une tolérance de 0,5 point (un millième du prix
   * approximativement sur l'or) » — c'est cinq fois trop petit, et la
   * justification affirmait le contraire.
   *
   * ⚠️ CE N'EST PAS UNE COTATION : elle dérive, et c'est sans importance. Ce
   * chiffre ne sert qu'à donner une échelle à une distance tracée à la main ;
   * se tromper de 30 % ne change rien à cette précision-là, se tromper d'un
   * facteur mille change tout.
   */
  prixIndicatif: number;
}

export const INSTRUMENTS: Instrument[] = [
  // ── Devises majeures ────────────────────────────────────────────────────
  { code: "EURUSD", nom: "EUR/USD", source: "eurusd", categorie: "devises", tailleTick: 0.00001, spread: 0.00012, glissement: 0.00002, commission: 0, decimales: 5, prixIndicatif: 1.1 },
  { code: "GBPUSD", nom: "GBP/USD", source: "gbpusd", categorie: "devises", tailleTick: 0.00001, spread: 0.00016, glissement: 0.00003, commission: 0, decimales: 5, prixIndicatif: 1.3 },
  { code: "USDJPY", nom: "USD/JPY", source: "usdjpy", categorie: "devises", tailleTick: 0.001, spread: 0.013, glissement: 0.003, commission: 0, decimales: 3, prixIndicatif: 150 },
  { code: "AUDUSD", nom: "AUD/USD", source: "audusd", categorie: "devises", tailleTick: 0.00001, spread: 0.00016, glissement: 0.00003, commission: 0, decimales: 5, prixIndicatif: 0.65 },
  { code: "USDCAD", nom: "USD/CAD", source: "usdcad", categorie: "devises", tailleTick: 0.00001, spread: 0.00020, glissement: 0.00004, commission: 0, decimales: 5, prixIndicatif: 1.35 },
  { code: "USDCHF", nom: "USD/CHF", source: "usdchf", categorie: "devises", tailleTick: 0.00001, spread: 0.00018, glissement: 0.00004, commission: 0, decimales: 5, prixIndicatif: 0.9 },
  { code: "NZDUSD", nom: "NZD/USD", source: "nzdusd", categorie: "devises", tailleTick: 0.00001, spread: 0.00022, glissement: 0.00004, commission: 0, decimales: 5, prixIndicatif: 0.6 },
  { code: "EURJPY", nom: "EUR/JPY", source: "eurjpy", categorie: "devises", tailleTick: 0.001, spread: 0.019, glissement: 0.004, commission: 0, decimales: 3, prixIndicatif: 165 },
  { code: "GBPJPY", nom: "GBP/JPY", source: "gbpjpy", categorie: "devises", tailleTick: 0.001, spread: 0.029, glissement: 0.006, commission: 0, decimales: 3, prixIndicatif: 195 },
  { code: "EURGBP", nom: "EUR/GBP", source: "eurgbp", categorie: "devises", tailleTick: 0.00001, spread: 0.00019, glissement: 0.00004, commission: 0, decimales: 5, prixIndicatif: 0.85 },

  // ── Métaux ──────────────────────────────────────────────────────────────
  { code: "XAUUSD", nom: "Or (XAU/USD)", source: "xauusd", categorie: "metaux", tailleTick: 0.001, spread: 0.25, glissement: 0.05, commission: 0.07, decimales: 3, prixIndicatif: 2600 },
  { code: "XAGUSD", nom: "Argent (XAG/USD)", source: "xagusd", categorie: "metaux", tailleTick: 0.001, spread: 0.025, glissement: 0.005, commission: 0.005, decimales: 3, prixIndicatif: 30 },

  // ── Indices ─────────────────────────────────────────────────────────────
  { code: "NAS100", nom: "Nasdaq 100", source: "usatechidxusd", categorie: "indices", tailleTick: 0.001, spread: 1.5, glissement: 0.4, commission: 0, decimales: 2, prixIndicatif: 20000 },
  { code: "SPX500", nom: "S&P 500", source: "usa500idxusd", categorie: "indices", tailleTick: 0.001, spread: 0.5, glissement: 0.12, commission: 0, decimales: 2, prixIndicatif: 6000 },
  { code: "US30", nom: "Dow Jones 30", source: "usa30idxusd", categorie: "indices", tailleTick: 0.001, spread: 2.5, glissement: 0.6, commission: 0, decimales: 2, prixIndicatif: 44000 },
  { code: "GER40", nom: "DAX 40", source: "deuidxeur", categorie: "indices", tailleTick: 0.001, spread: 1.2, glissement: 0.3, commission: 0, decimales: 2, prixIndicatif: 20000 },

  // ── Énergie ─────────────────────────────────────────────────────────────
  { code: "USOIL", nom: "Pétrole WTI", source: "lightcmdusd", categorie: "energie", tailleTick: 0.001, spread: 0.03, glissement: 0.008, commission: 0, decimales: 3, prixIndicatif: 70 },

  // ── Crypto ──────────────────────────────────────────────────────────────
  { code: "BTCUSD", nom: "Bitcoin", source: "btcusd", categorie: "crypto", tailleTick: 0.1, spread: 25, glissement: 6, commission: 0, decimales: 1, prixIndicatif: 90000 },
  { code: "ETHUSD", nom: "Ethereum", source: "ethusd", categorie: "crypto", tailleTick: 0.1, spread: 1.5, glissement: 0.4, commission: 0, decimales: 1, prixIndicatif: 3000 },
];

const PAR_CODE = new Map(INSTRUMENTS.map((i) => [i.code, i]));

export function instrumentParCode(code: string): Instrument | undefined {
  return PAR_CODE.get(code.toUpperCase());
}

/**
 * Convertit les coûts d'un instrument en ticks, l'unité du moteur.
 *
 * ⚠️ Un arrondi à zéro serait un backtest à coûts nuls qui ne dit pas son nom :
 * on plancher à un tick sur le spread et le glissement.
 */
export function coutsPourInstrument(inst: Instrument): Couts {
  const enTicks = (prix: number) => Math.round(prix / inst.tailleTick);
  return {
    spreadTicks: Math.max(1, enTicks(inst.spread)),
    glissementTicks: Math.max(1, enTicks(inst.glissement)),
    commissionTicks: enTicks(inst.commission),
  };
}

/**
 * Le trader connaît ses coûts en unités de prix, pas en ticks. Sert à
 * réafficher et à éditer ce que `coutsPourInstrument` a converti.
 */
export function coutsEnPrix(inst: Instrument, couts: Couts) {
  return {
    spread: couts.spreadTicks * inst.tailleTick,
    glissement: couts.glissementTicks * inst.tailleTick,
    commission: couts.commissionTicks * inst.tailleTick,
    /** Ce que coûte un aller-retour complet, en unités de prix. */
    allerRetour:
      (couts.spreadTicks + 2 * couts.glissementTicks + couts.commissionTicks) * inst.tailleTick,
  };
}

/** Devise dans laquelle un R est exprimé quand on affiche des montants. */
export function categoriesOrdonnees(): CategorieInstrument[] {
  return ["devises", "metaux", "indices", "energie", "crypto"];
}
