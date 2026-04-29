import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const VALID_PLANS = ["free", "plus"] as const;
type Plan = (typeof VALID_PLANS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, plan } = body as { email?: string; plan?: string };

    if (!email || !plan) {
      return NextResponse.json(
        { success: false, message: "Email et plan requis" },
        { status: 400 }
      );
    }

    if (!VALID_PLANS.includes(plan as Plan)) {
      return NextResponse.json(
        { success: false, message: `Plan invalide. Valeurs autorisées : ${VALID_PLANS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify caller is authenticated
    const cookieStore = cookies();
    const supabaseUserClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // read-only — session check only
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 });
    }

    // Verify caller is admin
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });
    }

    // Lookup + update with service_role (bypasses RLS)
    const adminClient = createAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: targetProfile, error: lookupError } = await adminClient
      .from("profiles")
      .select("id, email, plan")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[admin/update-plan] lookup:", lookupError);
      return NextResponse.json({ success: false, message: "Erreur base de données" }, { status: 500 });
    }

    if (!targetProfile) {
      return NextResponse.json(
        { success: false, message: `Aucun utilisateur trouvé avec l'email ${normalizedEmail}` },
        { status: 404 }
      );
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ plan, daily_ai_count: 0 })
      .eq("id", targetProfile.id);

    if (updateError) {
      console.error("[admin/update-plan] update:", updateError);
      return NextResponse.json({ success: false, message: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Plan mis à jour : ${targetProfile.email} ${targetProfile.plan ?? "free"} → ${plan}`,
    });
  } catch (err) {
    console.error("[admin/update-plan] unexpected:", err);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
