import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBrokerConnection, type BrokerConnectionRow } from "@/lib/sync/broker-sync";

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

  const { data: connections, error } = await admin
    .from("broker_connections")
    .select("id, user_id, broker, environment, credentials_encrypted, last_synced_at")
    .eq("status", "active");

  if (error) {
    console.error("[Broker Cron] list error:", error.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  let totalSynced = 0;
  let failed = 0;

  for (const conn of (connections ?? []) as BrokerConnectionRow[]) {
    try {
      const { synced } = await syncBrokerConnection(admin, conn);
      totalSynced += synced;
    } catch (err) {
      failed++;
      console.error(
        `[Broker Cron] ${conn.broker} ${conn.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({
    connections: connections?.length ?? 0,
    synced: totalSynced,
    failed,
  });
}
