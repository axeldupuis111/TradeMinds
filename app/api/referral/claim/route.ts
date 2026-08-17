import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode, recordAttribution, resolveRefCode } from "@/lib/partners";

/**
 * Pose l'attribution d'un compte à son apporteur, DÈS L'INSCRIPTION.
 *
 * POURQUOI SI TÔT. L'attribution se jouait jusqu'ici au paiement, sur le code
 * promo Stripe. Un visiteur qui arrivait par le lien d'un collaborateur, créait
 * un compte gratuit, puis s'abonnait trois mois plus tard sans retaper de code
 * n'était rattaché à personne : la vente était perdue pour l'apporteur, et
 * invérifiable pour nous. On grave donc le lien à la création du compte, et le
 * paiement n'a plus qu'à le relire.
 *
 * Appelée par components/dashboard/SignupAttribution au premier passage dans le
 * dashboard. Idempotente : la clé primaire sur user_id verrouille le premier
 * apporteur (first-touch), les appels suivants ne font rien.
 */

/** Au-delà, ce n'est plus une inscription mais un re-login : on n'attribue pas. */
const FRESH_ACCOUNT_MS = 7 * 24 * 3600 * 1000;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { source?: string };
    const code = normalizeCode(body.source);
    if (!code) return NextResponse.json({ attributed: false });

    // Garde-fou serveur, en plus de celui du client : un utilisateur ancien qui
    // cliquerait un lien partenaire ne doit pas basculer dans son portefeuille.
    // Le client peut mentir, la date de création du compte non.
    if (Date.now() - new Date(user.created_at).getTime() > FRESH_ACCOUNT_MS) {
      return NextResponse.json({ attributed: false, reason: "compte non récent" });
    }

    // Service role : referral_attributions et partner_reps sont fermés à tout
    // client (de l'argent en dépend), la résolution se fait donc côté serveur.
    const admin = createAdminClient();
    const resolved = await resolveRefCode(admin, code);

    // Un code qui ne résout vers aucun collaborateur est quand même consigné :
    // « lancement », « twitter » ou une coquille dans un lien partenaire. Sans
    // cette trace, une attribution manquante est indébogable.
    const attributed = await recordAttribution(admin, user.id, resolved, code, "signup");

    return NextResponse.json({
      attributed,
      partner: resolved?.partner.name ?? null,
    });
  } catch (err) {
    console.error("[Referral claim] erreur:", err);
    // L'attribution ne doit jamais casser l'entrée dans le dashboard.
    return NextResponse.json({ attributed: false }, { status: 200 });
  }
}
