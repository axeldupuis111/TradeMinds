/**
 * LE PRIX D'UN INSTRUMENT, ÉCRIT COMME LA PLATEFORME L'ÉCRIT.
 *
 * ── POURQUOI CETTE FONCTION EXISTE ──────────────────────────────────────────
 *
 * ⚠️ ELLE EXISTAIT EN DEUX EXEMPLAIRES IDENTIQUES, l'un dans le tableau de
 * bord, l'autre dans le calendrier. Deux copies d'une même règle de rendu
 * dérivent au premier ajustement, et celle-ci porte un jugement discutable
 * (combien de décimales pour quel ordre de grandeur) : c'est exactement le
 * genre de règle qu'on ne veut pas voir répondre deux choses différentes sur
 * deux écrans du même produit.
 *
 * ⚠️⚠️ ET LE POINT DÉCIMAL EST VOULU, contrairement au reste du produit qui
 * suit la langue du lecteur : MetaTrader, TradingView et les relevés de broker
 * écrivent « 1.10500 » dans toutes les langues, et le trader recoupe ce chiffre
 * avec sa plateforme. Un « 1,10500 » l'obligerait à traduire mentalement à
 * chaque comparaison. Le garde `separateur-decimal` connaît cette exception par
 * le NOM de cette fonction.
 */
export function fmtPrice(p: number): string {
  if (p >= 10000) return p.toFixed(0);
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(5);
}
