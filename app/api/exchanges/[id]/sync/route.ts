import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { decrypt } from "@/lib/crypto/encryption";
import { aggregateFills, type BinanceFill } from "@/lib/sync/binance-aggregate";
import { createHmac } from "crypto";

// Allow up to 60 s on Vercel Pro (Hobby caps at 10 s regardless).
export const maxDuration = 60;

// ─── Constants ────────────────────────────────────────────────────────────────

const FAPI = "https://fapi.binance.com";
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_30D = 30 * 24 * 60 * 60 * 1000;

// ─── Binance signed requests ─────────────────────────────────────────────────

function signedUrl(
  path: string,
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const full: Record<string, string | number> = {
    ...params,
    recvWindow: 60000,
    timestamp: Date.now(),
  };
  const qs = Object.entries(full)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const sig = createHmac("sha256", apiSecret).update(qs).digest("hex");
  return `${FAPI}${path}?${qs}&signature=${sig}`;
}

interface BinanceRes<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: number;
}

async function binanceGet<T = unknown>(
  path: string,
  params: Record<string, string | number>,
  apiKey: string,
  apiSecret: string,
): Promise<BinanceRes<T>> {
  const url = signedUrl(path, params, apiSecret);

  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-MBX-APIKEY": apiKey } });
  } catch {
    return { ok: false, error: "Impossible de contacter Binance." };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { code?: number }).code;
    const msg = (body as { msg?: string }).msg || "Erreur inconnue";

    if (code === -2015 || code === -2008)
      return { ok: false, code, error: "Clé API invalide ou permissions insuffisantes." };
    if (code === -2014)
      return { ok: false, code, error: "Clé API mal formée." };
    if (code === -1003 || code === -1015)
      return { ok: false, code, error: "Rate limit Binance. Réessaie dans quelques secondes." };
    if (code === -1021)
      return { ok: false, code, error: "Décalage d'horloge avec Binance. Réessaie." };
    return { ok: false, code, error: `Erreur Binance (${code}): ${msg}` };
  }

  return { ok: true, data: (await res.json()) as T };
}

// ─── Step 1 — discover traded symbols ─────────────────────────────────────────
// /fapi/v1/userTrades requires a symbol, so we first list symbols that had any
// activity (income records) or that have an open position (/fapi/v2/account).

async function discoverSymbols(
  apiKey: string,
  apiSecret: string,
  startMs: number,
  endMs: number,
): Promise<BinanceRes<string[]>> {
  const symbols = new Set<string>();

  // 1. Income records — captures every symbol with any activity (PnL,
  //    commissions, funding, transfers…). Max 30 days per call.
  let cursor = startMs;
  while (cursor < endMs) {
    const windowEnd = Math.min(cursor + MS_30D, endMs);
    const res = await binanceGet<{ symbol?: string; time: number }[]>(
      "/fapi/v1/income",
      { startTime: cursor, endTime: windowEnd, limit: 1000 },
      apiKey,
      apiSecret,
    );
    if (!res.ok) return { ok: false, error: res.error, code: res.code };

    const records = res.data!;
    for (const r of records) {
      if (r.symbol) symbols.add(r.symbol);
    }

    // Paginate if we hit the 1 000 record cap
    if (records.length < 1000) break;
    cursor = records[records.length - 1].time + 1;
  }

  // 2. Account positions — catches open positions with no recent income
  const acc = await binanceGet<{
    positions?: { symbol: string; positionAmt: string }[];
  }>("/fapi/v2/account", {}, apiKey, apiSecret);

  if (acc.ok && acc.data?.positions) {
    for (const p of acc.data.positions) {
      if (parseFloat(p.positionAmt) !== 0) symbols.add(p.symbol);
    }
  }
  // If account call fails, we still have income symbols — don't hard-fail

  return { ok: true, data: Array.from(symbols) };
}

// ─── Step 2 — fetch fills for one symbol (7-day windows) ─────────────────────

