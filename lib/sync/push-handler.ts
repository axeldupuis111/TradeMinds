// Shared handler for the "push" sync rail: client software installed by the
// user (MetaTrader EA, cTrader cBot, NinjaTrader add-on) POSTs closed trades to
// an API route authenticated by the user's universal sync token.
//
// This module is platform-agnostic — the concrete trade `source` is carried in
// each trade's `source` field. Both /api/sync/mt (legacy) and /api/sync/push
// delegate here so installed EAs keep working while new bots use the new URL.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDailyLossAlert } from "@/lib/alerts/daily-loss";
import {
  mapSource,
  mapDirection,
  toIso,
  isValidTrade,
  type PushTrade,
} from "./push-parse";

interface RequestBody {
  token: string;
  trade?: PushTrade;
  trades?: PushTrade[];
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handlePushSync(req: NextRequest): Promise<NextResponse> {
  // ── Parse body ───────────────────────────────────────────────────────────
  // Read as raw text first, then parse. MetaTrader (MQL5) and some cBot/NinjaScript
  // HTTP clients send null-terminated C strings — a trailing \0 byte causes
  // req.json() to throw even though the payload is valid JSON.
  let body: RequestBody;
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide.", received: "(impossible de lire le corps)" },
      { status: 400 },
    );
  }

  // Strip null bytes and surrounding whitespace that non-browser clients may add
  const cleaned = raw.replace(/\0/g, "").trim();

  try {
    body = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide.", received: cleaned.slice(0, 200) || "(corps vide)" },
      { status: 400 },
    );
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token invalide." }, { status: 401 });
  }

  // ── Authenticate via mt_sync_token (the universal push token) ────────────
  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, plan, language")
    .eq("mt_sync_token", token)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Token invalide." }, { status: 401 });
  }

  if (profile.plan !== "premium") {
    return NextResponse.json({ error: "Premium plan required for auto-sync." }, { status: 403 });
  }

  const userId: string = profile.id;

  // ── Normalize trades input (single or array) ─────────────────────────────
  const rawTrades: unknown[] = [];
  if (Array.isArray(body.trades)) {
    rawTrades.push(...body.trades);
  } else if (body.trade && typeof body.trade === "object") {
    rawTrades.push(body.trade);
  }

  if (rawTrades.length === 0) {
    return NextResponse.json({ received: 0, synced: 0, skipped: 0 });
  }

  // ── Validate & map trades ────────────────────────────────────────────────
  const validTrades: PushTrade[] = [];
  let skipped = 0;

  for (const raw of rawTrades) {
    if (isValidTrade(raw)) {
      validTrades.push(raw);
    } else {
      skipped++;
    }
  }

  if (validTrades.length === 0) {
    return NextResponse.json({ received: rawTrades.length, synced: 0, skipped });
  }

  // ── Exclude trades manually closed by the user ───────────────────────────
  const externalIds = validTrades.map((t) => String(t.ticket));
  const distinctSources = Array.from(new Set(validTrades.map((t) => mapSource(t.source))));

  const { data: frozenRows, error: frozenErr } = await admin
    .from("trades")
    .select("external_id, source")
    .eq("user_id", userId)
    .in("source", distinctSources)
    .eq("closed_manually", true)
    .in("external_id", externalIds);

  if (frozenErr) {
    console.error("[Push Sync] frozen query error:", frozenErr.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  // Composite key "source:external_id" — ticket numbers are platform-specific,
  // so mt4 ticket 12345 and mt5 ticket 12345 are distinct trades.
  const frozenKeys = new Set(
    (frozenRows ?? []).map(
      (r: { external_id: string; source: string }) => `${r.source}:${r.external_id}`,
    ),
  );

  // ── Build rows for upsert ────────────────────────────────────────────────
  // IMPORTANT: only include sync-sourced fields. Omitting manual fields (notes,
  // emotion, tags, strategy_id, sl_initial, tp_initial, screenshot_path, etc.)
  // ensures they are never overwritten on re-sync.
  const rows = validTrades
    .filter((t) => !frozenKeys.has(`${mapSource(t.source)}:${String(t.ticket)}`))
    .map((t) => ({
      user_id: userId,
      pair: t.symbol.toUpperCase(),
      direction: mapDirection(t.direction) as "long" | "short",
      lot_size: t.volume,
      entry_price: t.open_price,
      exit_price: t.close_price,
      open_time: toIso(t.open_time),
      close_time: toIso(t.close_time),
      pnl: t.profit,
      commission: t.commission ?? 0,
      swap: t.swap ?? 0,
      sl: t.sl ?? null,
      tp: t.tp ?? null,
      status: "closed" as const,
      source: mapSource(t.source),
      external_id: String(t.ticket),
    }));

  if (rows.length === 0) {
    return NextResponse.json({
      received: rawTrades.length,
      synced: 0,
      skipped: skipped + validTrades.length, // all valid ones were frozen
    });
  }

  // ── Insert new / Update existing (two-step, partial-index safe) ─────────
  // The unique index on (user_id, source, external_id) is partial
  // (WHERE external_id IS NOT NULL), so PostgREST's ON CONFLICT cannot target
  // it. Instead we split into inserts (new tickets) and updates (existing
  // tickets whose sync-sourced fields may have changed).
  const rowExternalIds = rows.map((r) => r.external_id);
  const rowSources = Array.from(new Set(rows.map((r) => r.source)));

  const { data: existingRows } = await admin
    .from("trades")
    .select("id, external_id, source")
    .eq("user_id", userId)
    .in("source", rowSources)
    .in("external_id", rowExternalIds);

  const existingMap = new Map(
    (existingRows ?? []).map(
      (r: { id: string; external_id: string; source: string }) => [
        `${r.source}:${r.external_id}`,
        r.id,
      ],
    ),
  );

  const toInsert = rows.filter((r) => !existingMap.has(`${r.source}:${r.external_id}`));
  const toUpdate = rows.filter((r) => existingMap.has(`${r.source}:${r.external_id}`));

  let synced = 0;

  // Insert new trades
  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await admin
      .from("trades")
      .insert(toInsert)
      .select("id");

    if (insertErr) {
      console.error("[Push Sync] insert error:", insertErr.message);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement des trades." },
        { status: 500 },
      );
    }
    synced += inserted?.length ?? 0;
  }

  // Update existing trades (sync fields only)
  for (const row of toUpdate) {
    const tradeId = existingMap.get(`${row.source}:${row.external_id}`)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id: _uid, source: _src, external_id: _eid, ...updateFields } = row;
    const { error: updateErr } = await admin
      .from("trades")
      .update(updateFields)
      .eq("id", tradeId);

    if (updateErr) {
      console.error("[Push Sync] update error:", updateErr.message);
      continue; // Non-fatal: continue with remaining trades
    }
    synced++;
  }

  // ── Alerte temps réel : perte max journalière (module partagé) ───────────
  const batchNetPnl = toInsert.reduce(
    (s, r) => s + r.pnl + (r.commission || 0) + (r.swap || 0),
    0,
  );
  await checkDailyLossAlert(admin, userId, (profile.language as string) || "en", batchNetPnl);

  return NextResponse.json({ received: rawTrades.length, synced, skipped });
}
