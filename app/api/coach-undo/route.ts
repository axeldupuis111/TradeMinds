import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { executeCoachUndo, type CoachUndo } from "@/lib/coach-tools";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";

/**
 * Annulation d'une action posée par le coach IA.
 *
 * Le client renvoie le descriptif `undo` reçu dans le stream du chat. On rejoue
 * l'opération inverse avec le client Supabase user-scoped (RLS) : toutes les
 * écritures sont bornées à `user_id = userId`, et executeCoachUndo ne réinsère
 * que des colonnes whitelistées. Un payload forgé ne peut donc affecter que les
 * propres données du trader — ce qu'il peut déjà faire via l'UI.
 */

const MAX_UNDO_BYTES = 200_000;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { undo?: CoachUndo };
  try {
    const raw = await request.text();
    if (raw.length > MAX_UNDO_BYTES) {
      return NextResponse.json({ error: "Payload trop volumineux." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (!body.undo || typeof body.undo !== "object" || typeof (body.undo as { op?: unknown }).op !== "string") {
    return NextResponse.json({ error: "Descriptif d'annulation manquant." }, { status: 400 });
  }

  const sb = createSupabaseServer();
  const res = await executeCoachUndo(sb, auth.userId, body.undo);
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? "Annulation impossible." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