async function fetchSymbolFills(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  startMs: number,
  endMs: number,
): Promise<BinanceRes<BinanceFill[]>> {
  const fills: BinanceFill[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const windowEnd = Math.min(cursor + MS_7D, endMs);
    const res = await binanceGet<BinanceFill[]>(
      "/fapi/v1/userTrades",
      { symbol, startTime: cursor, endTime: windowEnd, limit: 1000 },
      apiKey,
      apiSecret,
    );
    if (!res.ok) return { ok: false, error: `${symbol}: ${res.error}` };
    fills.push(...res.data!);
    cursor = windowEnd;
  }

  return { ok: true, data: fills };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // ── Fetch connection (RLS-scoped to this user) ──────────────────────────
  const supabase = await createClient();
  const { data: conn, error: connErr } = await supabase
    .from("exchange_connections")
    .select("id, exchange, api_key_encrypted, api_secret_encrypted")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (connErr || !conn) {
    return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
  }

  if (conn.exchange !== "binance") {
    return NextResponse.json(
      { error: `La synchronisation ${conn.exchange} n'est pas encore supportée.` },
      { status: 400 },
    );
  }

  // ── Decrypt credentials ─────────────────────────────────────────────────
  let apiKey: string;
  let apiSecret: string;
  try {
    apiKey = decrypt(conn.api_key_encrypted);
    apiSecret = decrypt(conn.api_secret_encrypted);
  } catch {
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_error: "Impossible de déchiffrer les identifiants." })
      .eq("id", conn.id);
    return NextResponse.json(
      { error: "Erreur de déchiffrement. Supprime et recrée la connexion." },
      { status: 500 },
    );
  }

  const now = Date.now();
  const startMs = now - MS_30D;

  // ── Step 1: discover symbols ────────────────────────────────────────────
  const disc = await discoverSymbols(apiKey, apiSecret, startMs, now);
  if (!disc.ok) {
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_error: disc.error! })
      .eq("id", conn.id);
    return NextResponse.json({ error: disc.error }, { status: 502 });
  }

  const symbols = disc.data!;

  if (symbols.length === 0) {
    await supabase
      .from("exchange_connections")
      .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
    return NextResponse.json({ synced: 0, inserted: 0, open: 0, status: "active" });
  }

  // ── Step 2: fetch fills for each symbol ─────────────────────────────────
  const allFills: BinanceFill[] = [];
  const errors: string[] = [];

  for (const symbol of symbols) {
    const res = await fetchSymbolFills(apiKey, apiSecret, symbol, startMs, now);
    if (!res.ok) {
      console.error(`[sync] ${symbol}:`, res.error);
      errors.push(res.error!);
      continue; // partial sync — continue with other symbols
    }
    allFills.push(...res.data!);
  }

  // If every symbol failed, report error
  if (allFills.length === 0 && errors.length > 0) {
    const errMsg = errors[0];
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_error: errMsg })
      .eq("id", conn.id);
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  // ── Step 3: aggregate fills → positions ─────────────────────────────────
  const positions = aggregateFills(allFills);
  const closedCount = positions.filter((p) => p.status === "closed").length;
  const openCount = positions.length - closedCount;

  if (positions.length === 0) {
    await supabase
      .from("exchange_connections")
      .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
    return NextResponse.json({ synced: 0, inserted: 0, open: 0, status: "active" });
  }

  // ── Step 4: map to trades table format ──────────────────────────────────
  // IMPORTANT: only include sync-sourced fields in the row. PostgREST's
  // ON CONFLICT DO UPDATE only touches columns present in the payload, so
  // omitting manual fields (strategy_id, challenge_id, sl, tp, swap, notes,
  // emotion, tags, screenshot_path, ict_*, etc.) ensures they are never
  // overwritten when an existing row is updated (e.g. open → closed).
  const rows = positions.map((pos) => ({
    user_id: userId,
    open_time: pos.open_time,
    close_time: pos.close_time,
    pair: pos.pair,
    direction: pos.direction,
    lot_size: pos.lot_size,
    entry_price: pos.entry_price,
    exit_price: pos.exit_price ?? 0,  // trades table uses 0 for "no exit yet"
    commission: pos.commission,
    pnl: pos.pnl,
    status: pos.status,               // "open" | "closed"
    source: "binance" as const,
    external_id: pos.external_id,
  }));

  // ── Step 5: upsert via service role (bypasses RLS) ──────────────────────
  // On conflict (user_id, source, external_id) → UPDATE the sync fields only.
  // Manual fields (strategy_id, sl, tp, notes, emotion, tags…) are NOT in the
  // payload, so PostgREST's DO UPDATE SET clause won't touch them.
  const admin = createAdminClient();

  // Guard: never overwrite trades the user has manually closed.
  // A trade with closed_manually = true is frozen from the sync's perspective.
  const { data: frozenRows } = await admin
    .from("trades")
    .select("external_id")
    .eq("user_id", userId)
    .eq("source", "binance")
    .eq("closed_manually", true)
    .not("external_id", "is", null);

  const frozenIds = new Set(
    (frozenRows ?? []).map((r: { external_id: string }) => r.external_id),
  );
  const upsertRows = rows.filter((r) => !frozenIds.has(r.external_id));

  if (upsertRows.length === 0) {
    await supabase
      .from("exchange_connections")
      .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
    return NextResponse.json({
      synced: positions.length,
      inserted: 0,
      open: openCount,
      status: "active",
    });
  }

  const { data: upserted, error: upsertErr } = await admin
    .from("trades")
    .upsert(upsertRows, { onConflict: "user_id,source,external_id" })
    .select("id");

  if (upsertErr) {
    console.error("[sync] upsert error:", upsertErr.message);
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_error: `Insertion: ${upsertErr.message}` })
      .eq("id", conn.id);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des trades." },
      { status: 500 },
    );
  }

  const insertedCount = upserted?.length ?? 0;

  // ── Step 6: mark connection healthy ─────────────────────────────────────
  await supabase
    .from("exchange_connections")
    .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null })
    .eq("id", conn.id);

  return NextResponse.json({
    synced: positions.length,
    inserted: insertedCount,
    open: openCount,
    status: "active",
  });
}
