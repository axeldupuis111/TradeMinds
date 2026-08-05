import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncBrokerConnection,
  BROKER_CONNECTION_COLUMNS,
  type BrokerConnectionRow,
} from "@/lib/sync/broker-sync";
import { checkDailyLossAlert, checkDrawdownAlert } from "@/lib/alerts/daily-loss";
import { alertCronFailure } from "@/lib/cron-alert";

export const maxDuration = 300;

/**
 * On s'arrête avant la limite de la plateforme plutôt que de se faire couper au
 * milieu d'une connexion. Les connexions non traitées ne sont pas perdues : le
 * tri par ancienneté de synchro les remet en tête au passage suivant.
 */
const TIME_BUDGET_MS = 240_000;

// Vercel cron invokes routes with GET — delegate to POST.
export async function GET(req: Request) {
  return POST(req);
}

// Hourly cron: pull trades for every active API-based broker connection.
// Each connection records its own health (status / last_error) so one failing
// account never blocks the others.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Les connexions les plus anciennement synchronisées d'abord (jamais
  // synchronisées en tête) : si le budget de temps s'épuise, ce sont toujours
  // les plus en retard qui sont servies, et aucune ne peut être affamée.
  const { data: connections, error } = await admin
    .from("broker_connections")
    .select(BROKER_CONNECTION_COLUMNS)
    .eq("status", "active")
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[Broker Cron] list error:", error.message);
    await alertCronFailure("sync/brokers", `Could not list broker connections: ${error.message}`);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  let totalSynced = 0;
  let failed = 0;
  let processed = 0;

  const startedAt = Date.now();
  const all = (connections ?? []) as unknown as BrokerConnectionRow[];

  for (const conn of all) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.warn(
        `[Broker Cron] budget de temps atteint, ${all.length - processed} connexion(s) reportée(s) au passage suivant.`,
      );
      break;
    }
    processed++;
    try {
      const { synced, insertedNetPnl, challengeId } = await syncBrokerConnection(admin, conn);
      totalSynced += synced;

      // Alertes temps réel (perte journalière + drawdown) sur les nouveaux trades.
      if (insertedNetPnl < 0) {
        const { data: prof } = await admin
          .from("profiles")
          .select("language")
          .eq("id", conn.user_id)
          .single();
        const lang = (prof?.language as string) || "en";
        await checkDailyLossAlert(admin, conn.user_id, lang, insertedNetPnl);
        if (challengeId) {
          await checkDrawdownAlert(admin, conn.user_id, lang, challengeId, insertedNetPnl);
        }
      }
    } catch (err) {
      failed++;
      console.error(
        `[Broker Cron] ${conn.broker} ${conn.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({
    connections: all.length,
    processed,
    deferred: all.length - processed,
    synced: totalSynced,
    failed,
  });
}
