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
  type: string;
  time: string;
  symbol?: string;
  volume?: number;
  price?: number;
  commission?: number;
  swap?: number;
  profit?: number;
  entryType?: string;
  positionId?: string;
  orderId?: string;
}

export async function POST(req: Request) {
  const debug: string[] = [];
  const log = (msg: string) => {
    console.log("[metaapi/sync]", msg);
    debug.push(msg);
  };

  if (!METAAPI_TOKEN) {
    return NextResponse.json({ error: "METAAPI_TOKEN not configured", debug }, { status: 500 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated", debug }, { status: 401 });

  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", debug }, { status: 400 });
  }

  const { challengeId, metaapiAccountId } = body;
  log(`Received challengeId=${challengeId} metaapiAccountId=${metaapiAccountId}`);

  if (!challengeId || !metaapiAccountId) {
    return NextResponse.json({ error: "Missing challengeId or metaapiAccountId", debug }, { status: 400 });
  }

  const { data: challenge } = await supabase
    .from("prop_challenges")
    .select("id, user_id, last_sync_at, start_date")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found", debug }, { status: 404 });
  }
  log(`Challenge found start_date=${challenge.start_date} last_sync_at=${challenge.last_sync_at}`);

  try {
    // 1. Fetch account info and verify deployment
    const accountUrl = `${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}`;
    log(`GET ${accountUrl}`);
    const accountRes = await fetch(accountUrl, { headers: { "auth-token": METAAPI_TOKEN } });
    const accountText = await accountRes.text();
    log(`Account status=${accountRes.status} body=${accountText.slice(0, 500)}`);
    if (!accountRes.ok) {
      return NextResponse.json({ error: `Account fetch failed: ${accountText}`, debug }, { status: 500 });
    }
    const account = JSON.parse(accountText);
    const state = account.state || account.connectionStatus;
    const region = account.region || null;
    log(`Account state=${state} region=${region || "(none)"}`);

    if (state && state !== "DEPLOYED") {
      log(`Account not DEPLOYED (state=${state}), triggering deploy`);
      const deployRes = await fetch(`${accountUrl}/deploy`, {
        method: "POST",
        headers: { "auth-token": METAAPI_TOKEN },
      });
      log(`Deploy trigger status=${deployRes.status}`);
      return NextResponse.json({
        error: `Account is ${state}. Deployment triggered. Retry sync in 30-60s.`,
        debug,
      }, { status: 409 });
    }

    // 2. Compute time range: from challenge start (or 1 year ago) to now
    const startFallback = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const since = challenge.last_sync_at
      ? new Date(challenge.last_sync_at)
      : challenge.start_date
        ? new Date(challenge.start_date)
        : startFallback;
    const until = new Date();
    log(`Time range: ${since.toISOString()} -> ${until.toISOString()}`);

    // 3. Try regional base first, fallback to generic
    const bases: string[] = [];
    if (region) bases.push(`https://mt-client-api-v1.${region}.agiliumtrade.agiliumtrade.ai`);
    bases.push("https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai");
    bases.push("https://mt-client-api-v1.new-york.agiliumtrade.agiliumtrade.ai");
    bases.push("https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai");

    let deals: MetaDeal[] | null = null;
    let lastError = "";
    for (const base of bases) {
      const url = `${base}/users/current/accounts/${metaapiAccountId}/history-deals/time/${encodeURIComponent(since.toISOString())}/${encodeURIComponent(until.toISOString())}`;
      log(`GET ${url}`);
      try {
        const res = await fetch(url, { headers: { "auth-token": METAAPI_TOKEN } });
        const text = await res.text();
        log(`history-deals status=${res.status} bodyLen=${text.length} body=${text.slice(0, 300)}`);
        if (res.ok) {
          deals = JSON.parse(text);
          log(`Parsed ${deals?.length ?? 0} deals from ${base}`);
          break;
        } else {
          lastError = `${res.status}: ${text.slice(0, 200)}`;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        log(`Fetch error on ${base}: ${lastError}`);
      }
    }

    if (!deals) {
      return NextResponse.json({
        error: `All history-deals endpoints failed. Last error: ${lastError}`,
        debug,
      }, { status: 500 });
    }

    log(`Total deals fetched: ${deals.length}`);

    // 4. Group deals by positionId
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
    log(`Grouped into ${Object.keys(byPosition).length} positions`);

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
    log(`Built ${rows.length} trade rows ready to upsert`);

    let inserted = 0;
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("trades")
        .upsert(rows, { onConflict: "external_deal_id", ignoreDuplicates: true })
        .select("id");
      if (error) {
        log(`Upsert error: ${error.message}`);
        return NextResponse.json({ error: error.message, debug }, { status: 500 });
      }
      inserted = data?.length || 0;
      log(`Upsert inserted=${inserted}`);
    }

    await supabase
      .from("prop_challenges")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", challengeId);

    return NextResponse.json({
      imported: inserted,
      totalDealsFetched: deals.length,
      positionsProcessed: Object.keys(byPosition).length,
      debug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Uncaught: ${msg}`);
    return NextResponse.json({ error: msg, debug }, { status: 500 });
  }
}
