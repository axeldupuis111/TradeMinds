import { calculatePips } from "@/lib/pips";
import { prixConnu } from "@/lib/prix-connu";

/**
 * LA DISTANCE ENTRE L'ENTRÉE ET LE STOP N'EST UN RISQUE QUE SI LE STOP EST DU
 * CÔTÉ DE LA PERTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN STOP SUIVI EST LU COMME UN RISQUE MINUSCULE. MetaTrader pousse le
 * stop COURANT au moment de la clôture : quand le trader l'a remonté au
 * point mort ou en profit, la colonne `sl` se retrouve du côté du GAIN. La
 * distance |entrée − sl| ne mesure alors plus rien, et le produit la lisait
 * quand même comme « le risque pris ».
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : 64 trades sur 447 (14 %), tous venus de
 * MT5, ont leur stop du côté du profit — 57 d'entre eux sont gagnants, ce qui
 * est la signature même du stop suivi. L'écart médian vaut 0,0093 % du prix,
 * soit moins d'un demi-point sur un indice à 4 000.
 *
 * ⚠️ CE QUE ÇA PRODUISAIT : `sl_too_wide` ne pouvait jamais se déclencher sur
 * ces trades, `low_rr` non plus (un reward divisé par un risque quasi nul rend
 * un RR astronomique), et la ligne envoyée au modèle d'analyse annonçait
 * « Risque: 4 pips | RR planifié: 1:250 ». Le détecteur de violations était
 * donc aveugle sur 14 % du journal, et toujours dans le sens qui flatte.
 *
 * ⚠️⚠️ ET LA COLONNE PRÉVUE POUR ÇA N'A JAMAIS ÉTÉ REMPLIE. Le code préfère
 * partout `sl_initial` à `sl`, avec le commentaire qui explique pourquoi :
 * `sl_initial` est renseigné sur ZÉRO ligne sur 447. Le rail de synchro
 * n'écrit que `sl`. La règle était écrite, la colonne existait, et le repli
 * `?? sl` servait toujours. C'est la forme habituelle des défauts de ce dépôt.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Quand le stop enregistré est du côté du gain, le risque réellement pris est
 * INCONNU, pas minuscule. On ne juge pas une règle sur un nombre qui ne veut
 * pas dire ce qu'il prétend : les contrôles qui en dépendent se taisent, et
 * l'analyse dit que le stop a été déplacé.
 */

export type SensDuTrade = string | null | undefined;

/** Un achat, quel que soit le mot employé par la plateforme d'origine. */
export function estUnAchat(direction: SensDuTrade): boolean {
  const d = (direction || "").toLowerCase();
  return d === "long" || d === "buy";
}

/**
 * Le stop protège-t-il encore ? (c'est-à-dire : est-il du côté de la perte ?)
 *
 * Un stop exactement au prix d'entrée est un point mort : il ne mesure aucun
 * risque non plus, donc il ne compte pas comme mesurable.
 */
export function stopDuCoteDeLaPerte(
  direction: SensDuTrade,
  entree: number | null | undefined,
  stop: number | null | undefined,
): boolean {
  const e = prixConnu(entree);
  const s = prixConnu(stop);
  if (e == null || s == null) return false;
  return estUnAchat(direction) ? s < e : s > e;
}

/**
 * Le stop a-t-il visiblement été déplacé après l'entrée ?
 *
 * ⚠️ C'est une PREUVE, pas une supposition : un stop du côté du gain ne peut
 * pas avoir été posé là au départ, aucune plateforme ne l'accepterait.
 */
export function stopVisiblementDeplace(
  direction: SensDuTrade,
  entree: number | null | undefined,
  stop: number | null | undefined,
): boolean {
  const e = prixConnu(entree);
  const s = prixConnu(stop);
  if (e == null || s == null) return false;
  return !stopDuCoteDeLaPerte(direction, e, s);
}

/**
 * Le risque en pips, ou `null` quand il n'est pas mesurable.
 *
 * `null` veut dire « on ne sait pas », et c'est une réponse : l'appelant doit
 * se taire plutôt que de juger. Il ne veut jamais dire « zéro ».
 */
export function risqueEnPips(
  paire: string,
  direction: SensDuTrade,
  entree: number | null | undefined,
  stop: number | null | undefined,
): number | null {
  if (!stopDuCoteDeLaPerte(direction, entree, stop)) return null;
  const pips = calculatePips(paire, prixConnu(entree) as number, prixConnu(stop) as number);
  return pips > 0 ? pips : null;
}
