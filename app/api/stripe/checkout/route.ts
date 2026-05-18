import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body = await req.json()
    const { interval } = body as { interval?: 'monthly' | 'yearly' }

    if (interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json(
        { error: 'Invalid interval. Must be "monthly" or "yearly".' },
        { status: 400 }
      )
    }

    // 2. Authentification Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // 3. Récupération du profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // 4. Bloque si l'utilisateur est déjà en Plus ou Premium
    if (profile.plan === 'plus' || profile.plan === 'premium') {
      return NextResponse.json(
        { error: 'You are already on a paid plan' },
        { status: 400 }
      )
    }

    // 5. Choix du price ID selon l'intervalle
    const priceId = interval === 'monthly'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY

    if (!priceId) {
      console.error('[Stripe Checkout] Missing price ID env var for interval:', interval)
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 6. URL de retour (succès/annulation)
    const origin = req.headers.get('origin') || 'https://www.tradediscipline.app'
    const successUrl = `${origin}/dashboard/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/dashboard/upgrade?canceled=true`

    // 7. Création de la Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: profile.stripe_customer_id || undefined,
      customer_email: profile.stripe_customer_id ? undefined : (profile.email || user.email),
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan: 'plus',
        interval,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: 'plus',
          interval,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'auto',
    })

    if (!session.url) {
      console.error('[Stripe Checkout] No URL returned from Stripe session')
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    // 8. Retourne l'URL au frontend
    return NextResponse.json({ url: session.url })

  } catch (error) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
