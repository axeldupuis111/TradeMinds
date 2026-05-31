/**
 * POST /api/admin/recompute-trade-derivation
 *
 * Retroactively recomputes ict_killzone and ict_confluence_score for all trades.
 * Also updates ict_setup via the checklist→setup mapping — but ONLY if the
 * derived setup is non-null (to avoid destroying manually-set values for
 * strategies that predate this feature and have no mapping).
 *
 * Protected by ADMIN_SECRET header. Run once after deploying this feature.
 *
 * Manual steps before running:
 *   1. Execute migrations/20260601_add_checklist_setup_mapping_to_strategies.sql in Supabase
 *   2. Re-submit your strategy on /dashboard/strategy to generate the mapping
 *   3. Call this endpoint: POST /api/admin/recompute-trade-derivation
 *      with header: x-admin-secret: <ADMIN_SECRET env var>
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  computeConfluenceScore,
  deriveSetupFromChecklist,
  detectKillzone,
} from "@/lib/strategy/derive";

export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Fetch all trades ──────────────────────────────────────────────────────
  const { data: trades, error: tradesError } = await supabase
    .from("trades")
    .select("id, user_id, open_time, ict_checklist, ict_setup");

  if (tradesError) {
    return NextResponse.json({ error: tradesError.message }, { status: 500 });
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
