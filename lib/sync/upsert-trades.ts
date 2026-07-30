// Freeze-aware upsert for synced trades (pull rail). Mirrors the insert/update
// logic of the push handler: trades the user closed manually are never
// overwritten, and only sync-sourced fields are touched on re-sync so manual
// annotations (notes, emotion, tags, strategy_id, screenshots…) are preserved.

import type { SupabaseClient } from "@supabase/supabase-js";
import { purgeDemoData } from "@/lib/demo-data";

export interface SyncedTradeRow {
  user_id: string;
  pair: string;
  direction: "long" | "short";
  lot_size: number;
  entry_price: number;
  exit_price: number | null;
  open_time: string | null;
  close_time: string | null;
  pnl: number;
  commission?: number;
  swap?: number;
  status: "open" | "closed";
  source: string;
  external_id: string;
}

export async function upsertSyncedTrades(
  admin: SupabaseClient,
  userId: string,
  rows: SyncedTradeRow[],
  challengeId: string | null = null,
): Promise<{ synced: number; skipped: number; insertedNetPnl: number }> {
  if (rows.length === 0) return { synced: 0, skipped: 0, insertedNetPnl: 0 };

  // Des trades réels arrivent par la sync → la démo n'a plus de raison d'être.
  await purgeDemoData(admin, userId);

  const externalIds = rows.map((r) => r.external_id);
  const sources = Array.from(new Set(rows.map((r) => r.source)));

  // ── Drop trades the user closed manually (frozen) ─────────────────────────
  const { data: frozenRows } = await admin
    .from("trades")
    .select("external_id, source")
    .eq("user_id", userId)
    .in("source", sources)
    .eq("closed_manually", true)
    .in("external_id", externalIds);

  const frozenKeys = new Set(
    (frozenRows ?? []).map(
      (r: { external_id: string; source: string }) => `${r.source}:${r.external_id}`,
    ),
  );

  const active = rows.filter((r) => !frozenKeys.has(`${r.source}:${r.external_id}`));
  let skipped = rows.length - active.length;
  if (active.length === 0) return { synced: 0, skipped, insertedNetPnl: 0 };

  // ── Split insert (new) vs update (existing) ───────────────────────────────
  const { data: existingRows } = await admin
    .from("trades")
    .select("id, external_id, source")
    .eq("user_id", userId)
    .in("source", sources)
    .in("external_id", active.map((r) => r.external_id));

  const existingMap = new Map(
    (existingRows ?? []).map(
      (r: { id: string; external_id: string; source: string }) => [
        `${r.source}:${r.external_id}`,
        r.id,
      ],
    ),
  );

  const toInsert = active.filter((r) => !existingMap.has(`${r.source}:${r.external_id}`));
  const toUpdate = active.filter((r) => existingMap.has(`${r.source}:${r.external_id}`));

  let synced = 0;
  let insertedNetPnl = 0;

  if (toInsert.length > 0) {
    const insertPayload = challengeId
      ? toInsert.map((r) => ({ ...r, challenge_id: challengeId }))
      : toInsert;
    const { data: inserted, error } = await admin.from("trades").insert(insertPayload).select("id");
    if (error) {
      console.error("[Broker Sync] insert error:", error.message);
    } else {
      synced += inserted?.length ?? 0;
      insertedNetPnl = toInsert.reduce((s, r) => s + r.pnl + (r.commission || 0) + (r.swap || 0), 0);
    }
  }

  for (const row of toUpdate) {
    const id = existingMap.get(`${row.source}:${row.external_id}`)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id: _uid, source: _src, external_id: _eid, ...fields } = row;
    const { error } = await admin.from("trades").update(fields).eq("id", id);
    if (error) {
      console.error("[Broker Sync] update error:", error.message);
      skipped++;
      continue;
    }
    synced++;
  }

  return { synced, skipped, insertedNetPnl };
}
