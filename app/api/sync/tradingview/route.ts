import { NextRequest, NextResponse } from "next/server";
import { syncPushTrades } from "@/lib/sync/push-handler";
import { normalizeTradingViewPayload } from "@/lib/sync/tradingview-parse";

// Webhook TradingView : l'utilisateur colle l'URL (avec ?token=) dans le champ
// "Webhook URL" de son alerte, et le message d'alerte contient le trade clôturé
// en JSON (snippet Pine fourni dans Réglages → TradingView).
//
// TradingView ne permet pas de header custom → le token passe dans l'URL (ou à
// défaut dans le corps). La route est exemptée d'auth session dans middleware.ts
// (même régime que /api/sync/push) ; l'authentification est le token lui-même.
export async function POST(req: NextRequest) {
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Corps illisible." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw.replace(/\0/g, "").trim());
  } catch {
    // Message d'alerte non-JSON (placeholder oublié, guillemets manquants…) :
    // on renvoie un extrait pour que l'utilisateur diagnostique depuis les
    // logs de son alerte TradingView.
    return NextResponse.json(
      { error: "Le message d'alerte doit être du JSON valide.", received: raw.slice(0, 200) },
      { status: 400 },
    );
  }

  const { token, trades, invalid } = normalizeTradingViewPayload(
    payload,
    req.nextUrl.searchParams.get("token"),
  );

  if (!token) {
    return NextResponse.json(
      { error: "Token manquant. Ajoute ?token=TON_TOKEN à l'URL du webhook." },
      { status: 401 },
    );
  }

  if (trades.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun trade valide. Champs requis : symbol, direction (long/short), volume, entry_price, exit_price.",
        received: invalid,
      },
      { status: 400 },
    );
  }

  return syncPushTrades({ token, trades });
}
