import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { encrypt } from "@/lib/crypto/encryption";
import { syncBrokerConnection, type BrokerConnectionRow } from "@/lib/sync/broker-sync";

const SUPPORTED_BROKERS = ["tradovate"] as const;
type Broker = (typeof SUPPORTED_BROKERS)[number];

// GET — list the user's broker connections (never returns secrets).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("broker_connections")
    .select("id, broker, label, environment, status, last_synced_at, last_error, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Broker connections GET]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ connections: data ?? [] });
}

// POST — create a connection, verify credentials with an initial sync.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (auth.plan !== "premium") {
    return NextResponse.json({ error: "Premium plan required." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const broker = String(body.broker ?? "").trim().toLowerCase();
  if (!SUPPORTED_BROKERS.includes(broker as Broker)) {
    return NextResponse.json({ error: "Broker non supporté." }, { status: 400 });
  }

  const environment = body.environment === "demo" ? "demo" : "live";
  const label = String(body.label ?? "").trim() || `${broker} (${environment})`;

  // Tradovate credentials.
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const cid = String(body.cid ?? "").trim();
  const sec = String(body.sec ?? "").trim();

  if (!username || !password || !cid || !sec) {
    return NextResponse.json(
      { error: "Identifiants incomplets (username, password, cid, sec requis)." },
      { status: 400 },
    );
  }

  const credentials_encrypted = encrypt(JSON.stringify({ username, password, cid, sec }));

  // Insert with RLS (user_id enforced via auth.uid() default? — set explicitly).
  const supabase = createClient();
  const { data: inserted, error: insertErr } = await supabase
    .from("broker_connections")
    .insert({
      user_id: auth.userId,
      broker,
      label,
      environment,
      credentials_encrypted,
      status: "active",
    })
    .select("id, user_id, broker, environment, credentials_encrypted, last_synced_at")
    .single();

  if (insertErr || !inserted) {
    // 23505 = unique_violation (same broker + label already exists)
    if (insertErr?.code === "23505") {
      return NextResponse.json({ error: "Une connexion avec ce nom existe déjà." }, { status: 409 });
    }
    console.error("[Broker connections POST]", insertErr?.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // Verify credentials by running an initial sync. On failure, remove the row
  // so the user can retry cleanly instead of being left with an error state.
  const admin = createAdminClient();
  try {
    const result = await syncBrokerConnection(admin, inserted as BrokerConnectionRow);
    return NextResponse.json({ id: inserted.id, synced: result.synced });
  } catch (err) {
    await admin.from("broker_connections").delete().eq("id", inserted.id);
    const message = err instanceof Error ? err.message : "Connexion impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
