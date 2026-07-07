import { createAdminClient } from "@/lib/supabase/admin";
import { validateUsername } from "@/lib/username-moderation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Modération admin des pseudos : renommer ou retirer le pseudo d'un
 * utilisateur (page interne /dashboard/admin, onglet Pseudos).
 *
 * - action "rename" : nouveau pseudo validé (format + termes interdits + unicité)
 * - action "clear"  : pseudo remis à null → l'utilisateur disparaît du
 *   classement (filtré sur username non null), des défis (fallback "Trader")
 *   et son profil public n'est plus accessible.
 */

type Action = "rename" | "clear";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      action?: Action;
      newUsername?: string;
    };
    const { username, action, newUsername } = body;

    if (!username || (action !== "rename" && action !== "clear")) {
      return NextResponse.json(
        { success: false, message: "Pseudo et action (rename/clear) requis" },
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

    const adminClient = createAdminClient();

    // Recherche insensible à la casse : d'anciens pseudos peuvent contenir
    // majuscules/espaces (saisis avant la validation systématique).
    const { data: target, error: lookupError } = await adminClient
      .from("profiles")
      .select("id, email, username")
      .ilike("username", username.trim())
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[admin/moderate-username] lookup:", lookupError);
      return NextResponse.json({ success: false, message: "Erreur base de données" }, { status: 500 });
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: `Aucun utilisateur avec le pseudo « ${username.trim()} »` },
        { status: 404 }
      );
    }

    if (action === "clear") {
      const { error } = await adminClient
        .from("profiles")
        .update({ username: null, public_profile: false })
        .eq("id", target.id);
      if (error) {
        console.error("[admin/moderate-username] clear:", error);
        return NextResponse.json({ success: false, message: "Erreur lors de la mise à jour" }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: `Pseudo « ${target.username} » retiré (${target.email}). L'utilisateur devra en choisir un nouveau.`,
      });
    }

    // action === "rename"
    const check = validateUsername(newUsername ?? "");
    if (!check.ok) {
      return NextResponse.json(
        {
          success: false,
          message: check.reason === "forbidden"
            ? "Le nouveau pseudo contient des termes interdits"
            : "Nouveau pseudo invalide (3-20 caractères : a-z, 0-9, -, _)",
        },
        { status: 400 }
      );
    }

    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", check.username)
      .neq("id", target.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Le pseudo « ${check.username} » est déjà pris` },
        { status: 409 }
      );
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ username: check.username })
      .eq("id", target.id);
    if (error) {
      console.error("[admin/moderate-username] rename:", error);
      return NextResponse.json({ success: false, message: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Pseudo renommé : « ${target.username} » → « ${check.username} » (${target.email})`,
    });
  } catch (err) {
    console.error("[admin/moderate-username] unexpected:", err);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
