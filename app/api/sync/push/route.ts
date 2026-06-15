import { NextRequest } from "next/server";
import { handlePushSync } from "@/lib/sync/push-handler";

// Canonical endpoint for the push sync rail. Client software (MetaTrader EA,
// cTrader cBot, NinjaTrader add-on) POSTs closed trades here, authenticated by
// the user's universal sync token. The trade `source` field identifies the
// platform. See /api/sync/mt for the legacy alias.
export async function POST(req: NextRequest) {
  return handlePushSync(req);
}
