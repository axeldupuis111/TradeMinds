import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import { encrypt } from "@/lib/crypto/encryption";
import { createHmac } from "crypto";

const VALID_EXCHANGES = ["binance"] as const;

async function testBinanceKey(
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; canTrade?: boolean; error?: string }> {
  const timestamp = Date.now().toString();
  const queryString = `timestamp=${timestamp}`;
  const signature = createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");

  const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
    });
  } catch {
    return { ok: false, error: "Impossible de contacter Binance. Réessaie dans quelques instants." };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { code?: number }).code;
    const msg = (body as { msg?: string }).msg || "Erreur inconnue";

    if (code === -2015 || code === -2008) {
      return { ok: false, error: "Clé API invalide ou permissions insuffisantes." };
    }
    if (code === -2014) {
      return { ok: false, error: "Clé API mal formée." };
    }
    if (code === -1003 || code === -1015) {
      return { ok: false, error: "Rate limit Binance atteint. Réessaie dans quelques secondes." };
    }
    return { ok: false, error: `Binance a refusé la connexion (${code}): ${msg}` };
  }

  const data = (await res.json()) as { canTrade?: boolean };
  return { ok: true, canTrade: data.canTrade ?? false };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const exchange = body.exchange as string | undefined;
  const label = (body.label as string | undefined)?.trim();
  const apiKey = (body.apiKey as string | undefined)?.trim();
  const apiSecret = (body.apiSecret as string | undefined)?.trim();

  if (!exchange || !VALID_EXCHANGES.includes(exchange as (typeof VALID_EXCHANGES)[number])) {
    return NextResponse.json(
      { error: `Exchange invalide. Valeurs acceptées : ${VALID_EXCHANGES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!label) {
    return NextResponse.json({ error: "Le label est requis." }, { status: 400 });
  }
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "La clé API et le secret sont requis." }, { status: 400 });
  }

  const test = await testBinanceKey(apiKey, apiSecret);
  if (!test.ok) {
    return NextResponse.json({ error: test.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_connections")
    .insert({
      user_id: userId,
      exchange,
      label,
      api_key_encrypted: encrypt(apiKey),
      api_secret_encrypted: encrypt(apiSecret),
    })
    .select("id, exchange, label, status, last_synced_at, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Un compte avec ce nom existe déjà." },
        { status: 409 }
      );
    }
    console.error("[exchanges] insert error:", error.message);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }

  const warning = test.canTrade
    ? "Connexion réussie, mais cette clé a la permission de trader. Une clé en lecture seule est recommandée."
    : undefined;

  return NextResponse.json({ connection: data, warning }, { status: 201 });
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_connections")
    .select("id, exchange, label, status, last_synced_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[exchanges] select error:", error.message);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }

  return NextResponse.json({ connections: data });
}
