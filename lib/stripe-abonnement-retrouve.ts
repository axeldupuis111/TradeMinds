import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { resolvePlanInfo } from "@/lib/stripe-plan";

/**
 * RETROUVER L'ABONNEMENT D'UN CLIENT QUE NOTRE BASE A PERDU.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX COMPTES PAYANTS ONT UN CLIENT STRIPE ET AUCUNE LIGNE
 * `subscriptions`. Relevé le 2026-09-18 sur les 54 profils de production :
 * treize comptes payants, UNE seule ligne d'abonnement (annulée). Dix de ces
 * treize n'ont aucun client Stripe — leur accès a été ouvert à la main, c'est
 * normal. Mais deux en ont un : `cus_UXrXv7112n…` (inscrit le 2026-05-01) et
 * `cus_UXtrLSjFVr…` (inscrit le 2026-04-06), tous deux antérieurs à la
 * rotation de tarifs du 2026-07-20.
 *
 * ⚠️ C'EST LA SIGNATURE EXACTE DE L'INCIDENT DE JUILLET. Un abonnement garde
 * son objet `price` à vie ; dès qu'un tarif est archivé et remplacé, tous les
 * abonnés existants deviennent illisibles, chaque handler du webhook sort en
 * silence et la route répond quand même 200. `resolvePlanInfo` a été écrit pour
 * ça et rattrape les abonnements NOUVEAUX (metadata posées au checkout) ; il ne
 * pouvait rien pour les lignes jamais écrites.
 *
 * ⚠️ CE QUE ÇA COÛTE AUJOURD'HUI : ces deux clients ne peuvent PAS changer de
 * plan. `/api/stripe/change-plan` cherche la ligne, ne la trouve pas et répond
 * « aucun abonnement actif » — à des gens qui paient. Et si l'un d'eux cesse de
 * payer, rien ne l'écrira : `plan_expires_at` vaut `null` sur les 54 profils.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Quand notre base ne sait pas, on DEMANDE À STRIPE, qui est la source de
 * vérité, au lieu de refuser. Et on réécrit la ligne au passage, pour que la
 * question ne se repose pas.
 *
 * ⚠️ L'APPEL NE PART QUE SUR LE CHEMIN QUI ALLAIT ÉCHOUER : profil payant,
 * client Stripe connu, ligne absente. Aucun coût récurrent, aucun appel sur le
 * chemin normal.
 */

/** Ce que l'appelant a besoin de savoir, et rien de plus. */
export interface AbonnementRetrouve {
  stripe_subscription_id: string;
  /** Vrai quand la ligne manquait et vient d'être réécrite depuis Stripe. */
  reconstruit: boolean;
}

/** Les statuts qui valent « cet abonnement court encore ». */
const STATUTS_VIVANTS: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

/**
 * Un client de service pour réécrire la ligne perdue.
 *
 * ⚠️ POURQUOI PAS LE CLIENT DE L'UTILISATEUR : `subscriptions` est écrite par
 * le webhook avec la clé de service, et les politiques RLS ne donnent pas
 * l'écriture au porteur de la ligne. Réutiliser son client ferait échouer
 * l'écriture EN SILENCE (le client Supabase ne jette pas), c'est-à-dire
 * exactement la forme de panne qui a produit ce défaut.
 *
 * ⚠️ RETOURNE `null` PLUTÔT QUE DE JETER : la réparation est un bonus, elle ne
 * doit jamais empêcher le changement de plan qu'elle vient débloquer.
 */
function clientDeService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return createClient(url, cle, { auth: { persistSession: false } });
}

/**
 * L'abonnement Stripe vivant de ce client, ou `null` s'il n'en a aucun.
 *
 * ⚠️ `status: "all"` PUIS FILTRAGE, PAS `status: "active"` : un abonnement
 * `past_due` est un abonnement qu'il faut voir — c'est celui dont le paiement
 * vient d'échouer, donc celui dont le client va venir parler.
 */
async function chezStripe(customerId: string): Promise<Stripe.Subscription | null> {
  const liste = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  const vivants = liste.data.filter((s) => STATUTS_VIVANTS.includes(s.status));
  if (vivants.length === 0) return null;
  // Le plus récent d'abord : Stripe les rend déjà ainsi, on ne s'y fie pas.
  return vivants.sort((a, b) => b.created - a.created)[0];
}

/**
 * Réécrit la ligne `subscriptions` à partir de ce que Stripe vient de dire.
 *
 * ⚠️ L'ÉCRITURE EST VÉRIFIÉE. Le client Supabase NE JETTE PAS : un `upsert`
 * dont on ne lit pas l'erreur ment sur toute la ligne, et c'est la panne qui a
 * coûté seize annulations silencieuses au coach en août.
 */
async function reecrireLaLigne(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const admin = clientDeService();
  if (!admin) return false;

  const item = subscription.items.data[0];
  const infos = resolvePlanInfo(subscription);
  if (!item || !infos) return false;

  type AvecPeriode = Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const sub = subscription as AvecPeriode;
  const debut = sub.current_period_start ?? item.current_period_start;
  const fin = sub.current_period_end ?? item.current_period_end;
  if (!debut || !fin) return false;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripe_price_id: item.price.id,
      status: subscription.status,
      plan: infos.plan,
      interval: infos.interval,
      current_period_start: new Date(debut * 1000).toISOString(),
      current_period_end: new Date(fin * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    console.error("[Abonnement retrouvé] réécriture impossible:", error.message);
    return false;
  }
  console.info(
    `[Abonnement retrouvé] ligne subscriptions reconstruite pour ${userId} ` +
      `depuis ${subscription.id} (${subscription.status}/${infos.plan})`,
  );
  return true;
}

/**
 * L'abonnement du trader : d'abord notre base, puis Stripe si elle ne sait pas.
 *
 * @param ligneEnBase l'identifiant déjà trouvé en base, ou `null`
 * @param customerId le client Stripe du profil, ou `null` (accès offert)
 */
export async function retrouverLAbonnement(
  userId: string,
  ligneEnBase: string | null | undefined,
  customerId: string | null | undefined,
): Promise<AbonnementRetrouve | null> {
  if (ligneEnBase) return { stripe_subscription_id: ligneEnBase, reconstruit: false };
  /**
   * ⚠️ PAS DE CLIENT STRIPE = ACCÈS OUVERT À LA MAIN, pas une panne. Dix des
   * treize comptes payants sont dans ce cas. On ne va pas interroger Stripe
   * pour eux, et l'appelant leur dira de nous écrire plutôt que « introuvable ».
   */
  if (!customerId) return null;

  let abonnement: Stripe.Subscription | null = null;
  try {
    abonnement = await chezStripe(customerId);
  } catch (err) {
    // Stripe injoignable : on ne sait pas, on ne prétend pas savoir.
    console.error("[Abonnement retrouvé] Stripe injoignable:", err);
    return null;
  }
  if (!abonnement) return null;

  const reconstruit = await reecrireLaLigne(userId, abonnement);
  return { stripe_subscription_id: abonnement.id, reconstruit };
}
