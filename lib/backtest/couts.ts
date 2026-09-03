import type { Couts } from "./types";

/**
 * CE QUE COÛTE UN ALLER-RETOUR, À UN SEUL ENDROIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR LE MÊME ÉCRAN. Le même aller-retour valait « 3,9 % du
 * risque » dans une carte et « 2,4 % du risque » trois cartes plus bas. La
 * formule était recopiée à trois endroits, et la troisième copie doublait le
 * spread. Un trader qui lit deux chiffres contradictoires ne sait pas lequel
 * croire, et il a raison : l'un des deux était faux.
 *
 * ── LA CONVENTION, ET ELLE N'EST PAS INTUITIVE ──────────────────────────────
 *
 * Le spread est compté UNE FOIS, le glissement DEUX.
 *
 * Ce n'est pas une approximation. Le moteur fait entrer au prix brut décalé du
 * spread complet (on achète à l'offre, on revend à la demande) : la totalité de
 * l'écart est donc déjà payée à l'entrée, et la sortie ne la repaie pas. Le
 * glissement, lui, frappe deux fois, parce qu'il y a deux ordres au marché.
 *
 * ⚠️ DOUBLER LE SPREAD SEMBLE PRUDENT ET NE L'EST PAS. Ça surestime le coût de
 * 65 % sur le Nasdaq, ce qui fait basculer une ligne de diagnostic de « ça
 * pèse » à « hors d'atteinte » sur un chiffre faux. Un garde-fou qui se
 * déclenche à tort finit par être ignoré, y compris quand il a raison.
 */
export function coutAllerRetourTicks(c: Couts): number {
  return c.spreadTicks + 2 * c.glissementTicks + c.commissionTicks;
}
