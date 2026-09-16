import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

type Lang = "fr" | "en" | "de" | "es";

/** ⚠️ Même forme que les sept autres envois : une table par langue. */
const BIENVENUE: Record<Lang, string> = {
  fr: "Notifications activées 🎉",
  en: "Notifications enabled 🎉",
  de: "Benachrichtigungen aktiviert 🎉",
  es: "Notificaciones activadas 🎉",
};

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// Enregistre (ou met à jour) un abonnement push pour l'utilisateur connecté,
// puis envoie une notification de bienvenue pour confirmer que ça marche.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json()) as SubscribeBody;
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("[Push subscribe] Error:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  /**
   * Notification de bienvenue (best-effort), DANS LA LANGUE DU TRADER.
   *
   * ⚠️⚠️ ELLE ÉTAIT EN FRANÇAIS POUR TOUT LE MONDE. « Notifications activées 🎉 »
   * est la toute première notification qu'un utilisateur reçoit, et la seule
   * preuve qu'il obtient que ça marche. Dix-sept des vingt et un inscrits sont
   * anglophones.
   *
   * ⚠️ ET LES SEPT AUTRES ENVOIS DU PRODUIT TRADUISENT DÉJÀ : rappel de séance,
   * garde-série, calendrier économique, bilan hebdomadaire, perte du jour,
   * drawdown, alerte de tilt. Tous passent par une table par langue. Celui-ci
   * était le seul à ne pas le faire, et c'est le premier de tous.
   */
  const { data: profil } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .maybeSingle();
  const lang = ((profil?.language as Lang) in BIENVENUE ? (profil?.language as Lang) : "en");

  await sendPushToUser(user.id, {
    title: "TradeDiscipline",
    body: BIENVENUE[lang],
    url: "/dashboard",
    tag: "welcome",
  });

  return NextResponse.json({ ok: true });
}

// Supprime un abonnement (désactivation côté client).
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  /**
   * ⚠️⚠️ UNE SUPPRESSION NON VÉRIFIÉE MENT. Le client Supabase NE JETTE PAS :
   * son erreur se lit dans la réponse, ou pas du tout. Cette route répondait
   * `{ ok: true }` quoi qu'il arrive, donc l'écran affichait « notifications
   * désactivées » pendant que l'abonnement restait en base et que les rappels
   * continuaient d'arriver. C'est la règle déjà écrite dans ce dépôt et
   * appliquée ailleurs (annulations du coach, corrigées le 2026-08-26).
   */
  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (deleteError) {
    console.error("[Push unsubscribe] Error:", deleteError);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
