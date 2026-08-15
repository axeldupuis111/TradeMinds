import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encryption";
import { OAUTH_STATE_COOKIE, callbackUrl, exchangeCode } from "@/lib/sync/tradovate-oauth";

/**
 * Retour de l'écran de consentement Tradovate : on échange le code contre des
 * jetons et on crée la connexion. Le trader n'a jamais vu de clé API.
 */

export const dynamic = "force-dynamic";

/** Where to send the trader back, with a readable outcome. */
function back(req: NextRequest, params: Record<string, string>): NextResponse {
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = new URL("/dashboard/settings", base.replace(/\/$/, ""));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  // Le state a servi, il ne doit pas pouvoir resservir.
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const params = req.nextUrl.searchParams;

  // Refus explicite du trader sur l'écran de consentement : ce n'est pas une
  // erreur, on le ramène sans rien écrire ni l'alarmer.
  if (params.get("error")) {
    return back(req, { tradovate: "cancelled" });
  }

  const code = params.get("code");
  const state = params.get("state");
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // ⚠️ Sans cette comparaison, un tiers peut rattacher SON compte Tradovate au
  // journal d'un trader connecté en lui faisant ouvrir un lien.
  if (!code || !state || !expected || state !== expected) {
    return back(req, { tradovate: "state_mismatch" });
  }

  // L'environnement voyage dans le state : le callback ne peut pas le deviner,
  // et le lire depuis l'URL le rendrait falsifiable.
  const env = state.endsWith(".demo") ? "demo" : "live";

  try {
    const tokens = await exchangeCode({ code, redirectUri: callbackUrl(new URL(req.url).origin), env });

    const supabase = createClient();
    // Une seule connexion OAuth par environnement : reconnecter remplace les
    // jetons au lieu d'empiler des lignes que le trader ne distingue pas.
    const label = env === "demo" ? "Tradovate (démo)" : "Tradovate";
    const { error } = await supabase
      .from("broker_connections")
      .upsert(
        {
          user_id: auth.userId,
          broker: "tradovate",
          label,
          environment: env,
          credentials_encrypted: encrypt(JSON.stringify(tokens)),
          status: "active",
          last_error: null,
        },
        { onConflict: "user_id,broker,label" },
      );

    if (error) {
      console.error("[Tradovate OAuth] upsert:", error.message);
      return back(req, { tradovate: "save_failed" });
    }

    return back(req, { tradovate: "connected" });
  } catch (e) {
    // Le message porte souvent la cause exacte côté Tradovate (client_id
    // inconnu, redirect_uri non déclaré) : le journaliser entier, c'est ce qui
    // fera gagner une heure au premier essai avec les vrais identifiants.
    console.error("[Tradovate OAuth] échange du code:", e instanceof Error ? e.message : e);
    return back(req, { tradovate: "exchange_failed" });
  }
}
