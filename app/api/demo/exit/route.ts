import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Sortie du mode démo — purge côté serveur.
 *
 * Pourquoi une route et pas un delete depuis le navigateur : l'application ne
 * supprime jamais de `prop_challenges` côté client (la page Compte se contente
 * d'insérer et de passer un statut). Le delete client repartait donc avec zéro
 * ligne affectée, en silence, et les comptes de démonstration s'accumulaient à
 * chaque activation — jusqu'à contourner la limite d'un compte du plan gratuit.
 *
 * La clé de service contourne RLS, mais la portée reste étroite et vérifiable :
 * uniquement les lignes `is_demo = true` de l'utilisateur AUTHENTIFIÉ par sa
 * session. L'id ne vient jamais du corps de la requête.
 */
export async function POST() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Ordre : les trades d'abord, ils référencent la stratégie et le compte.
  const deleted: Record<string, number> = {};
  for (const table of ["trades", "strategies", "prop_challenges"] as const) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .eq("user_id", user.id)
      .eq("is_demo", true)
      .select("id");
    if (error) {
      console.error(`[demo] purge ${table} failed:`, error.message);
      return NextResponse.json(
        { error: `${table}: ${error.message}` },
        { status: 500 }
      );
    }
    deleted[table] = data?.length ?? 0;
  }

  const { error: flagError } = await admin
    .from("profiles")
    .update({ demo_mode: false })
    .eq("id", user.id);
  if (flagError) {
    console.error("[demo] reset demo_mode failed:", flagError.message);
    return NextResponse.json({ error: flagError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted });
}
