import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

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

  // Notification de bienvenue (best-effort).
  await sendPushToUser(user.id, {
    title: "TradeDiscipline",
    body: "Notifications activées 🎉",
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

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
