import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// Rang des plans payants : sert à déterminer si un changement est un upgrade ou un downgrade.
const PLAN_RANK: Record<'plus' | 'premium', number> = { plus: 1, premium: 2 }

function getPriceId(plan: 'plus' | 'premium', interval: 'monthly' | 'yearly'): string | undefined {
  const map = {
    plus: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY,
    },
    premium: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY,
    },
  } as const
  return map[plan][interval]
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body = await req.json()
    const { targetPlan, interval, mode } = body as {
      targetPlan?: 'plus' | 'premium'
      interval?: 'monthly' | 'yearly'
      mode?: 'preview' | 'commit'
    }

    if (targetPlan !== 'plus' && targetPlan !== 'premium') {
      return NextResponse.json({ error: 'Invalid targetPlan' }, { status: 400 })
    }
    if (interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
    }
    const action = mode === 'commit' ? 'commit' : 'preview'

    // 2. Auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 3. Profil + plan courant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const currentPlan = profile.plan as string
    if (currentPlan !== 'plus' && currentPlan !== 'premium') {
      return NextResponse.json(
        { error: 'No paid subscription to change. Subscribe first.' },
        { status: 400 }
      )
    }
    if (currentPlan === targetPlan) {
      // Même plan : rien à faire côté tier (changement d'intervalle non géré ici)
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
    }

    // 4. Abonnement Stripe actif de l'utilisateur
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subRow?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    const subscription = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id)
    const item = subscription.items.data[0]
    if (!item) {
      return NextResponse.json({ error: 'Subscription has no item' }, { status: 500 })
    }

    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const targetPriceId = getPriceId(targetPlan, interval)
    if (!targetPriceId) {
      console.error('[Change Plan] Missing price ID env var for', targetPlan, interval)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const isUpgrade = PLAN_RANK[targetPlan] > PLAN_RANK[currentPlan as 'plus' | 'premium']

    // ────────────────────────────────────────────────────────────
    // PREVIEW : on estime le montant prélevé maintenant (upgrade uniquement)
    // ────────────────────────────────────────────────────────────
    if (action === 'preview') {
      if (!isUpgrade) {
        // Downgrade : pas de prélèvement immédiat, bascule en fin de période
        return NextResponse.json({
          isUpgrade: false,
          amountDueNow: 0,
          currency: subscription.items.data[0]?.price.currency ?? 'eur',
          periodEnd: getPeriodEnd(subscription),
        })
      }

      try {
        const preview = await stripe.invoices.createPreview({
          customer: customerId,
          subscription: subscription.id,
          subscription_details: {
            items: [{ id: item.id, price: targetPriceId }],
            proration_behavior: 'create_prorations',
          },
        })
        // Lignes de prorata = à payer maintenant. Le flag a changé de place selon les
        // versions d'API (`proration` à plat, ou parent.subscription_item_details.proration).
        const prorationLines = preview.lines.data.filter(isProrationLine)
        const prorationTotal = prorationLines.reduce((sum, l) => sum + l.amount, 0)

        return NextResponse.json({
          isUpgrade: true,
          // Si on n'arrive pas à isoler les lignes de prorata, on renvoie null
          // pour que l'UI affiche un message générique plutôt qu'un faux montant.
          amountDueNow: prorationLines.length > 0 ? Math.max(0, prorationTotal) : null,
          currency: preview.currency,
          periodEnd: getPeriodEnd(subscription),
        })
      } catch (err) {
        console.error('[Change Plan] Preview failed:', err)
        // Repli : pas de montant exact, le frontend affichera un texte générique
        return NextResponse.json({
          isUpgrade: true,
          amountDueNow: null,
          currency: 'eur',
          periodEnd: getPeriodEnd(subscription),
        })
      }
    }

    // ────────────────────────────────────────────────────────────
    // COMMIT
    // ────────────────────────────────────────────────────────────
    if (isUpgrade) {
      // 1er essai : débit silencieux du prorata sur la carte enregistrée.
      // error_if_incomplete : si le paiement n'aboutit pas (refus OU 3DS requis),
      // l'update throw ET le changement de prix est annulé. Aucune redirection si ça marche.
      try {
        const updated = await stripe.subscriptions.update(subscription.id, {
          items: [{ id: item.id, price: targetPriceId }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'error_if_incomplete',
          expand: ['latest_invoice'],
        })
        const invoice = updated.latest_invoice as Stripe.Invoice | null
        return NextResponse.json({
          ok: true,
          kind: 'upgrade',
          paid: true,
          amountPaid: invoice?.amount_paid ?? null,
          currency: invoice?.currency ?? 'eur',
          invoiceUrl: invoice?.hosted_invoice_url ?? null,
        })
      } catch (payErr) {
        // Le débit silencieux a échoué (carte refusée, fonds insuffisants, ou
        // authentification 3DS requise). On régénère une facture payable et on
        // renvoie l'utilisateur vers la page Stripe : il peut payer ET changer de carte.
        if (payErr instanceof Stripe.errors.StripeError) {
          const retried = await stripe.subscriptions.update(subscription.id, {
            items: [{ id: item.id, price: targetPriceId }],
            proration_behavior: 'always_invoice',
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice'],
          })
          const inv = retried.latest_invoice as Stripe.Invoice | null
          if (inv?.hosted_invoice_url) {
            return NextResponse.json({
              ok: true,
              kind: 'upgrade',
              paid: false,
              hostedInvoiceUrl: inv.hosted_invoice_url,
            })
          }
        }
        throw payErr
      }
    } else {
      // Downgrade : on programme la bascule en fin de période (pas de remboursement).
      const currentPriceId = item.price.id
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.id,
      })
      const phase0 = schedule.phases[0]
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        proration_behavior: 'none',
        phases: [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            start_date: phase0.start_date,
            end_date: phase0.end_date,
          },
          {
            items: [{ price: targetPriceId, quantity: 1 }],
          },
        ],
      })
      return NextResponse.json({ ok: true, kind: 'downgrade_scheduled' })
    }
  } catch (error) {
    console.error('[Change Plan] Error:', error)
    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Détecte une ligne de facture de type prorata, quelle que soit la forme de l'API.
function isProrationLine(line: Stripe.InvoiceLineItem): boolean {
  type LineShapes = Stripe.InvoiceLineItem & {
    proration?: boolean
    parent?: { subscription_item_details?: { proration?: boolean } | null } | null
  }
  const l = line as LineShapes
  if (typeof l.proration === 'boolean') return l.proration
  return l.parent?.subscription_item_details?.proration === true
}

// L'API 2026-04-22.dahlia expose current_period_end au niveau de l'item.
function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  type WithPeriod = Stripe.Subscription & { current_period_end?: number }
  const sub = subscription as WithPeriod
  const itemEnd = subscription.items.data[0]?.current_period_end
  return sub.current_period_end ?? itemEnd ?? null
}
