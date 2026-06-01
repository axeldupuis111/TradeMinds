import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import { randomBytes } from "crypto";

// GET — return the current mt_sync_token (or null)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (auth.plan !== "premium") {
    return NextResponse.json({ error: "Premium plan required." }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("mt_sync_token")
    .eq("id", auth.userId)
    .single();

  if (error) {
    console.error("[MT Token GET]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ token: data?.mt_sync_token ?? null });
}

// POST — generate (or regenerate) the mt_sync_token
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (auth.plan !== "premium") {
    return NextResponse.json({ error: "Premium plan required." }, { status: 403 });
  }

  // 32 random bytes → 64 hex chars, prefixed with "mt_"
  const token = `mt_${randomBytes(32).toString("hex")}`;

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ mt_sync_token: token })
    .eq("id", auth.userId);

  if (error) {
    console.error("[MT Token POST]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ token });
}
