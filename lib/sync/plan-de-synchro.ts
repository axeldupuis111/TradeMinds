/**
 * QUI A DROIT À LA SYNCHRONISATION AUTOMATIQUE, POUR LES DEUX RAILS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE RAIL PUSH VÉRIFIAIT LE PLAN À CHAQUE ENVOI, LE RAIL PULL NE LE
 * VÉRIFIAIT JAMAIS. Le produit a deux rails vers la même promesse (« tes trades
 * arrivent tout seuls », vendue premium et elle seule) :
 *
 *   - le PUSH (MetaTrader, cTrader, NinjaTrader, TradingView) authentifie par
 *     `mt_sync_token` et refuse `plan !== "premium"` à chaque payload ;
 *   - le PULL (Tradovate) ouvre une connexion, gardée premium à la CRÉATION,
 *     puis la rejoue toutes les heures par cron, sans plus jamais regarder le
 *     plan du propriétaire.
 *
 * ⚠️ RIEN NE FERME UNE CONNEXION QUAND L'ABONNEMENT S'ARRÊTE : aucune
 * désactivation dans le webhook Stripe, ni au changement de plan. Un compte
 * passé de Premium à gratuit gardait donc la synchronisation automatique, à vie
 * et sans le savoir. C'est la fonctionnalité la plus chère du produit, et la
 * seule raison de prendre Premium pour beaucoup.
 *
 * ⚠️ C'EST LA FORME HABITUELLE : une règle écrite, appliquée à une porte sur
 * deux. La porte gardée était celle qu'on voit (le bouton « connecter »), pas
 * celle qui travaille tous les jours en silence.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un seul prédicat, lu par les trois surfaces : le cron, la synchro à la
 * demande, et le rail push.
 */

export const PLAN_DE_SYNCHRO = "premium";

/**
 * La synchronisation automatique est-elle ouverte à ce plan ?
 *
 * ⚠️ Un plan inconnu ou absent est un refus : on ne synchronise pas « au
 * bénéfice du doute » une fonctionnalité qui se paie.
 */
export function synchroAutorisee(plan: string | null | undefined): boolean {
  return plan === PLAN_DE_SYNCHRO;
}
