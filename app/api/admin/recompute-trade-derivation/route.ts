/**
 * POST /api/admin/recompute-trade-derivation
 *
 * Retroactively recomputes ict_killzone and ict_confluence_score for all trades.
 * Also updates ict_setup via the checklist→setup mapping — but ONLY if the
 * derived setup is non-null (to avoid destroying manually-set values for
 * strategies that predate this feature and have no mapping).
 *
 * ⚠️⚠️ CETTE ROUTE ÉTAIT INAPPELABLE EN PRODUCTION. Elle était la seule des
 * huit routes d'administration à se garder par un `ADMIN_SECRET` — les sept
 * autres lisent `ADMIN_EMAILS` — et cette variable n'existe PAS dans
 * l'environnement de production (vérifié le 2026-09-18 : Vercel connaît
 * ADMIN_EMAILS, CRON_SECRET, STRIPE_WEBHOOK_SECRET…, pas ADMIN_SECRET). Toute
 * tentative tombait donc sur `secret !== undefined` et repartait en 401.
 *
 * ⚠️ CE QUE ÇA A COÛTÉ : le correctif de `detectKillzone` (l'heure d'été écrite
 * en dur, corrigée le 2026-09-17) n'a jamais pu être reporté sur les données.
 * Rejoué sur la production le 2026-09-18 : **onze trades portent une killzone
 * que le code contredit** (« off_session » là où il calcule « ny_pm », etc.),
 * et 213 des 288 trades réels n'en ont aucune. Une correction qu'on ne peut
 * pas exécuter n'est pas une correction.
 *
 * Elle accepte donc les DEUX portes : l'en-tête `x-admin-secret` si le secret
 * existe (rien de ce qui marchait ne cesse de marcher), et une session dont
 * l'adresse figure dans `ADMIN_EMAILS`, comme les sept autres.
 *
 * Manual steps before running:
 *   1. Execute migrations/20260601_add_checklist_setup_mapping_to_strategies.sql in Supabase
 *   2. Re-submit your strategy on /dashboard/strategy to generate the mapping
 *   3. Call this endpoint: POST /api/admin/recompute-trade-derivation
 */

import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { NextResponse } from "next/server";
import { refusDAdministrateur } from "@/lib/garde-admin";
import {
  computeConfluenceScore,
  deriveSetupFromChecklist,
  detectKillzone,
} from "@/lib/strategy/derive";

/**
 * ⚠️ LE SECRET RESTE ACCEPTÉ QUAND IL EXISTE : rien de ce qui marchait ne
 * cesse de marcher. Mais `ADMIN_EMAILS` est la voie normale, et elle vient
 * désormais du module partagé.
 *
 * ⚠️⚠️ CETTE ROUTE EST CELLE QUI A PROUVÉ CE QUE COÛTE UNE COPIE DIVERGENTE.
 * Gardée par un `ADMIN_SECRET` absent de la production, elle répondait 401 à
 * tout le monde, y compris à son auteur, et la correction du calcul ICT n'a
 * jamais pu être appliquée : onze trades portent une killzone que le code
 * contredit, 213 sur 288 n'en ont aucune.
 */
async function estAdministrateur(request: Request): Promise<boolean> {
  const attendu = process.env.ADMIN_SECRET;
  const secret = request.headers.get("x-admin-secret");
  if (attendu && secret && secret === attendu) return true;
  return (await refusDAdministrateur()) === null;}

export async function POST(request: Request) {
  if (!(await estAdministrateur(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Fetch all trades ──────────────────────────────────────────────────────
  // Lecture paginée : cette route recalcule des colonnes dérivées sur TOUTE la
  // base, tous utilisateurs confondus. Non bornée, elle en aurait traité 1 000
  // et répondu « terminé » (voir lib/supabase-paginate.ts) : le pire cas pour
  // un correctif de données, puisqu'on croit le chantier fait.
  const trades = await fetchAllRows<{
    id: string; user_id: string; open_time: string;
    ict_checklist: Record<string, boolean> | null; ict_setup: string | null;
  }>((from, to) =>
    supabase
      .from("trades")
      .select("id, user_id, open_time, ict_checklist, ict_setup")
      .order("id", { ascending: true })
      .range(from, to),
  );

  if (trades === null) {
    return NextResponse.json({ error: "lecture des trades incomplète" }, { status: 500 });
  }

  // ── Fetch all strategies (mapping + setup tags) ───────────────────────────
  const { data: strategies, error: strategiesError } = await supabase
    .from("strategies")
    .select("id, user_id, checklist_setup_mapping");

  if (strategiesError) {
    return NextResponse.json({ error: strategiesError.message }, { status: 500 });
  }

  // Fetch setup tag values per strategy
  const strategyIds = (strategies || []).map((s) => s.id);
  const setupTagsByStrategy: Record<string, string[]> = {};
  if (strategyIds.length > 0) {
    const { data: tags } = await supabase
      .from("strategy_tags")
      .select("strategy_id, value")
      .in("strategy_id", strategyIds)
      .eq("tag_type", "setup");

    for (const tag of tags || []) {
      if (!setupTagsByStrategy[tag.strategy_id]) setupTagsByStrategy[tag.strategy_id] = [];
      setupTagsByStrategy[tag.strategy_id].push(tag.value);
    }
  }

  // Build lookup: user_id → { mapping, availableSetups }
  const strategyByUser: Record<string, {
    mapping: Record<string, string[]>;
    availableSetups: string[];
  }> = {};

  for (const strat of strategies || []) {
    const mapping: Record<string, string[]> =
      strat.checklist_setup_mapping && typeof strat.checklist_setup_mapping === "object"
        ? (strat.checklist_setup_mapping as Record<string, string[]>)
        : {};
    strategyByUser[strat.user_id] = {
      mapping,
      availableSetups: setupTagsByStrategy[strat.id] || [],
    };
  }

  // ── Process trades ────────────────────────────────────────────────────────
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const trade of trades || []) {
    try {
      const checklistState = trade.ict_checklist as Record<string, boolean> | null;

      const updateData: Record<string, unknown> = {
        ict_killzone: trade.open_time ? detectKillzone(trade.open_time) : null,
        ict_confluence_score: computeConfluenceScore(checklistState),
      };

      // Only overwrite ict_setup if the mapping produces a non-null result
      const userStrat = strategyByUser[trade.user_id];
      if (userStrat && Object.keys(userStrat.mapping).length > 0) {
        const derived = deriveSetupFromChecklist(
          checklistState,
          userStrat.mapping,
          userStrat.availableSetups
        );
        if (derived !== null) {
          updateData.ict_setup = derived;
        }
        // If derived is null, leave existing ict_setup untouched
      }

      const { error } = await supabase
        .from("trades")
        .update(updateData)
        .eq("id", trade.id);

      if (error) {
        errors.push(`trade ${trade.id}: ${error.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      skipped++;
      errors.push(`trade ${trade.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    total: (trades || []).length,
    updated,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
