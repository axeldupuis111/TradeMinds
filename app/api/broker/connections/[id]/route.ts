import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { syncBrokerConnection, type BrokerConnectionRow } from "@/lib/sync/broker-sync";

// DELETE — remove a broker connection (synced trades are kept).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createClient();
  const { error } = await supabase.from("broker_connections").delete().eq("id", params.id);

  if (error) {
    console.error("[Broker connection DELETE]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH — pause/resume a connection, or trigger a manual sync.
//   { action: "pause" | "resume" | "sync" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const supabase = createClient();

  if (body.action === "pause" || body.action === "resume") {
    const status = body.action === "pause" ? "disabled" : "active";
    const { error } = await supabase
      .from("broker_connections")
      .update({ status, last_error: null })
      .eq("id", params.id);
    if (error) {
      console.error("[Broker connection PATCH]", error.message);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status });
  }

  if (body.action === "sync") {
    // RLS-scoped read confirms ownership, then sync with the admin client.
    const { data: conn, error } = await supabase
      .from("broker_connections")
      .select("id, user_id, broker, environment, credentials_encrypted, last_synced_at")
      .eq("id", params.id)
      .single();

    if (error || !conn) {
      return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
    }

    const admin = createAdminClient();
    try {
      const result = await syncBrokerConnection(admin, conn as BrokerConnectionRow);
      return NextResponse.json({ ok: true, synced: result.synced });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synchronisation impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
