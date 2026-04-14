import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const METAAPI_TOKEN = process.env.METAAPI_TOKEN!;
const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

interface SyncBody {
  challengeId: string;
  metaapiAccountId: string;
}

interface MetaDeal {
  id: string;
  platform?: string;
  type: string; // DEAL_TYPE_BUY / DEAL_TYPE_SELL / DEAL_TYPE_BALANCE ...
  time: string;
  symbol?: string;
  volume?: number;
  price?: number;
  commission?: number;
  swap?: number;
  profit?: number;
  entryType?: string; // DEAL_ENTRY_IN / DEAL_ENTRY_OUT
  positionId?: string;
  orderId?: string;
}

async function fetchAccountInfo(accountId: string) {
  const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    headers: { "auth-token": METAAPI_TOKEN },
  });
  if (!res.ok) throw new Error(`Failed to fetch MetaApi account: ${await res.text()}`);
  return res.json();
}

async function fetchDeals(accountId: string, region: string, startISO: string, endISO: string): Promise<MetaDeal[]> {
  const base = `https://mt-client-api-v1.${region}.agiliumtrade.agiliumtrade.ai`;
  const url = `${base}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(startISO)}/${encodeURIComponent(endISO)}`;
  const res = await fetch(url, {
    headers: { "auth-token": METAAPI_TOKEN },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MetaApi history-deals error: ${errText}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  if (!METAAPI_TOKEN) {
    return NextResponse.json({ error: "METAAPI_TOKEN not configured" }, { status: 500 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { challengeId, metaapiAccountId } = body;
  if (!challengeId || !metaapiAccountId) {
    return NextResponse.json({ error: "Missing challengeId or metaapiAccountId" }, { status: 400 });
  }

  // Verify ownership of challenge
  const { data: challenge } = await supabase
    .from("prop_challenges")
    .select("id, user_id, last_sync_at")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  try {
    const account = await fetchAccountInfo(metaapiAccountId);
    const region = account.region || "new-york";

    // Start from last sync or 90 days ago
    const since = challenge.last_sync_at
      ? new Date(challenge.last_sync_at)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const until = new Date();

    const deals = await fetchDeals(metaapiAccountId, region, since.toISOString(), until.toISOString());

    // Group deals by positionId → build trades (IN = open, OUT = close)
    const byPosition: Record<string, { opens: MetaDeal[]; closes: MetaDeal[] }> = {};
    for (const d of deals) {
      if (!d.positionId) continue;
      if (d.type !== "DEAL_TYPE_BUY" && d.type !== "DEAL_TYPE_SELL") continue;
      if (!byPosition[d.positionId]) byPosition[d.positionId] = { opens: [], closes: [] };
      if (d.entryType === "DEAL_ENTRY_IN") byPosition[d.positionId].opens.push(d);
      else if (d.entryType === "DEAL_ENTRY_OUT" || d.entryType === "DEAL_ENTRY_INOUT") {
        byPosition[d.positionId].closes.push(d);
      }
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const [posId, { opens, closes }] of Object.entries(byPosition)) {
      if (opens.length === 0 || closes.length === 0) continue;
      const open = opens[0];
      const close = closes[closes.length - 1];
      const totalCommission = [...opens, ...closes].reduce((s, d) => s + (d.commission || 0), 0);
      const totalSwap = closes.reduce((s, d) => s + (d.swap || 0), 0);
      const totalProfit = closes.reduce((s, d) => s + (d.profit || 0), 0);
      const direction = open.type === "DEAL_TYPE_BUY" ? "long" : "short";

      rows.push({
        user_id: user.id,
        challenge_id: challengeId,
        external_deal_id: posId,
        open_time: open.time,
        close_time: close.time,
        pair: open.symbol || "UNKNOWN",
        direction,
        lot_size: open.volume || 0,
        entry_price: open.price || 0,
        exit_price: close.price || 0,
        commission: totalCommission,
        swap: totalSwap,
        pnl: totalProfit,
      });
    }

    let inserted = 0;
    if (rows.length > 0) {
      // Use upsert on external_deal_id to skip duplicates
      const { data, error } = await supabase
        .from("trades")
        .upsert(rows, { onConflict: "external_deal_id", ignoreDuplicates: true })
        .select("id");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      inserted = data?.length || 0;
    }

    await supabase
      .from("prop_challenges")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", challengeId);

    return NextResponse.json({
      imported: inserted,
      totalDealsFetched: deals.length,
      positionsProcessed: Object.keys(byPosition).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
