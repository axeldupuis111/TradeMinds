import { NextResponse } from 'next/server'
import { getDirectFoundingStatus } from '@/lib/founding'

export const dynamic = 'force-dynamic'

// Public : combien de places « membre fondateur » restent sur le canal DIRECT,
// pour afficher un compteur d'urgence sur la landing / la page upgrade. Lu depuis
// le coupon Stripe (times_redeemed / max_redemptions) : ne compte donc pas les
// filleuls des partenaires (autre coupon). Aucune donnée personnelle. Fail-safe
// géré dans getDirectFoundingStatus (offre masquée en cas d'erreur).
export async function GET() {
  const status = await getDirectFoundingStatus()
  return NextResponse.json(status)
}
