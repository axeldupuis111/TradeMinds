import { NextResponse } from "next/server";

const METAAPI_TOKEN = process.env.METAAPI_TOKEN!;
const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

interface ConnectBody {
  login: string;
  password: string;
  server: string;
  platform: "mt4" | "mt5";
  name?: string;
}

export async function POST(req: Request) {
  if (!METAAPI_TOKEN) {
    return NextResponse.json({ error: "METAAPI_TOKEN not configured" }, { status: 500 });
  }

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { login, password, server, platform, name } = body;
  if (!login || !password || !server || !platform) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (platform !== "mt4" && platform !== "mt5") {
    return NextResponse.json({ error: "Platform must be mt4 or mt5" }, { status: 400 });
  }

  try {
    // Create MetaApi trading account (read-only: investor password)
    const createRes = await fetch(`${PROVISIONING_BASE}/users/current/accounts`, {
      method: "POST",
      headers: {
        "auth-token": METAAPI_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name || `TradeMinds-${login}`,
        type: "cloud-g2",
        login: String(login),
        password,
        server,
        platform,
        magic: 0,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return NextResponse.json(
        { error: `MetaApi provisioning failed: ${errText}` },
        { status: createRes.status }
      );
    }

    const created = await createRes.json();
    const accountId: string = created.id;

    // Trigger deployment
    await fetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`, {
      method: "POST",
      headers: { "auth-token": METAAPI_TOKEN },
    });

    return NextResponse.json({
      accountId,
      login,
      server,
      platform,
      status: "deploying",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
