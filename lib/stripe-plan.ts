import type Stripe from 'stripe'

export type PlanInfo = { plan: string; interval: 'monthly' | 'yearly' }

/** Mappe un price_id Stripe vers { plan, interval }, sur les tarifs COURANTS. */
export function getPlanFromPriceId(priceId: string): PlanInfo | null {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY) {
    return { plan: 'plus', interval: 'monthly' }
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY) {
    return { plan: 'plus', interval: 'yearly' }
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY) {
    return { plan: 'premium', interval: 'monthly' }
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY) {
    return { plan: 'premium', interval: 'yearly' }
  }
  return null
}

/**
 * Résout le palier d'un abonnement, même après une rotation de tarifs.
 *
 * getPlanFromPriceId ne connaît QUE les quatre prix courants (env vars). Or un
 * abonnement garde son objet price à vie : dès qu'un tarif est archivé et
 * remplacé (9,99 € → 14,99 €, commit 3864fe1 du 2026-07-20), tous les abonnés
 * existants deviennent illisibles, chaque handler du webhook sort en silence et
 * la route répond quand même 200. La base gèle pendant que Stripe continue de
 * facturer, et rien ne le signale (incident du 2026-07-27).
 *
 * Les metadata posées au checkout, elles, survivent aux changements de tarif :
 * c'est le repli. Elles ne remplacent pas le mapping par price (qui reste la
 * source de vérité pour un abonnement au tarif courant), elles le rattrapent.
 */
export function resolvePlanInfo(subscription: Stripe.Subscription): PlanInfo | null {
  const priceId = subscription.items?.data?.[0]?.price?.id
  const fromPrice = priceId ? getPlanFromPriceId(priceId) : null
  if (fromPrice) return fromPrice

  const metaPlan = subscription.metadata?.plan
  const metaInterval = subscription.metadata?.interval
  if (
    (metaPlan === 'plus' || metaPlan === 'premium') &&
    (metaInterval === 'monthly' || metaInterval === 'yearly')
  ) {
    console.warn(
      `[Webhook] Price ${priceId} inconnu sur ${subscription.id} (tarif archivé ?), ` +
        `repli sur les metadata : ${metaPlan}/${metaInterval}`
    )
    return { plan: metaPlan, interval: metaInterval }
  }

  console.error(
    `[Webhook] Plan irrésoluble pour ${subscription.id} : price ${priceId}, ` +
      `metadata ${JSON.stringify(subscription.metadata ?? {})}`
  )
  return null
}
