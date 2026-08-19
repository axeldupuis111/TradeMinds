import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAuth } from "@/lib/api-auth";
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  callbackUrl,
  oauthConfigured,
  type BrokerBrand,
} from "@/lib/sync/tradovate-oauth";

/**
 * Départ du parcours OAuth : redirige le trader vers l'écran de consentement
 * Tradovate. Il n'a que son login à saisir, aucune clé API à acheter.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Même porte que la création de connexion par clé API.
  if (auth.plan !== "premium") {
    return NextResponse.json({ error: "Premium plan required." }, { status: 403 });
  }

  if (!oauthConfigured()) {
    // Dire pourquoi, plutôt que de rediriger vers un écran Tradovate qui
    // répondrait « client_id inconnu » sans que personne ne comprenne.
    return NextResponse.json(
      { error: "Connexion Tradovate par login pas encore disponible : identifiants partenaires en attente." },
      { status: 503 },
    );
  }

  const env = req.nextUrl.searchParams.get("environment") === "demo" ? "demo" : "live";

  // ⚠️ `state` protège du CSRF : sans lui, un tiers peut faire aboutir un
  // callback et rattacher SON compte Tradovate au journal d'un trader connecté.
  // Il porte aussi l'environnement, que le callback ne peut pas deviner.
  const state = `${randomBytes(24).toString("hex")}.${env}`;

  // La marque ne change QUE l'habillage de l'écran de consentement : même
  // compte, même backend. Un utilisateur NinjaTrader envoyé sur une page
  // Tradovate croirait s'être trompé de bouton.
  const brand: BrokerBrand =
    req.nextUrl.searchParams.get("brand") === "ninjatrader" ? "ninjatrader" : "tradovate";

  const res = NextResponse.redirect(
    buildAuthorizeUrl({ redirectUri: callbackUrl(), state, brand }),
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // "strict" casserait le retour depuis le domaine Tradovate.
    path: "/",
    maxAge: 600, // dix minutes : le temps de se connecter, pas davantage.
  });
  return res;
}
