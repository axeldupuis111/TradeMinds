import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("exchange_connections")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("[exchanges] delete error:", error.message);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
