import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { executeCoachConfirm, type CoachConfirm } from "@/lib/coach-tools";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";

/**
 * Validation d'une opération irréversible proposée par le coach IA.
 *
 * Le coach ne supprime jamais directement : l'outil remonte un descriptif que
 * le client affiche (« Supprimer l'objectif X ? »), et la suppression n'a lieu
 * qu'ici, après un clic explicite du trader. C'est la différence avec
 * /api/coach-undo, qui répare après coup — ici on empêche avant.
 *
 * Mêmes garanties de sécurité : client Supabase user-scoped (RLS), toutes les
 * écritures bornées à `user_id = userId`, identifiants validés. Un descriptif
 * forgé ne peut affecter que les propres données du trader, ce qu'il peut déjà
 * faire depuis l'interface.
 */

const MAX_CONFIRM_BYTES = 20_000;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { confirm?: CoachConfirm };
  try {
    const raw = await request.text();
    if (raw.length > MAX_CONFIRM_BYTES) {
      return NextResponse.json({ error: "Payload trop volumineux." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (!body.confirm || typeof body.confirm !== "object" || typeof (body.confirm as { op?: unknown }).op !== "string") {
    return NextResponse.json({ error: "Descriptif de confirmation manquant." }, { status: 400 });
  }

  const sb = createSupabaseServer();
  const res = await executeCoachConfirm(sb, auth.userId, body.confirm, auth.plan);
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? "Opération impossible." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, action: res.action, undo: res.undo });
}
