import { stripe } from '@/lib/stripe'
import { FOUNDING_TOTAL, pickUsablePromo } from '@/lib/founding-config'

// ============================================================
// Offre « Membre fondateur » — logique SERVEUR (Stripe). Modèle « code-based » :
// aucune remise auto-appliquée. Le prix fondateur s'obtient toujours via un CODE.
//
//  1. Public — code LANCEMENT (affiché landing/notif), coupon à -9,99 € (→ 5 €),
//     max_redemptions=100. Le compteur « X/100 places » lit times_redeemed de CE
//     coupon (STRIPE_COUPON_FOUNDING pointe dessus).
//
//  2. Partenaire (influenceurs) — chaque influenceur a SON code promo → SON
//     coupon à -11,99 € (→ 3 €), sa propre allocation. Appliqué via le code
//     (attribution → commission). Cf. [[influencer-partnership]].
//
// Les codes sont pré-remplis quand l'utilisateur arrive via un lien ?ref= (le
// slug capté en localStorage), sinon saisis à la main. Le badge founding_member
// est posé au webhook quand un code a été pré-rempli (metadata.founding=true).
// ============================================================

export { FOUNDING_TOTAL }

// Coupon public (derrière le code LANCEMENT). Server-only : sert au COMPTEUR des
// places. Absent → compteur inactif (offre masquée). Le checkout, lui, applique
// les codes via resolveReferralPromo, indépendamment de cette variable.
export const FOUNDING_COUPON = process.env.STRIPE_COUPON_FOUNDING

export interface FoundingStatus {
  active: boolean
  total: number
  claimed: number
  remaining: number
}

// État des places du canal DIRECT, lu depuis le coupon Stripe (times_redeemed /
// max_redemptions). Fail-safe : en cas d'absence de coupon ou d'erreur, on
// renvoie « plein » (offre masquée) pour rester conservateur côté marge.
export async function getDirectFoundingStatus(): Promise<FoundingStatus> {
  const full: FoundingStatus = { active: false, total: FOUNDING_TOTAL, claimed: FOUNDING_TOTAL, remaining: 0 }
  if (!FOUNDING_COUPON) return full

  try {
    const coupon = await stripe.coupons.retrieve(FOUNDING_COUPON)
    const total = coupon.max_redemptions ?? FOUNDING_TOTAL
    const claimed = coupon.times_redeemed ?? 0
    const remaining = Math.max(0, total - claimed)
    // coupon.valid tombe à false quand le max_redemptions est atteint ou qu'il expire.
    const active = coupon.valid && remaining > 0
    return { active, total, claimed: Math.min(claimed, total), remaining }
  } catch (err) {
    console.error('[Founding] getDirectFoundingStatus error:', err)
    return full
  }
}

export interface ReferralPromo {
  id: string
  code: string
  /** false = épuisé (max_redemptions atteint), expiré ou archivé. */
  active: boolean
}

// Résout un code de parrainage (slug capté en localStorage, ex. « xanalyse »)
// vers le code promo Stripe correspondant. Les codes sont créés en majuscules ;
// le slug d'attribution est stocké en minuscules → on normalise.
//
// Renvoie AUSSI les codes désactivés : la remise ne s'applique plus, mais on a
// besoin de savoir que le visiteur vient bien d'un partenaire pour lui attribuer
// la vente (sinon sa commission disparaîtrait sans bruit une fois son quota
// atteint). Renvoie null pour une source non-partenaire (« twitter »…).
export async function resolveReferralCode(ref: string | undefined | null): Promise<ReferralPromo | null> {
  if (!ref) return null
  const code = ref.trim().toUpperCase().slice(0, 64)
  if (!code) return null
  try {
    const list = await stripe.promotionCodes.list({ code, limit: 10 })
    const found = pickUsablePromo(list.data)
    return found ? { id: found.id, code: found.code, active: found.active } : null
  } catch (err) {
    console.error('[Founding] resolveReferralCode error:', err)
    return null
  }
}

// Id du code à pré-appliquer au checkout : uniquement s'il est encore utilisable.
export async function resolveReferralPromo(ref: string | undefined | null): Promise<string | null> {
  const promo = await resolveReferralCode(ref)
  return promo?.active ? promo.id : null
}
