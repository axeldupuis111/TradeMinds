import type { Instrument } from "./instruments";
import type { TradeSimule } from "./types";

/**
 * SORTIR LES TRADES POUR LES REGARDER AILLEURS.
 *
 * ⚠️ CE N'EST PAS UN CONFORT. La page demande au trader de reconnaître sa
 * méthode dans une douzaine d'aperçus dessinés ; sur six cents trades, douze ne
 * sont qu'un échantillon. Quelqu'un qui veut vraiment vérifier doit pouvoir
 * ouvrir la liste entière dans son tableur, la trier par heure, par sens, par
 * motif de sortie, et retrouver ses propres captures d'écran.
 *
 * ⚠️ DEUX PIÈGES DE TABLEUR, ET ILS FONT PASSER L'OUTIL POUR CASSÉ :
 *
 * 1. **LE POINT-VIRGULE, PAS LA VIRGULE.** Excel en français, en espagnol et en
 *    allemand attend `;` ; avec une virgule, tout le fichier atterrit dans une
 *    seule colonne et le trader croit l'export raté.
 * 2. **LE BOM UTF-8.** Sans lui, Excel lit le fichier en ANSI et « Réussite »
 *    devient « RÃ©ussite ». Trois octets qui évitent d'avoir l'air négligé.
 *
 * ⚠️ LES PRIX SORTENT EN POINTS, PAS EN TICKS. Le moteur raisonne en entiers,
 * personne d'autre. Un fichier plein de « 16414970 » serait illisible et
 * incomparable avec n'importe quelle plateforme.
 */

const SEPARATEUR = ";";
const BOM = "﻿";

/** Neutralise ce qui casserait une cellule, y compris une formule injectée. */
function cellule(v: string | number): string {
  const s = String(v);
  // ⚠️ Une cellule qui commence par `=`, `+`, `-` ou `@` est interprétée comme
  // une FORMULE par Excel, et un libellé traduit ne doit pas se transformer en
  // `#NOM?` chez le trader.
  //
  // ⚠️⚠️ MAIS UN NOMBRE NÉGATIF COMMENCE PAR UN MOINS. Un premier jet préfixait
  // « -1.0500 » d'une apostrophe : tous les trades perdants devenaient du TEXTE
  // dans le tableur, donc ni additionnables ni triables. Le remède était pire
  // que le mal qu'il traitait, et il frappait la moitié des lignes. On ne
  // protège donc que ce qui n'est pas un nombre.
  const estUnNombre = s.trim() !== "" && Number.isFinite(Number(s));
  const sur = !estUnNombre && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

export interface EnTetesCsv {
  date: string;
  sens: string;
  entree: string;
  sortie: string;
  stop: string;
  risque: string;
  r: string;
  rBrut: string;
  motif: string;
  collision: string;
}

export function tradesEnCsv(
  trades: TradeSimule[],
  instrument: Instrument,
  entetes: EnTetesCsv,
  /** Traduit un motif de sortie ; le nom technique brut ne dit rien au trader. */
  nomDuMotif: (motif: string) => string,
): string {
  const tick = instrument.tailleTick;
  const d = instrument.decimales;
  const prix = (ticks: number) => (ticks * tick).toFixed(d);

  const lignes: string[] = [
    [
      entetes.date,
      entetes.sens,
      entetes.entree,
      entetes.sortie,
      entetes.stop,
      entetes.risque,
      entetes.r,
      entetes.rBrut,
      entetes.motif,
      entetes.collision,
    ]
      .map(cellule)
      .join(SEPARATEUR),
  ];

  for (const t of trades) {
    const signe = t.sens === "long" ? 1 : -1;
    lignes.push(
      [
        new Date(t.entreeMs).toISOString(),
        t.sens,
        prix(t.entreeTicks),
        prix(t.sortieTicks),
        prix(t.entreeTicks - signe * t.risqueTicks),
        prix(t.risqueTicks),
        // ⚠️ `r` est NET de coûts, `rBrut` ne l'est pas. Les deux colonnes
        // existent pour que le trader puisse mesurer lui-même ce que
        // l'aller-retour lui prend, au lieu de nous croire sur parole.
        t.r.toFixed(4),
        t.rBrut.toFixed(4),
        nomDuMotif(t.motif),
        t.collisionMemeBarre ? "1" : "0",
      ]
        .map(cellule)
        .join(SEPARATEUR),
    );
  }

  return BOM + lignes.join("\r\n") + "\r\n";
}

/** Un nom de fichier qui se retrouve dans un dossier de téléchargements. */
export function nomDuFichier(instrument: string, de: string, a: string): string {
  return `backtest-${instrument}-${de}-${a}.csv`;
}
