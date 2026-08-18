import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import {
  syncBrokerConnection,
  BROKER_CONNECTION_COLUMNS,
  type BrokerConnectionRow,
} from "@/lib/sync/broker-sync";
import { manualSyncWaitMs, waitSeconds } from "@/lib/sync/sync-cooldown";

// Une synchro manuelle rejoue jusqu'à 90 jours de fills avec un appel par
// contrat : c'est la route lente du rail, elle a besoin de marge.
export const maxDuration = 60;

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

// PATCH — pause/resume a connection, trigger a manual sync, or set the
// commission rate.
//   { action: "pause" | "resume" | "sync" | "commission" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { action?: string; commission_per_contract?: unknown };
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

  if (body.action === "commission") {
    const raw = Number(body.commission_per_contract);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      return NextResponse.json({ error: "Commission invalide." }, { status: 400 });
    }
    const { error } = await supabase
      .from("broker_connections")
      .update({ commission_per_contract: raw })
      .eq("id", params.id);
    if (error) {
      console.error("[Broker connection PATCH commission]", error.message);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    // Le taux ne vaut que pour les synchros à venir : les trades déjà importés
    // gardent les frais calculés au moment où ils sont arrivés.
    return NextResponse.json({ ok: true, commission_per_contract: raw });
  }

  if (body.action === "sync") {
    // RLS-scoped read confirms ownership, then sync with the admin client.
    const { data: conn, error } = await supabase
      .from("broker_connections")
      .select(BROKER_CONNECTION_COLUMNS)
      .eq("id", params.id)
      .single();

    if (error || !conn) {
      return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
    }

    // Même délai d'attente que la synchro depuis « Mes Trades ». Sans lui, le
    // garde-fou serait contournable en revenant simplement dans les réglages.
    const wait = manualSyncWaitMs((conn as { last_synced_at: string | null }).last_synced_at);
    if (wait > 0) {
      return NextResponse.json(
        { error: "sync_cooldown", retryInSeconds: waitSeconds(wait) },
        { status: 429 },
      );
    }

    const admin = createAdminClient();
    try {
      const result = await syncBrokerConnection(admin, conn as unknown as BrokerConnectionRow);
      return NextResponse.json({ ok: true, synced: result.synced });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synchronisation impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
