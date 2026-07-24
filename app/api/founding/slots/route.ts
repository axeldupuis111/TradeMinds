import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getDirectFoundingStatus, resolveReferralPromo, FOUNDING_COUPON } from '@/lib/founding'
import {
  FOUNDING_PUBLIC_CODE,
  FOUNDING_REGULAR_PRICE,
  FOUNDING_PUBLIC_FIRST_MONTH,
  FOUNDING_PARTNER_FIRST_MONTH,
} from '@/lib/founding-config'

export const dynamic = 'force-dynamic'

// Public : décrit l'offre fondateur applicable au visiteur, selon son code de
// parrainage capté (?ref=). Alimente le bandeau + la notif. Aucune donnée
// personnelle.
//
//  - ref = un code partenaire valide (≠ code public) → variante « partner » (3 €).
//  - sinon → variante « public » (code LANCEMENT, 5 €) + compteur des 100 places.
export async function GET(req: NextRequest) {
  // DIAGNOSTIC TEMPORAIRE (?debug=1) : santé de la config coupon, sans exposer
  // de secret (l'ID de coupon n'en est pas un). À retirer une fois réglé.
  if (req.nextUrl.searchParams.get('debug') === '1') {
    const out: Record<string, unknown> = {
      couponVarSet: !!FOUNDING_COUPON,
      couponIdSuffix: FOUNDING_COUPON ? `…${FOUNDING_COUPON.slice(-4)}` : null,
    }
    if (FOUNDING_COUPON) {
      try {
        const c = await stripe.coupons.retrieve(FOUNDING_COUPON)
        out.retrieveOk = true
        out.valid = c.valid
        out.amountOff = c.amount_off
        out.timesRedeemed = c.times_redeemed
        out.maxRedemptions = c.max_redemptions
      } catch (e) {
        out.retrieveOk = false
        out.error = e instanceof Error ? e.message : String(e)
      }
    }
    return NextResponse.json(out)
  }

  const ref = req.nextUrl.searchParams.get('ref')?.trim() || undefined

  // Code partenaire : tout code promo actif qui n'est pas le code public.
  if (ref && ref.toUpperCase() !== FOUNDING_PUBLIC_CODE.toUpperCase()) {
    const promoId = await resolveReferralPromo(ref)
    if (promoId) {
      return NextResponse.json({
        active: true,
        variant: 'partner',
        code: ref.toUpperCase(),
        regular: FOUNDING_REGULAR_PRICE,
        firstMonth: FOUNDING_PARTNER_FIRST_MONTH,
      })
    }
  }

  // Offre publique (code LANCEMENT) + compteur des places restantes.
  const status = await getDirectFoundingStatus()
  return NextResponse.json({
    active: status.active,
    variant: 'public',
    code: FOUNDING_PUBLIC_CODE,
    regular: FOUNDING_REGULAR_PRICE,
    firstMonth: FOUNDING_PUBLIC_FIRST_MONTH,
    total: status.total,
    remaining: status.remaining,
    claimed: status.claimed,
  })
}
