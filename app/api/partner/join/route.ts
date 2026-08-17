import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRep, findPartnerByJoinCode, type RepRow } from "@/lib/partners";

/**
 * INSCRIPTION D'UN COLLABORATEUR, en self-service.
 *
 * C'est la route qui rend un réseau de plusieurs milliers de personnes tenable.
 * Le partenaire ne crée personne : il diffuse UN code d'inscription à son
 * réseau, et chacun repart avec son propre lien en trente secondes. Créer un
 * apporteur est un INSERT, là où l'ancien rail imposait de fabriquer un objet
 * Stripe à la main pour chaque personne.
 *
 * Route PUBLIQUE : le code d'inscription secret du partenaire est la seule
 * porte. C'est le même compromis que le code d'invitation des communautés, avec
 * la même parade en cas de fuite (le partenaire régénère son code).
 */

/** Un email déjà inscrit récupère SON code : deux liens pour la même personne
 *  éclateraient ses ventes sur deux lignes sans qu'elle comprenne pourquoi. */
async function findExistingRep(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  email: string
): Promise<RepRow | null> {
  const { data } = await supabase
    .from("partner_reps")
    .select("id, partner_id, code, display_name, email, stats_token, charter_accepted_at, user_id, active")
    .eq("partner_id", partnerId)
    .eq("email", email)
    .maybeSingle();
  return (data as RepRow) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      joinCode?: string;
      name?: string;
      email?: string;
      charter?: boolean;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();

    if (name.length < 2) {
      return NextResponse.json({ error: "Nom trop court." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    // La charte (aucune promesse de gain, aucun signal) est la seule preuve
    // qu'on pourra produire si un collaborateur dérape dans sa communication.
    // Sans acceptation, pas de code.
    if (body.charter !== true) {
      return NextResponse.json({ error: "La charte doit être acceptée." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const partner = await findPartnerByJoinCode(supabase, body.joinCode);
    if (!partner) {
      return NextResponse.json({ error: "Code d'inscription inconnu." }, { status: 404 });
    }

    const existing = await findExistingRep(supabase, partner.id, email);
    const rep = existing ?? (await createRep(supabase, {
      partner,
      displayName: name,
      email,
      charterAccepted: true,
    }));

    if (!rep) {
      return NextResponse.json({ error: "Création impossible, réessayez." }, { status: 500 });
    }

    return NextResponse.json({
      partner: partner.name,
      code: rep.code,
      statsToken: rep.stats_token,
      alreadyRegistered: Boolean(existing),
    });
  } catch (err) {
    console.error("[Partner join] erreur:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
