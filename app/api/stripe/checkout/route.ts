import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { locales } from '@/i18n/config'
import { FOUNDING_COUPON, getDirectFoundingStatus, resolveReferralPromo } from '@/lib/founding'

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

    // 6b. Remise appliquée au checkout — deux canaux exclusifs (cf. lib/founding) :
    //
    //  a) PARTENAIRE : si l'utilisateur arrive avec un code de parrainage valide
    //     (?ref= / ?utm_source= capté en localStorage), on pré-applique SON code
    //     promo. La remise (prix fondateur) ET l'attribution (→ commission) sont
    //     préservées, sans que l'utilisateur ait à retaper le code. Prioritaire.
    //
    //  b) DIRECT : sinon, sur le Plus MENSUEL, on auto-applique le coupon
    //     fondateur générique tant qu'il reste des places (canal perso d'Axel).
    //
    // Stripe interdit `discounts` et `allow_promotion_codes` ensemble : dès qu'on
    // pose une remise, on retire la saisie manuelle de code.
    let founding = false // marque le badge « Membre fondateur » (les 2 canaux)
    const discounts: NonNullable<Stripe.Checkout.SessionCreateParams['discounts']> = []

    const partnerPromoId = await resolveReferralPromo(ref)
    if (partnerPromoId) {
      // Canal partenaire : code promo pré-appliqué + attribué (webhook grave promo_code).
      discounts.push({ promotion_code: partnerPromoId })
      founding = true
    } else if (plan === 'plus' && interval === 'monthly' && FOUNDING_COUPON) {
      // Canal direct : coupon fondateur générique tant qu'il reste des places.
      const status = await getDirectFoundingStatus()
      if (status.active) {
        discounts.push({ coupon: FOUNDING_COUPON })
        founding = true
      }
    }

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
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          interval,
          locale: safeLocale,
          founding: founding ? 'true' : 'false',
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

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (err) {
      // Remise refusée (coupon épuisé/supprimé, code réservé aux nouveaux clients,
      // client déjà remisé…) : on retombe sur le plein tarif avec saisie de code
      // plutôt que de bloquer la souscription.
      if (discounts.length === 0) throw err
      console.warn(
        '[Stripe Checkout] Remise refusée, repli plein tarif:',
        err instanceof Error ? err.message : err
      )
      delete sessionParams.discounts
      sessionParams.allow_promotion_codes = true
      sessionParams.metadata = { ...sessionParams.metadata, founding: 'false' }
      if (sessionParams.subscription_data) {
        sessionParams.subscription_data.metadata = {
          ...sessionParams.subscription_data.metadata,
          founding: 'false',
        }
      }
      session = await stripe.checkout.sessions.create(sessionParams)
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
    // DIAGNOSTIC TEMPORAIRE : on renvoie le vrai message pour identifier le refus
    // Stripe côté client. À retirer une fois la cause trouvée.
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Internal server error: ${detail}` },
      { status: 500 }
    )
  }
}
