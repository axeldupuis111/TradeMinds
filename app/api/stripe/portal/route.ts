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
        { code: "portal_err_auth", error: "Not authenticated" },
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
        { code: "portal_err_profile", error: "Profile not found" },
        { status: 404 }
      );
    }

    /**
     * ⚠️⚠️ CE REFUS EST LE PLUS FRÉQUENT DU PRODUIT, ET IL S'AFFICHAIT EN
     * ANGLAIS. Mesuré en base le 2026-09-18 : DIX des treize comptes payants
     * n'ont aucun client Stripe, leur accès ayant été ouvert à la main. Ce sont
     * donc dix abonnés premium à qui « Gérer mon abonnement » répond
     * « No Stripe customer found. Please subscribe to a plan first. » — un
     * message anglais, qui leur demande de souscrire alors qu'ils ont déjà
     * tout, et qui les envoie payer une deuxième fois.
     *
     * ⚠️ LA RÈGLE AVAIT ÉTÉ APPLIQUÉE À LA ROUTE JUMELLE LE MATIN MÊME
     * (`change-plan`, sept refus passés en codes traduisibles) et pas à
     * celle-ci : `code` = ce que le PRODUIT a écrit, donc traduisible ;
     * `error` = le message brut du prestataire, gardé pour les journaux.
     */
    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        {
          code: "portal_err_no_customer",
          error: "No Stripe customer found. Please subscribe to a plan first.",
        },
        { status: 400 }
      );
    }

    // 4. URL de retour après le portail
    const origin = req.headers.get("origin") || "https://tradediscipline.app";
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
        { code: "portal_err_server", error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return NextResponse.json(
      { code: "portal_err_server", error: "Internal server error" },
      { status: 500 }
    );
  }
}
