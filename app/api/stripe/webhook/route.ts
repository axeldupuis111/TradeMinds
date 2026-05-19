import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// IMPORTANT: Next.js doit recevoir le body brut pour la vérification de signature Stripe.
// Cette config désactive le parsing automatique.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Supabase client avec service_role (bypass RLS pour les writes sur subscriptions)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}

// Mappe un price_id Stripe vers { plan, interval }
function getPlanFromPriceId(priceId: string): { plan: string; interval: 'monthly' | 'yearly' } | null {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY) {
    return { plan: 'plus', interval: 'monthly' }
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY) {
    return { plan: 'plus', interval: 'yearly' }
  }
  return null
}

export async function POST(req: NextRequest) {
  // 1. Vérification de la signature Stripe
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Webhook] Signature verification failed:', errorMessage)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`)

  // 2. Dispatch selon le type d'événement
  const supabase = getSupabaseAdmin()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, supabase)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription, supabase)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription, supabase)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice, supabase)
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    // 3. Toujours répondre 200 à Stripe (sinon il retry)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    // 500 pour que Stripe retry (si erreur transitoire)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ============================================================
// HANDLERS
// ============================================================

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] checkout.session.completed:', session.id)

  // Récupère le user_id depuis les metadata
  const userId = session.metadata?.supabase_user_id || session.client_reference_id
  if (!userId) {
    console.error('[Webhook] No supabase_user_id in session metadata')
    return
  }

  // Si mode subscription, on récupère la subscription complète
  if (session.mode !== 'subscription' || !session.subscription) {
    console.log('[Webhook] Not a subscription session, skipping')
    return
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id

  // Fetch la subscription complète depuis Stripe (avec line items)
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  await upsertSubscription(subscription, userId, supabase)

  // Met à jour profiles.plan + stripe_customer_id
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  if (customerId) {
    const { error } = await supabase
      .from('profiles')
      .update({
        plan: 'plus',
        stripe_customer_id: customerId,
      })
      .eq('id', userId)

    if (error) {
      console.error('[Webhook] Error updating profile:', error)
      throw error
    }
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] customer.subscription.updated:', subscription.id)

  // Récupère le user_id depuis les metadata de la subscription
  const userId = subscription.metadata?.supabase_user_id
  if (!userId) {
    console.error('[Webhook] No supabase_user_id in subscription metadata')
    return
  }

  await upsertSubscription(subscription, userId, supabase)

  // Met à jour profiles.plan en fonction du statut
  const newPlan = subscription.status === 'active' || subscription.status === 'trialing'
    ? 'plus'
    : 'free'

  const { error } = await supabase
    .from('profiles')
    .update({ plan: newPlan })
    .eq('id', userId)

  if (error) {
    console.error('[Webhook] Error updating profile plan:', error)
    throw error
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] customer.subscription.deleted:', subscription.id)

  const userId = subscription.metadata?.supabase_user_id
  if (!userId) {
    console.error('[Webhook] No supabase_user_id in subscription metadata')
    return
  }

  // Marque la subscription comme canceled
  const { error: subError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (subError) {
    console.error('[Webhook] Error updating subscription:', subError)
    throw subError
  }

  // Downgrade profiles.plan en free
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ plan: 'free' })
    .eq('id', userId)

  if (profileError) {
    console.error('[Webhook] Error downgrading profile:', profileError)
    throw profileError
  }
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] invoice.payment_failed:', invoice.id)

  // L'invoice a une subscription_id si c'est lié à un abonnement
  const subscriptionId = typeof (invoice as any).subscription === 'string'
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id

  if (!subscriptionId) {
    console.log('[Webhook] Invoice not tied to a subscription, skipping')
    return
  }

  // Marque la subscription comme past_due
  // NOTE : on ne downgrade PAS encore le plan, Stripe va réessayer plusieurs fois.
  // Le downgrade vrai se fait via customer.subscription.deleted quand Stripe abandonne.
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[Webhook] Error marking subscription past_due:', error)
    throw error
  }
}

// ============================================================
// HELPERS
// ============================================================

async function upsertSubscription(
  subscription: Stripe.Subscription,
  userId: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  // On prend le premier item (un abonnement TradeDiscipline n'a qu'un seul item)
  const item = subscription.items.data[0]
  if (!item) {
    console.error('[Webhook] Subscription has no items')
    return
  }

  const priceId = item.price.id
  const planInfo = getPlanFromPriceId(priceId)

  if (!planInfo) {
    console.error('[Webhook] Unknown price ID:', priceId)
    return
  }

  // Cast pour accéder aux champs de période (Stripe v22 typing edge case)
  const sub = subscription as any

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id,
    stripe_price_id: priceId,
    status: subscription.status,
    plan: planInfo.plan,
    interval: planInfo.interval,
    current_period_start: new Date((sub.current_period_start ?? item.current_period_start) * 1000).toISOString(),
    current_period_end: new Date((sub.current_period_end ?? item.current_period_end) * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'stripe_subscription_id' })

  if (error) {
    console.error('[Webhook] Error upserting subscription:', error)
    throw error
  }
}
