import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encryption";
import { SITE_URL } from "@/lib/seo";
import { OAUTH_STATE_COOKIE, callbackUrl, exchangeCode } from "@/lib/sync/tradovate-oauth";

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
  const brandLabel = parts.includes("ninjatrader") ? "NinjaTrader" : "Tradovate";

  try {
    const tokens = await exchangeCode({ code, redirectUri: callbackUrl(), env });

    const supabase = createClient();
    // Une seule connexion OAuth par environnement ET par marque : reconnecter
    // remplace les jetons au lieu d'empiler des lignes que le trader ne
    // distingue pas.
    //
    // Conséquence assumée : quelqu'un qui clique successivement sur les deux
    // boutons obtient deux lignes pour un seul compte, la clé d'unicité portant
    // sur le libellé. Les trades ne se dupliquent pas pour autant, la déduplication
    // se faisant sur `source` + `external_id` ; c'est seulement une synchro
    // redondante. Rendre cela impossible demanderait une migration de la
    // contrainte, ce qui ne se justifie pas pour un cas de figure aussi rare.
    const label = env === "demo" ? `${brandLabel} (démo)` : brandLabel;
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
