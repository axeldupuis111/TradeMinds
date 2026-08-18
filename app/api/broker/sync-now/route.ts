import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import {
  syncBrokerConnection,
  BROKER_CONNECTION_COLUMNS,
  type BrokerConnectionRow,
} from "@/lib/sync/broker-sync";
import { manualSyncWaitMs, waitSeconds } from "@/lib/sync/sync-cooldown";

/**
 * Synchro à la demande de TOUTES les connexions actives du trader.
 *
 * Le bouton des réglages agit connexion par connexion, ce qui a du sens quand
 * on administre ses rails. Depuis « Mes Trades », personne ne pense en
 * connexions : on veut voir ses trades. Cette route fait donc le tour de ce que
 * l'utilisateur possède, en une seule requête.
 *
 * ⚠️ Chaque connexion porte son propre délai d'attente. Sans cela, un clic
 * répété rejouerait 90 jours d'exécutions et un appel par contrat, autant de
 * fois que l'utilisateur est impatient, sur un débit Tradovate partagé entre
 * tous nos utilisateurs.
 */

// Une synchro manuelle est la route lente du rail, et on peut en enchaîner
// plusieurs. Le budget interne s'arrête avant, pour rendre un résultat partiel
// plutôt que de se faire couper.
export const maxDuration = 60;
const TIME_BUDGET_MS = 45_000;

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createClient();
  // Lecture sous RLS : on ne voit que ses propres connexions, la propriété est
  // donc garantie sans filtre explicite sur user_id.
  const { data, error } = await supabase
    .from("broker_connections")
    .select(BROKER_CONNECTION_COLUMNS)
    .eq("status", "active")
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[Sync now] list error:", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const connections = (data ?? []) as unknown as BrokerConnectionRow[];
  if (connections.length === 0) {
    return NextResponse.json({ ok: true, connections: 0, synced: 0, throttled: 0 });
  }

  const now = Date.now();
  const admin = createAdminClient();
  const startedAt = Date.now();

  let synced = 0;
  let failed = 0;
  let throttled = 0;
  let soonestWaitMs = Number.POSITIVE_INFINITY;

  for (const conn of connections) {
    const wait = manualSyncWaitMs(conn.last_synced_at, now);
    if (wait > 0) {
      throttled++;
      soonestWaitMs = Math.min(soonestWaitMs, wait);
      continue;
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    try {
      const result = await syncBrokerConnection(admin, conn);
      synced += result.synced;
    } catch (err) {
      // Une connexion en échec marque son propre statut dans syncBrokerConnection.
      // Elle ne doit pas empêcher les autres d'aboutir.
      failed++;
      console.error(
        `[Sync now] ${conn.broker} ${conn.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    connections: connections.length,
    synced,
    failed,
    throttled,
    // Ce que l'interface affiche quand tout est en attente : « réessaie dans
    // N secondes » vaut mieux qu'un bouton qui ne fait rien.
    retryInSeconds:
      throttled === connections.length && Number.isFinite(soonestWaitMs)
        ? waitSeconds(soonestWaitMs)
        : 0,
  });
}
