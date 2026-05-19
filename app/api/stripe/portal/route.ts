import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    // 1. Authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 2. Récupération du profil + stripe_customer_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, plan")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // 3. Vérification que l'user a bien un Stripe customer
    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found. Please subscribe to a plan first." },
        { status: 400 }
      );
    }

    // 4. URL de retour après le portail
    const origin = req.headers.get("origin") || "https://www.tradediscipline.app";
    const returnUrl = `${origin}/dashboard`;

    // 5. Création de la Billing Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
      locale: "auto",
    });

    if (!session.url) {
      console.error("[Stripe Portal] No URL returned from Stripe session");
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
