import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encryption";
import { SITE_URL } from "@/lib/seo";
import {
  OAUTH_STATE_COOKIE,
  callbackUrl,
  exchangeCode,
  oauthConnectionLabel,
  oauthConnectionLabels,
} from "@/lib/sync/tradovate-oauth";

/**
 * Retour de l'écran de consentement Tradovate : on échange le code contre des
 * jetons et on crée la connexion. Le trader n'a jamais vu de clé API.
 */

export const dynamic = "force-dynamic";

/** Where to send the trader back, with a readable outcome. */
function back(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/dashboard/settings", SITE_URL);
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

  // L'environnement et la marque voyagent dans le state : le callback ne peut
  // pas les deviner, et les lire depuis l'URL les rendrait falsifiables.
  const parts = state.split(".");
  const env = parts.includes("demo") ? "demo" : "live";

  // ⚠️ Le libellé suit la marque sur laquelle le trader a cliqué, pas le nom du
  // backend. NinjaTrader Brokerage et Tradovate sont un seul compte, mais
  // quelqu'un qui vient de s'identifier sur un écran NinjaTrader ne doit pas
  // voir apparaître une ligne « Tradovate » dans sa liste : il croirait avoir
  // connecté autre chose que ce qu'il visait.
  //
  // Le repli couvre les parcours ouverts avant l'ajout de la marque, dont le
  // state ne portait que l'environnement.
  const brand = parts.includes("ninjatrader") ? "ninjatrader" : "tradovate";

  try {
    const tokens = await exchangeCode({ code, redirectUri: callbackUrl(), env });

    const supabase = createClient();

    // ⚠️ UNE SEULE CONNEXION PAR ENVIRONNEMENT, QUELLE QUE SOIT LA PORTE.
    //
    // Tradovate et NinjaTrader sont le même compte. La contrainte d'unicité
    // porte sur le libellé, or « Tradovate (démo) » et « NinjaTrader (démo) »
    // en sont deux : un `upsert` créait donc une seconde ligne pour le même
    // compte dès qu'on essayait l'autre bouton. Ce n'est pas un cas rare, c'est
    // ce que fait le premier utilisateur qui découvre les deux.
    //
    // On cherche donc d'abord une connexion OAuth existante sur cet
    // environnement, sans regarder la marque, et on la remplace. Les libellés
    // testés sont exactement ceux que cette route écrit : une connexion par clé
    // API, nommée librement par le trader, n'est jamais touchée.
    const label = oauthConnectionLabel(env, brand);

    const { data: existing } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("broker", "tradovate")
      .eq("environment", env)
      .in("label", oauthConnectionLabels(env))
      .limit(1)
      .maybeSingle();

    const row = {
      user_id: auth.userId,
      broker: "tradovate",
      label,
      environment: env,
      credentials_encrypted: encrypt(JSON.stringify(tokens)),
      status: "active",
      last_error: null,
    };

    // Le libellé suit la marque du dernier parcours : reconnecter depuis
    // NinjaTrader renomme la ligne, plutôt que d'en ajouter une.
    const { error } = existing
      ? await supabase
          .from("broker_connections")
          .update(row)
          .eq("id", existing.id)
          .eq("user_id", auth.userId)
      : await supabase.from("broker_connections").insert(row);

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
