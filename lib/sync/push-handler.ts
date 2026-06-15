// Shared handler for the "push" sync rail: client software installed by the
// user (MetaTrader EA, cTrader cBot, NinjaTrader add-on) POSTs closed trades to
// an API route authenticated by the user's universal sync token.
//
// This module is platform-agnostic — the concrete trade `source` is carried in
// each trade's `source` field. Both /api/sync/mt (legacy) and /api/sync/push
// delegate here so installed EAs keep working while new bots use the new URL.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ───────────────────────────────────────────────────────────────────

/** All platforms that push trades through this rail. */
export type PushSource = "mt4" | "mt5" | "ctrader" | "ninjatrader";

/** Fields sent by the client software for each closed trade. */
export interface PushTrade {
  ticket: number | string;
  symbol: string;
  direction: string; // "buy" | "sell" | "long" | "short" (case-insensitive)
  volume: number;
  open_price: number;
  close_price: number;
  open_time: string | number; // ISO 8601 or Unix timestamp
  close_time: string | number;
  profit: number;
  commission?: number;
  swap?: number;
  sl?: number | null;
  tp?: number | null;
  source?: string; // platform identifier (defaults to "mt5")
}

interface RequestBody {
  token: string;
  trade?: PushTrade;
  trades?: PushTrade[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KNOWN_SOURCES: readonly PushSource[] = ["mt4", "mt5", "ctrader", "ninjatrader"];

/**
 * Validate and normalize the source field. Defaults to "mt5" so legacy EAs that
 * never send a source keep working.
 */
function mapSource(val: unknown): PushSource {
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if ((KNOWN_SOURCES as readonly string[]).includes(v)) return v as PushSource;
  }
  return "mt5";
}

function mapDirection(val: string): "long" | "short" | null {
  const v = val.trim().toLowerCase();
  if (v === "buy" || v === "long") return "long";
  if (v === "sell" || v === "short") return "short";
  return null;
}

/**
 * Convert a time value to ISO 8601 string.
 * Accepts: ISO string, Unix seconds (number), or Unix seconds as string.
 */
function toIso(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;

  // If it's a number or a numeric string → treat as Unix seconds
  const asNum = typeof value === "number" ? value : Number(value);
  if (!isNaN(asNum) && asNum > 1_000_000_000) {
    // Distinguish seconds from milliseconds (threshold: year ~2001 in seconds)
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return new Date(ms).toISOString();
  }

  // Otherwise try parsing as date string
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isValidTrade(t: unknown): t is PushTrade {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;

  const hasTicket =
    (typeof o.ticket === "number" && !isNaN(o.ticket)) ||
    (typeof o.ticket === "string" && o.ticket.trim() !== "");
  if (!hasTicket) return false;
  if (!o.symbol || typeof o.symbol !== "string" || o.symbol.trim() === "") return false;
  if (!o.direction || typeof o.direction !== "string") return false;
  if (mapDirection(o.direction as string) === null) return false;
  if (typeof o.volume !== "number" || o.volume <= 0) return false;
  if (typeof o.open_price !== "number" || o.open_price <= 0) return false;
  if (typeof o.close_price !== "number" || o.close_price <= 0) return false;
  if (!toIso(o.open_time as string | number)) return false;
  if (!toIso(o.close_time as string | number)) return false;

  return true;
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
    .select("id, plan")
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

  return NextResponse.json({ received: rawTrades.length, synced, skipped });
}
