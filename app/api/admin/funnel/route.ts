import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Funnel d'activation (admin) — lit product_events + profiles et renvoie les
 * comptes par étape sur la fenêtre demandée (7 ou 30 jours) :
 *   inscrits → activés (import/démo/trade manuel) → analyse IA →
 *   checkout démarré · + payants actuels (hors fenêtre, état global).
 * Même garde admin que /api/admin/update-plan (ADMIN_EMAILS).
 */

function distinct(rows: { user_id: string }[] | null): number {
  return new Set((rows ?? []).map((r) => r.user_id)).size;
}

export async function GET(req: NextRequest) {
  // ── Garde admin (cookie session + liste blanche ADMIN_EMAILS) ────────────
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = daysParam === 7 ? 7 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const admin = createAdminClient();

  const [
    { count: signups },
    { data: activationEvents, error: eventsErr },
    { data: analysisEvents },
    { data: checkoutEvents },
    { count: payingNow },
    { data: tasterEvents },
    { data: upgradeCtaEvents },
    { data: signupSourceEvents },
    { data: aiCallEvents },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("product_events").select("user_id")
      .in("event", ["csv_imported", "manual_trade_added", "demo_loaded"])
      .gte("created_at", since).limit(10000),
    admin.from("product_events").select("user_id")
      .eq("event", "analysis_run").gte("created_at", since).limit(10000),
    admin.from("product_events").select("user_id")
      .eq("event", "checkout_started").gte("created_at", since).limit(10000),
    admin.from("profiles").select("id", { count: "exact", head: true }).neq("plan", "free"),
    admin.from("product_events").select("user_id")
      .eq("event", "taster_used").gte("created_at", since).limit(10000),
    admin.from("product_events").select("user_id, meta")
      .eq("event", "upgrade_cta_clicked").gte("created_at", since).limit(10000),
    admin.from("product_events").select("user_id, meta")
      .eq("event", "signup_attributed").gte("created_at", since).limit(10000),
    // Coût IA réel (lib/ai-cost-log) : ce qu'on paie vraiment, par route et
    // par plan. Sans ça le coût ne se lit nulle part (les logs Vercel ne
    // retiennent que 14 jours et ne sont pas requêtables).
    admin.from("product_events").select("user_id, meta")
      .eq("event", "ai_call").gte("created_at", since).limit(10000),
  ]);

  // ── Coût IA sur la période ────────────────────────────────────────────────
  type AiMeta = { route?: string; plan?: string; cost_eur?: number };
  const aiRows = (aiCallEvents ?? []) as { user_id: string; meta: AiMeta | null }[];
  const aiCostByRoute: Record<string, { calls: number; eur: number }> = {};
  const aiCostByPlan: Record<string, { calls: number; eur: number; users: Set<string> }> = {};
  let aiCostTotal = 0;
  for (const row of aiRows) {
    const eur = typeof row.meta?.cost_eur === "number" ? row.meta.cost_eur : 0;
    const route = row.meta?.route || "inconnu";
    const plan = row.meta?.plan || "inconnu";
    aiCostTotal += eur;
    (aiCostByRoute[route] ??= { calls: 0, eur: 0 }).calls++;
    aiCostByRoute[route].eur += eur;
    const byPlan = (aiCostByPlan[plan] ??= { calls: 0, eur: 0, users: new Set() });
    byPlan.calls++;
    byPlan.eur += eur;
    byPlan.users.add(row.user_id);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const aiCost = {
    total: round(aiCostTotal),
    calls: aiRows.length,
    byRoute: Object.fromEntries(
      Object.entries(aiCostByRoute)
        .sort((a, b) => b[1].eur - a[1].eur)
        .map(([k, v]) => [k, { calls: v.calls, eur: round(v.eur) }]),
    ),
    // Le chiffre qui compte : coût moyen par abonné actif, à comparer au prix
    // du plan. Au-delà de ~25 % du prix, il faut resserrer.
    byPlan: Object.fromEntries(
      Object.entries(aiCostByPlan).map(([k, v]) => [
        k,
        { calls: v.calls, eur: round(v.eur), users: v.users.size, eurPerUser: round(v.eur / Math.max(1, v.users.size)) },
      ]),
    ),
  };

  // Ventilation des clics upgrade par déclencheur (meta.source).
  const upgradeCtaBySource: Record<string, number> = {};
  for (const row of (upgradeCtaEvents ?? []) as { user_id: string; meta: { source?: string } | null }[]) {
    const source = row.meta?.source || "unknown";
    upgradeCtaBySource[source] = (upgradeCtaBySource[source] || 0) + 1;
  }

  // Inscriptions attribuées à une source marketing (utm_source / ref —
  // typiquement le pseudo d'un influenceur). Distinct par utilisateur.
  const signupsBySource: Record<string, number> = {};
  {
    const seen = new Set<string>();
    for (const row of (signupSourceEvents ?? []) as { user_id: string; meta: { source?: string } | null }[]) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      const source = row.meta?.source || "unknown";
      signupsBySource[source] = (signupsBySource[source] || 0) + 1;
    }
  }

  return NextResponse.json({
    days,
    // Table absente (migration non appliquée) → le front l'affiche clairement.
    eventsTableMissing: !!eventsErr,
    signups: signups ?? 0,
    activated: distinct(activationEvents),
    analyzed: distinct(analysisEvents),
    checkoutStarted: distinct(checkoutEvents),
    payingNow: payingNow ?? 0,
    // Échelle d'upgrade free→plus (2026-07-09)
    tasterUsed: distinct(tasterEvents),
    upgradeCtaUsers: distinct((upgradeCtaEvents ?? []) as { user_id: string }[]),
    upgradeCtaBySource,
    // Coût IA réel sur la période (2026-08-06)
    aiCost,
    // Attribution marketing (2026-07-14)
    signupsBySource,
  });
}
