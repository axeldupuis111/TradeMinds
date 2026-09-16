/**
 * LA MONNAIE DES MAQUETTES DE LA PAGE D'ACCUEIL.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA PAGE ANGLAISE MONTRAIT UN PRODUIT EN EUROS. Les captures animées de
 * la landing (démo de synchro, carte P&L, comptes de prop firm, message du
 * coach) portaient toutes des euros, dans les quatre langues, et certaines les
 * écrivaient EN DUR dans le composant, donc à l'identique quelle que soit la
 * langue servie.
 *
 * ⚠️ CE N'EST PAS UN DÉTAIL DE STYLE. Mesuré en production le 2026-09-17 :
 * dix-sept des vingt et un inscrits lisent le site en anglais, et dix des seize
 * détenteurs de compte tiennent leur compte en DOLLARS. La première image que
 * ces gens ont du produit leur montrait donc des montants dans une monnaie qui
 * n'est pas la leur, sur la page qui doit leur donner envie d'essayer.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une maquette montre le produit tel qu'il s'affichera pour ce lecteur-là :
 * dans SA langue, et dans la monnaie que sa langue laisse attendre.
 *
 * ⚠️ ÇA NE CONCERNE QUE LES MAQUETTES. Le PRIX de l'abonnement reste en euros
 * dans toutes les langues, parce que Stripe débite des euros : c'est un fait,
 * pas une illustration. Voir `lib/prix.ts`, qui n'a rien à voir avec ce
 * fichier et ne doit jamais l'appeler.
 *
 * ⚠️ ET CE N'EST PAS UNE DÉTECTION DE PAYS. On ne sait rien du visiteur sinon
 * la langue qu'il a demandée. L'anglais n'est pas « les États-Unis » ; c'est
 * simplement la seule des quatre langues du produit dont les lecteurs, ici,
 * tiennent majoritairement un compte en dollars. Les trois autres restent en
 * euros parce que leurs lecteurs y sont.
 */

/** La monnaie à employer dans les illustrations, pour la langue servie. */
export function monnaieDeDemo(lang: string): string {
  return lang.slice(0, 2).toLowerCase() === "en" ? "USD" : "EUR";
}
