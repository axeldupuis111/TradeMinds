import { stripe } from '@/lib/stripe'

// ============================================================
// Offre « Membre fondateur » : les 100 premiers abonnés Plus (mensuel) paient
// leur premier mois à tarif d'appel (3 €), puis le plein tarif (14,99 €).
//
// DEUX CANAUX, source de vérité côté Stripe :
//
//  1. Direct (TikTok/Reddit d'Axel) — coupon générique STRIPE_COUPON_FOUNDING,
//     appliqué AUTOMATIQUEMENT au checkout du Plus mensuel. Le plafond « 100 »
//     est le max_redemptions de CE coupon (Stripe l'enforce). Le compteur public
//     lit times_redeemed de ce coupon : il ne compte donc QUE le canal direct.
//
//  2. Partenaire (influenceurs) — chaque influenceur a SON code promo, pointant
//     vers SON coupon (même remise -11,99 € once, son propre max_redemptions).
//     Appliqué via le code (attribution → commission). N'entame pas les 100
//     places directes puisque c'est un autre coupon.
//
// Le badge founding_member est posé pour les DEUX canaux (metadata.founding=true
// au checkout → webhook sur la 1re facture payée). Cf. app/api/stripe/webhook.
//
// ⚠️ Config Stripe (Axel, dashboard Live) : le coupon direct DOIT avoir
// max_redemptions=100 pour que le plafond et le compteur fonctionnent.
// ============================================================

export const FOUNDING_TOTAL = 100

// Coupon générique du canal direct. Server-only : absent → offre directe
// désactivée (checkout normal, plein tarif).
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

// Résout un code de parrainage (slug capté en localStorage, ex. « xanalyse »)
// vers l'ID d'un code promo Stripe ACTIF. Les codes promo sont créés en
// majuscules ; le slug d'attribution est stocké en minuscules → on normalise.
// Renvoie null si aucun code actif ne correspond (visiteur organique, source
// non-partenaire comme « twitter », etc.).
export async function resolveReferralPromo(ref: string | undefined | null): Promise<string | null> {
  if (!ref) return null
  const code = ref.trim().toUpperCase().slice(0, 64)
  if (!code) return null
  try {
    const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 })
    return list.data[0]?.id ?? null
  } catch (err) {
    console.error('[Founding] resolveReferralPromo error:', err)
    return null
  }
}
