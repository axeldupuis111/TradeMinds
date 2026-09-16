import { NextRequest, NextResponse } from 'next/server'
import { getDirectFoundingStatus, resolveReferralPromo } from '@/lib/founding'
import {
  FOUNDING_PUBLIC_CODE,
  FOUNDING_REGULAR_CENTS,
  FOUNDING_PUBLIC_FIRST_MONTH_CENTS,
  FOUNDING_PARTNER_FIRST_MONTH_CENTS,
} from '@/lib/founding-config'

export const dynamic = 'force-dynamic'

// Public : décrit l'offre fondateur applicable au visiteur, selon son code de
// parrainage capté (?ref=). Alimente le bandeau + la notif. Aucune donnée
// personnelle.
//
// ⚠️⚠️ ON REND DES CENTIMES, PAS DES PRIX ÉCRITS. Cette route ne connaît pas la
// langue du lecteur : elle rendait « 14,99 € », virgule française comprise, à
// une page servie en anglais, pendant que la grille des tarifs de la même page
// écrivait « €14.99 ». Le formatage appartient à l'écran, qui sait dans quelle
// langue il parle (`prixLisible`).
//
//  - ref = un code partenaire valide (≠ code public) → variante « partner » (3 €).
//  - sinon → variante « public » (code LANCEMENT, 5 €) + compteur des 100 places.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')?.trim() || undefined

  // Code partenaire : tout code promo actif qui n'est pas le code public.
  if (ref && ref.toUpperCase() !== FOUNDING_PUBLIC_CODE.toUpperCase()) {
    const promoId = await resolveReferralPromo(ref)
    if (promoId) {
      return NextResponse.json({
        active: true,
        variant: 'partner',
        code: ref.toUpperCase(),
        regularCents: FOUNDING_REGULAR_CENTS,
        firstMonthCents: FOUNDING_PARTNER_FIRST_MONTH_CENTS,
      })
    }
  }

  // Offre publique (code LANCEMENT) + compteur des places restantes.
  const status = await getDirectFoundingStatus()
  return NextResponse.json({
    active: status.active,
    variant: 'public',
    code: FOUNDING_PUBLIC_CODE,
    regularCents: FOUNDING_REGULAR_CENTS,
    firstMonthCents: FOUNDING_PUBLIC_FIRST_MONTH_CENTS,
    total: status.total,
    remaining: status.remaining,
    claimed: status.claimed,
  })
}
