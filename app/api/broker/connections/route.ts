import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import { encrypt } from "@/lib/crypto/encryption";
import { verifyTradovateCredentials } from "@/lib/sync/tradovate";
import { oauthConfigured } from "@/lib/sync/tradovate-oauth";

const SUPPORTED_BROKERS = ["tradovate"] as const;
type Broker = (typeof SUPPORTED_BROKERS)[number];

// La création ne fait plus qu'un aller-retour d'authentification, mais il passe
// par le serveur d'un broker : on laisse de la marge plutôt que de dépendre du
// délai par défaut de la plateforme.
export const maxDuration = 60;

// GET — list the user's broker connections (never returns secrets).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("broker_connections")
    .select(
      "id, broker, label, environment, status, last_synced_at, last_error, created_at, commission_per_contract",
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Broker connections GET]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // `tradovateOAuth` dit à l'interface s'il faut proposer la connexion par
  // simple login. Le client ne peut pas lire TRADOVATE_CLIENT_ID lui-même, et
  // afficher un bouton qui mènerait à un écran Tradovate répondant « client_id
  // inconnu » serait pire que de ne rien afficher.
  return NextResponse.json({ connections: data ?? [], tradovateOAuth: oauthConfigured() });
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

  const commissionRaw = Number(body.commission_per_contract ?? 0);
  const commission_per_contract =
    Number.isFinite(commissionRaw) && commissionRaw > 0 ? Math.min(commissionRaw, 100) : 0;

  // Les identifiants sont validés AVANT toute écriture : un seul appel réseau,
  // rapide, et surtout aucune ligne créée si le broker les refuse. C'est ce qui
  // évite qu'un échec laisse une connexion fantôme qui fait ensuite échouer
  // toutes les tentatives suivantes sur la contrainte d'unicité du nom.
  try {
    await verifyTradovateCredentials({ username, password, cid, sec }, environment);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connexion impossible";
    return NextResponse.json({ error: message }, { status: 400 });
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
      commission_per_contract,
      status: "active",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // 23505 = unique_violation (same broker + label already exists)
    if (insertErr?.code === "23505") {
      return NextResponse.json({ error: "Une connexion avec ce nom existe déjà." }, { status: 409 });
    }
    console.error("[Broker connections POST]", insertErr?.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // La première synchro (90 jours, un appel par contrat) est volontairement
  // laissée à une requête séparée : elle peut être longue, et son échec ne doit
  // plus pouvoir compromettre la création elle-même. Le client l'enchaîne, et
  // le cron horaire rattrape de toute façon si elle n'aboutit pas.
  return NextResponse.json({ id: inserted.id });
}
