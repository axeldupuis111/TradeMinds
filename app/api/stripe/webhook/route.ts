import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { stripe } from '@/lib/stripe'
import { renderBrandEmail, emailParagraph } from '@/lib/email-template'

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
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY) {
    return { plan: 'premium', interval: 'monthly' }
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY) {
    return { plan: 'premium', interval: 'yearly' }
  }
  return null
}

// Hiérarchie des plans : sert à empêcher une montée en gamme non payée.
function planRank(plan: string): number {
  if (plan === 'premium') return 2
  if (plan === 'plus') return 1
  return 0 // free / inconnu
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

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice, supabase)
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

  // Attribution affiliation : si un code promo a été saisi au checkout, on le
  // grave dans les metadata de la subscription. Les remises « répétitives »
  // (ex. -10 % × 3 mois) disparaissent des factures une fois la durée écoulée —
  // les metadata, elles, restent à vie, ce qui permet de calculer les
  // commissions influenceur sur les 12 premiers mois (onglet admin Affiliation).
  try {
    const promoRef = session.discounts?.[0]?.promotion_code
    if (promoRef && !subscription.metadata?.promo_code) {
      const promo = typeof promoRef === 'string'
        ? await stripe.promotionCodes.retrieve(promoRef)
        : promoRef
      if (promo?.code) {
        await stripe.subscriptions.update(subscription.id, {
          metadata: { ...subscription.metadata, promo_code: promo.code },
        })
      }
    }
  } catch (err) {
    // L'attribution ne doit jamais bloquer l'activation du plan.
    console.error('[Webhook] Attribution promo_code échouée:', err)
  }

  await upsertSubscription(subscription, userId, supabase)

  // Détermine le plan acheté (plus / premium) depuis le price ID de la subscription
  const purchasedPriceId = subscription.items.data[0]?.price.id
  const purchasedPlan = purchasedPriceId ? getPlanFromPriceId(purchasedPriceId)?.plan : null

  // Met à jour profiles.plan + stripe_customer_id
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  if (customerId && purchasedPlan) {
    const { error } = await supabase
      .from('profiles')
      .update({
        plan: purchasedPlan,
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

  // Plan visé selon le statut + le price (plus / premium)
  const updatedPriceId = subscription.items.data[0]?.price.id
  const updatedPlan = updatedPriceId ? getPlanFromPriceId(updatedPriceId)?.plan : null

  const computedPlan = (subscription.status === 'active' || subscription.status === 'trialing')
    ? (updatedPlan ?? 'plus')
    : 'free'

  // IMPORTANT : on ne fait JAMAIS MONTER en gamme ici. Un upgrade (ex. plus -> premium)
  // peut arriver avec une facture pas encore payée (3DS, carte refusée). Le passage à un
  // palier supérieur est accordé uniquement par invoice.paid (paiement confirmé).
  // Ici on ne gère que les baisses / annulations / synchronisations à plan égal.
  const { data: current } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  const currentPlan = (current?.plan as string) ?? 'free'

  if (planRank(computedPlan) > planRank(currentPlan)) {
    console.log(`[Webhook] Montée ${currentPlan} -> ${computedPlan} ignorée ici (attend invoice.paid)`)
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({ plan: computedPlan })
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

// Récupère l'ID d'abonnement lié à une facture, quelle que soit la forme de l'API.
// API 2026-04-22.dahlia : `subscription` a quitté la racine de Invoice pour
// `parent.subscription_details.subscription` (ou au niveau des line items).
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  type InvoiceShapes = Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
    parent?: {
      subscription_details?: { subscription?: string | Stripe.Subscription | null } | null
    } | null
  }
  const inv = invoice as InvoiceShapes

  const direct = inv.subscription
  if (direct) return typeof direct === 'string' ? direct : direct.id

  const viaParent = inv.parent?.subscription_details?.subscription
  if (viaParent) return typeof viaParent === 'string' ? viaParent : viaParent.id

  type LineShape = Stripe.InvoiceLineItem & {
    parent?: { subscription_item_details?: { subscription?: string | null } | null } | null
  }
  const line = invoice.lines?.data?.[0] as LineShape | undefined
  return line?.parent?.subscription_item_details?.subscription ?? undefined
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] invoice.payment_failed:', invoice.id)

  const subscriptionId = getInvoiceSubscriptionId(invoice)

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

// Copy de l'email « félicitations » par langue. {plan} = nom du plan.
const CONGRATS_EMAIL: Record<string, { subject: string; heading: string; body: string; cta: string }> = {
  fr: {
    subject: 'Bienvenue dans TradeDiscipline {plan} 🎉',
    heading: 'Félicitations, te voilà en {plan} !',
    body: 'Ton abonnement est actif. Profite de toutes les fonctionnalités dès maintenant. Ta facture est disponible ci-dessous.',
    cta: 'Voir ma facture',
  },
  en: {
    subject: 'Welcome to TradeDiscipline {plan} 🎉',
    heading: "Congratulations, you're on {plan}!",
    body: 'Your subscription is active. Enjoy all the features right away. Your invoice is available below.',
    cta: 'View my invoice',
  },
  es: {
    subject: 'Bienvenido a TradeDiscipline {plan} 🎉',
    heading: '¡Enhorabuena, ya tienes {plan}!',
    body: 'Tu suscripción está activa. Disfruta de todas las funciones desde ahora. Tu factura está disponible abajo.',
    cta: 'Ver mi factura',
  },
  de: {
    subject: 'Willkommen bei TradeDiscipline {plan} 🎉',
    heading: 'Glückwunsch, du bist jetzt bei {plan}!',
    body: 'Dein Abo ist aktiv. Nutze ab sofort alle Funktionen. Deine Rechnung findest du unten.',
    cta: 'Meine Rechnung ansehen',
  },
}

const PLAN_LABEL: Record<string, string> = { plus: 'Plus', premium: 'Premium' }

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  console.log('[Webhook] invoice.paid:', invoice.id, 'reason:', invoice.billing_reason)

  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    console.log('[Webhook] invoice.paid sans subscription (reason:', invoice.billing_reason, ') — skip')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id
  const planInfo = priceId ? getPlanFromPriceId(priceId) : null
  if (!planInfo) return

  const userId = subscription.metadata?.supabase_user_id
  if (!userId) return

  // PAIEMENT CONFIRMÉ : c'est ici (et seulement ici) qu'on accorde le palier payé,
  // y compris une montée en gamme. Sans facture payée, pas d'accès Premium.
  const { error: planError } = await supabase
    .from('profiles')
    .update({ plan: planInfo.plan })
    .eq('id', userId)
  if (planError) {
    console.error('[Webhook] Error granting paid plan:', planError)
    throw planError
  }

  // On ne félicite que sur une nouvelle souscription ou un changement de plan (upgrade),
  // jamais sur un renouvellement (subscription_cycle).
  if (invoice.billing_reason !== 'subscription_create' && invoice.billing_reason !== 'subscription_update') {
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[Webhook] RESEND_API_KEY absent, email de félicitations non envoyé')
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, language')
    .eq('id', userId)
    .single()

  const to = profile?.email || invoice.customer_email
  if (!to) {
    console.warn('[Webhook] Pas d\'email pour féliciter le user', userId)
    return
  }

  // Langue de l'email : priorité à la langue capturée au checkout (metadata.locale),
  // puis profiles.language, puis 'en'. profiles.language peut être null sur un compte
  // tout neuf (synchro fire-and-forget pas encore persistée au moment du paiement).
  const metaLocale = subscription.metadata?.locale
  const profileLang = profile?.language as string | undefined
  const lang = (metaLocale && metaLocale in CONGRATS_EMAIL)
    ? metaLocale
    : (profileLang && profileLang in CONGRATS_EMAIL)
      ? profileLang
      : 'en'
  const planLabel = PLAN_LABEL[planInfo.plan] ?? planInfo.plan
  const copy = CONGRATS_EMAIL[lang]
  const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf || 'https://www.tradediscipline.app/dashboard'

  const subject = copy.subject.replace('{plan}', planLabel)
  const heading = copy.heading.replace('{plan}', planLabel)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Resend ne throw PAS sur une erreur API : elle renvoie { data, error }.
    // On loggue explicitement l'erreur pour la voir dans les logs Vercel.
    const { data, error } = await resend.emails.send({
      from: 'TradeDiscipline <noreply@tradediscipline.app>',
      to,
      subject,
      html: renderBrandEmail({
        preheader: copy.body,
        headerNote: planLabel,
        heading,
        bodyHtml: emailParagraph(copy.body),
        cta: { label: copy.cta, url: invoiceUrl },
      }),
    })
    if (error) {
      console.error('[Webhook] Resend a refusé l\'envoi:', JSON.stringify(error))
    } else {
      console.log('[Webhook] Email félicitations envoyé:', data?.id, 'to', to)
    }
  } catch (emailErr) {
    // L'email ne doit jamais faire échouer le webhook (sinon Stripe retry).
    console.error('[Webhook] Échec envoi email félicitations:', emailErr)
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

  // Stripe SDK v22 with API version 2026-04-22.dahlia moved current_period_start/end
  // from the subscription level to the item level in some types.
  // We accept both shapes via a typed cast.
  type SubscriptionWithPeriod = Stripe.Subscription & {
    current_period_start?: number
    current_period_end?: number
  }
  const sub = subscription as SubscriptionWithPeriod

  // Detect cancellation: old convention (cancel_at_period_end) or new (cancel_at + reason)
  // Stripe API 2026-04-22.dahlia no longer sets cancel_at_period_end=true on portal cancellations.
  type SubscriptionWithCancellation = Stripe.Subscription & {
    cancel_at?: number | null
    cancellation_details?: {
      reason?: string | null
      feedback?: string | null
      comment?: string | null
    } | null
  }
  const subWithCancel = subscription as SubscriptionWithCancellation

  const hasUserRequestedCancellation =
    subWithCancel.cancel_at !== null &&
    subWithCancel.cancel_at !== undefined &&
    subWithCancel.cancellation_details?.reason === "cancellation_requested"

  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end || hasUserRequestedCancellation

  const canceledAtTimestamp = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : hasUserRequestedCancellation
      ? new Date().toISOString()
      : null

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
    cancel_at_period_end: isCancelingAtPeriodEnd,
    canceled_at: canceledAtTimestamp,
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
