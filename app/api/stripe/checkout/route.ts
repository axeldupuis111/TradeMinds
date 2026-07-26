import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { locales } from '@/i18n/config'
import { resolveReferralCode } from '@/lib/founding'

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body = await req.json()
    const { plan, interval, locale, ref } = body as {
      plan?: 'plus' | 'premium'
      interval?: 'monthly' | 'yearly'
      locale?: string
      ref?: string
    }

    // Langue de l'UI au moment du checkout : sert au webhook pour l'email de
    // félicitations dans la bonne langue (profiles.language peut ne pas encore
    // être synchronisé sur un compte tout neuf).
    const safeLocale = (locales as readonly string[]).includes(locale ?? '')
      ? (locale as string)
      : 'en'

    if (plan !== 'plus' && plan !== 'premium') {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "plus" or "premium".' },
        { status: 400 }
      )
    }

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

    // 5. Choix du price ID selon le plan + l'intervalle (4 combinaisons)
    const priceIdMap = {
      plus: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY,
        yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY,
      },
      premium: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY,
        yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY,
      },
    } as const

    const priceId = priceIdMap[plan][interval]

    if (!priceId) {
      console.error('[Stripe Checkout] Missing price ID env var for', plan, interval)
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 6. URL de retour (succès/annulation)
    const origin = req.headers.get('origin') || 'https://tradediscipline.app'
    const successUrl = `${origin}/dashboard/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/dashboard/upgrade?canceled=true`

    // 6b. Remise via CODE uniquement (modèle code-based, aucune auto-application) :
    // si l'utilisateur arrive avec un code de parrainage valide (?ref= / ?utm_source=
    // capté en localStorage, ex. « lancement » public ou « xanalyse » partenaire),
    // on pré-applique SON code promo. La remise ET l'attribution (→ commission)
    // sont préservées, sans qu'il ait à retaper le code. Sinon, saisie manuelle du
    // code au checkout via allow_promotion_codes (plus bas).
    //
    // Stripe interdit `discounts` et `allow_promotion_codes` ensemble : dès qu'on
    // pose une remise, on retire la saisie manuelle de code.
    let founding = false // marque le badge « Membre fondateur » (code pré-rempli)
    const discounts: NonNullable<Stripe.Checkout.SessionCreateParams['discounts']> = []

    // Le code d'un partenaire dont le quota est épuisé n'est plus applicable,
    // mais la vente lui revient quand même : on grave l'attribution dans les
    // metadata pour que sa commission ne saute pas silencieusement.
    const partner = await resolveReferralCode(ref)
    if (partner?.active) {
      discounts.push({ promotion_code: partner.id })
      founding = true
    }
    const attribution: Record<string, string> = partner ? { attribution_code: partner.code } : {}

    // 7. Création de la Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
        plan,
        interval,
        locale: safeLocale,
        founding: founding ? 'true' : 'false',
        ...attribution,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          interval,
          locale: safeLocale,
          founding: founding ? 'true' : 'false',
          ...attribution,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'auto',
      locale: 'auto',
    }

    if (discounts.length > 0) {
      sessionParams.discounts = discounts
    } else {
      // Aucune remise pré-appliquée : on laisse la saisie manuelle d'un code
      // (un filleul dont le slug n'a pas résolu peut encore taper son code).
      sessionParams.allow_promotion_codes = true
    }

    // Retire la remise du session courant et bascule en saisie manuelle de code.
    const dropDiscount = () => {
      delete sessionParams.discounts
      sessionParams.allow_promotion_codes = true
      sessionParams.metadata = { ...sessionParams.metadata, founding: 'false' }
      if (sessionParams.subscription_data) {
        sessionParams.subscription_data.metadata = {
          ...sessionParams.subscription_data.metadata,
          founding: 'false',
        }
      }
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (err) {
      const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
      const badCustomer =
        !!stripeErr &&
        !!sessionParams.customer &&
        (stripeErr.code === 'resource_missing' ||
          (stripeErr as { param?: string }).param === 'customer')

      if (badCustomer) {
        // customer stocké invalide (id créé en mode Test, ou supprimé côté Stripe) :
        // on laisse Stripe recréer un customer depuis l'email. Le webhook
        // (checkout.session.completed) réécrira le bon id live dans le profil.
        console.warn('[Stripe Checkout] customer invalide, recréation via email:', stripeErr?.message)
        sessionParams.customer = undefined
        sessionParams.customer_email = profile.email || user.email || undefined
        session = await stripe.checkout.sessions.create(sessionParams)
      } else if (discounts.length > 0) {
        // Remise refusée (coupon épuisé/supprimé, code réservé aux nouveaux
        // clients…) : repli plein tarif avec saisie de code.
        console.warn('[Stripe Checkout] Remise refusée, repli plein tarif:', err instanceof Error ? err.message : err)
        dropDiscount()
        session = await stripe.checkout.sessions.create(sessionParams)
      } else {
        throw err
      }
    }

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
