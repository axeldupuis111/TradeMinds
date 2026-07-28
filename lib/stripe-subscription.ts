import type Stripe from 'stripe'

// Stripe expose l'annulation sous deux conventions selon la version d'API.
// En 2026-04-22.dahlia, une annulation demandée depuis le portail ne pose plus
// `cancel_at_period_end=true` : elle pose `cancel_at` + `cancellation_details.reason`.
// On lit les deux, sinon un abonnement en cours d'annulation passe pour un
// abonnement normal.
type SubscriptionWithCancellation = Stripe.Subscription & {
  cancel_at?: number | null
  cancellation_details?: {
    reason?: string | null
    feedback?: string | null
    comment?: string | null
  } | null
}

/**
 * Annulation demandée via la convention récente (`cancel_at` + motif explicite).
 * Sert aussi à dater la demande quand `canceled_at` n'est pas renseigné.
 */
export function isCancellationRequested(subscription: Stripe.Subscription): boolean {
  const sub = subscription as SubscriptionWithCancellation
  return (
    sub.cancel_at !== null &&
    sub.cancel_at !== undefined &&
    sub.cancellation_details?.reason === 'cancellation_requested'
  )
}

/**
 * L'abonnement est vivant mais programmé pour s'arrêter en fin de période.
 *
 * À tester AVANT toute opération qui prolonge la facturation (changement de
 * plan, planification) : un `subscriptionSchedule` créé sur un abonnement dans
 * cet état écrase l'annulation et le client continue d'être prélevé.
 */
export function hasPendingCancellation(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || isCancellationRequested(subscription)
}
