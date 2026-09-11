/**
 * Les dates de l'onglet backtest.
 *
 * ⚠️ CE FICHIER N'EST PLUS QU'UN RENVOI. Le défaut qu'il corrigeait (une date
 * française sous une interface anglaise) existait dans tout le produit, et sa
 * moitié symétrique aussi : sept appels passaient « fr-FR » en dur. Les deux
 * fonctions sont donc remontées d'un cran, dans `lib/dates.ts`, avec leur
 * histoire. On garde le chemin, employé par une dizaine d'appels de l'onglet.
 */
export { enDate, enDateEtHeure } from "@/lib/dates";
