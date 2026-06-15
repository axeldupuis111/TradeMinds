import { NextRequest } from "next/server";
import { handlePushSync } from "@/lib/sync/push-handler";

// Legacy endpoint — kept so MetaTrader EAs already installed by users keep
// working. New bots (cTrader cBot, NinjaTrader add-on) target /api/sync/push.
// Both delegate to the same platform-agnostic handler.
export async function POST(req: NextRequest) {
  return handlePushSync(req);
}
