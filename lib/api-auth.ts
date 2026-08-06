import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FEATURE_MONTHLY_CEILING,
  PLAN_MONTHLY_CEILING,
  monthKey,
} from "@/lib/ai-ceilings";
import { alertAiCeiling } from "@/lib/cron-alert";
import type { PlanType } from "@/lib/PlanContext";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { localDateKey, weekStartLocalKey } from "@/lib/timezone";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — safe to ignore with middleware refreshing sessions
          }
        },
      },
    }
  );
}

interface AuthResult {
  userId: string;
  plan: PlanType;
  /** The trader's IANA timezone (falls back to "UTC"), for day-boundary math. */
  timezone: string;
}

export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error(`[API Auth] Blocked unauthenticated request`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, timezone")
    .eq("id", user.id)
    .single();

  let plan: PlanType = (profile?.plan as PlanType) || "free";
  if (profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
    plan = "free";
  }
  return { userId: user.id, plan, timezone: (profile?.timezone as string) || "UTC" };
}

interface QuotaCheckParams {
  userId: string;
  plan: PlanType;
  feature: "analyze" | "chat";
  /** Trader timezone so the daily/weekly quota resets on their local day. */
  timezone?: string;
}

interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}


interface ProfileQuotaRow {
  daily_ai_count: number | null;
  daily_ai_reset: string | null;
  daily_chat_count: number | null;
  daily_chat_reset: string | null;
}

function getQuotaFromProfile(profile: ProfileQuotaRow | null, feature: "analyze" | "chat", resetKey: string): number {
  if (!profile) return 0;
  if (feature === "analyze") {
    return profile.daily_ai_reset === resetKey ? (profile.daily_ai_count || 0) : 0;
  }
  return profile.daily_chat_reset === resetKey ? (profile.daily_chat_count || 0) : 0;
}

export async function checkQuota({ userId, plan, feature, timezone }: QuotaCheckParams): Promise<QuotaResult | NextResponse> {
  const config = PLAN_LIMITS[feature][plan];

  if (config.limit === 0) {
    console.error(`[API Quota] Blocked ${feature} for free user ${userId}`);
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const supabase = createSupabaseServer();
  const resetKey = config.resetMode === "week" ? weekStartLocalKey(timezone) : localDateKey(timezone);

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_count, daily_ai_reset, daily_chat_count, daily_chat_reset")
    .eq("id", userId)
    .single();

  const currentCount = getQuotaFromProfile(profile as ProfileQuotaRow | null, feature, resetKey);

  if (currentCount >= config.limit) {
    console.error(`[API Quota] Rate limited ${feature} for user ${userId}: ${currentCount}/${config.limit}`);
    return NextResponse.json(
      { error: "Daily limit reached", limit: config.limit, remaining: 0 },
      { status: 429 }
    );
  }

  return { allowed: true, remaining: config.limit - currentCount, limit: config.limit };
}

export async function incrementQuota(userId: string, plan: PlanType, feature: "analyze" | "chat", timezone?: string): Promise<void> {
  const config = PLAN_LIMITS[feature][plan];
  if (!config) return;

  const supabase = createSupabaseServer();
  const resetKey = config.resetMode === "week" ? weekStartLocalKey(timezone) : localDateKey(timezone);

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_count, daily_ai_reset, daily_chat_count, daily_chat_reset")
    .eq("id", userId)
    .single();

  const currentCount = getQuotaFromProfile(profile as ProfileQuotaRow | null, feature, resetKey);

  if (feature === "analyze") {
    await supabase
      .from("profiles")
      .update({ daily_ai_count: currentCount + 1, daily_ai_reset: resetKey })
      .eq("id", userId);
  } else {
    await supabase
      .from("profiles")
      .update({ daily_chat_count: currentCount + 1, daily_chat_reset: resetKey })
      .eq("id", userId);
  }
}

function resetKeyFor(config: { resetMode: "day" | "week" }, timezone?: string): string {
  return config.resetMode === "week"
    ? weekStartLocalKey(timezone)
    : localDateKey(timezone);
}

/**
 * Atomically reserve one quota slot for the user.
 *
 * Unlike checkQuota + incrementQuota (a non-atomic read-modify-write split
 * across two round trips), this consumes the slot up front in a single
 * locked statement so concurrent requests cannot both slip past the limit.
 * Call refundQuota if the work that the slot was reserved for then fails.
 *
 * Falls back to the legacy non-atomic path when the consume_quota RPC is not
 * deployed yet (migration 20260615_atomic_ai_quota.sql), so the feature keeps
 * working before the SQL is applied.
 */
export async function consumeQuota({ userId, plan, feature, timezone }: QuotaCheckParams): Promise<QuotaResult | NextResponse> {
  const config = PLAN_LIMITS[feature][plan];

  if (config.limit === 0) {
    console.error(`[API Quota] Blocked ${feature} for free user ${userId}`);
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const supabase = createSupabaseServer();
  const resetKey = resetKeyFor(config, timezone);

  const { data, error } = await supabase.rpc("consume_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_limit: config.limit,
    p_reset_key: resetKey,
  });

  if (error) {
    // RPC not deployed yet → fall back to the legacy non-atomic path so the
    // feature keeps working. Apply the migration to activate atomic quotas.
    console.error(`[API Quota] consume_quota RPC unavailable, falling back to legacy path: ${error.message}`);
    const legacy = await checkQuota({ userId, plan, feature, timezone });
    if (legacy instanceof NextResponse) return legacy;
    await incrementQuota(userId, plan, feature, timezone);
    return { allowed: true, remaining: legacy.remaining - 1, limit: config.limit };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; current_count: number } | undefined;

  if (!row || !row.allowed) {
    console.error(`[API Quota] Rate limited ${feature} for user ${userId}: ${row?.current_count ?? "?"}/${config.limit}`);
    return NextResponse.json(
      { error: "Daily limit reached", limit: config.limit, remaining: 0 },
      { status: 429 }
    );
  }

  // Disjoncteur mensuel, posé par-dessus le quota journalier du plan. Le
  // journalier a déjà été consommé : si le mensuel refuse, on le rend.
  const ceiling = PLAN_MONTHLY_CEILING[feature]?.[plan];
  if (!(await consumeMonthlyCeiling(supabase, userId, feature, ceiling, timezone))) {
    // Uniquement le journalier : consume_ai_month a DÉJÀ annulé son propre
    // incrément en refusant. Passer par refundQuota décrémenterait le compteur
    // mensuel une seconde fois et le ferait dériver sous l'usage réel.
    await refundDailyQuota(userId, plan, feature, timezone);
    return NextResponse.json(
      { error: "Monthly limit reached", limit: config.limit, remaining: 0 },
      { status: 429 }
    );
  }

  return { allowed: true, remaining: Math.max(0, config.limit - row.current_count), limit: config.limit };
}

/**
 * Give back a slot reserved by consumeQuota when the downstream work failed
 * (e.g. the Claude call errored), so the user is not charged a quota unit for
 * a response they never received. Best-effort: never throws.
 *
 * If the refund_quota RPC is unavailable, falls back to a direct decrement on
 * the profile columns. A refund that silently does nothing bills the trader for
 * an analysis they never got (incident 2026-08-03: the RPC was rejected on a
 * date/text type mismatch and every failed analysis stayed billed), so this
 * path must never be a no-op.
 */
export async function refundQuota(userId: string, plan: PlanType, feature: "analyze" | "chat", timezone?: string): Promise<void> {
  const config = PLAN_LIMITS[feature][plan];
  if (!config) return;

  // Rendre aussi l'unité mensuelle : sans ça, une analyse qui échoue rapproche
  // quand même le trader de son disjoncteur.
  await refundMonthlyCeiling(createSupabaseServer(), userId, feature, timezone);
  await refundDailyQuota(userId, plan, feature, timezone);
}

/**
 * Remboursement du seul quota JOURNALIER.
 *
 * Séparé de refundQuota parce que le chemin « disjoncteur mensuel atteint » ne
 * doit rembourser que le journalier : la RPC mensuelle annule elle-même son
 * incrément quand elle refuse.
 */
async function refundDailyQuota(userId: string, plan: PlanType, feature: "analyze" | "chat", timezone?: string): Promise<void> {
  const config = PLAN_LIMITS[feature][plan];
  if (!config) return;

  const supabase = createSupabaseServer();
  const resetKey = resetKeyFor(config, timezone);

  try {
    const { error } = await supabase.rpc("refund_quota", {
      p_user_id: userId,
      p_feature: feature,
      p_reset_key: resetKey,
    });
    if (!error) return;
    console.error(`[API Quota] refund_quota RPC unavailable, falling back to direct decrement: ${error.message}`);
    await refundQuotaDirect(supabase, userId, feature, resetKey);
  } catch (e) {
    console.error(`[API Quota] refund_quota threw for user ${userId}:`, e);
  }
}

/** Legacy read-modify-write refund, used when the RPC is unavailable. */
async function refundQuotaDirect(
  supabase: ReturnType<typeof createSupabaseServer>,
  userId: string,
  feature: "analyze" | "chat",
  resetKey: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_count, daily_ai_reset, daily_chat_count, daily_chat_reset")
    .eq("id", userId)
    .single();

  const currentCount = getQuotaFromProfile(profile as ProfileQuotaRow | null, feature, resetKey);
  if (currentCount <= 0) return; // period already rolled over — nothing to give back

  const column = feature === "analyze" ? "daily_ai_count" : "daily_chat_count";
  const { error } = await supabase
    .from("profiles")
    .update({ [column]: currentCount - 1 })
    .eq("id", userId);
  if (error) console.error(`[API Quota] direct refund failed for user ${userId}: ${error.message}`);
}

/**
 * Disjoncteur mensuel — réserve une unité sur le mois en cours.
 *
 * Deuxième borne, invisible, POSÉE PAR-DESSUS les quotas journaliers (qui ne
 * changent pas). Un plafond journalier ne borne pas l'exposition d'un mois :
 * « 2 par jour » autorise 60 analyses là où un professionnel en fait 12. Ces
 * plafonds valent ~3× l'usage d'un utilisateur intensif, donc personne
 * d'honnête ne les rencontre. Voir lib/ai-ceilings.
 *
 * Fail-open : si la migration n'est pas appliquée, l'appel passe.
 * Renvoie true si l'appel est autorisé.
 */
async function consumeMonthlyCeiling(
  supabase: ReturnType<typeof createSupabaseServer>,
  userId: string,
  feature: string,
  limit: number | undefined,
  timezone?: string,
): Promise<boolean> {
  if (!limit || limit <= 0) return true;
  try {
    const { data, error } = await supabase.rpc("consume_ai_month", {
      p_user_id: userId,
      p_feature: feature,
      p_limit: limit,
      p_month: monthKey(timezone),
    });
    if (error) {
      console.error(`[AI ceiling] consume_ai_month unavailable for ${feature}: ${error.message}`);
      return true; // fail open
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; current_count: number; already_alerted: boolean }
      | undefined;
    if (row && !row.allowed) {
      console.error(`[AI ceiling] ${feature} MONTHLY ceiling hit for user ${userId} (limit ${row.current_count})`);
      // Une seule alerte par (compte, feature, mois) : la RPC porte le témoin.
      if (!row.already_alerted) await alertAiCeiling(userId, feature, row.current_count);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[AI ceiling] threw for ${feature}:`, e);
    return true; // fail open
  }
}

/** Rend une unité mensuelle quand le travail en aval a échoué. Best-effort. */
async function refundMonthlyCeiling(
  supabase: ReturnType<typeof createSupabaseServer>,
  userId: string,
  feature: string,
  timezone?: string,
): Promise<void> {
  try {
    await supabase.rpc("refund_ai_month", {
      p_user_id: userId,
      p_feature: feature,
      p_month: monthKey(timezone),
    });
  } catch {
    // best-effort : ne jamais masquer l'erreur d'origine de l'appelant
  }
}

/**
 * Generic per-feature daily rate limit for the secondary AI routes (not the
 * plan-based analyze/chat quotas). Anti-abuse only — the limits are generous;
 * the point is to stop one account spamming an endpoint and burning Anthropic
 * credits. Counts on the trader's local day.
 *
 * Applique EN PLUS le disjoncteur mensuel (lib/ai-ceilings) quand la feature en
 * déclare un : le quota journalier seul ne borne pas l'exposition d'un mois.
 *
 * Returns a 429 NextResponse when the limit is exceeded, or null when allowed.
 * FAILS OPEN if the consume_ai_usage RPC isn't deployed yet (migration
 * 20260630_ai_usage_rate_limit.sql), so wiring it up never breaks a feature.
 */
export async function rateLimitAi(
  userId: string,
  feature: string,
  limit: number,
  timezone?: string,
): Promise<NextResponse | null> {
  const supabase = createSupabaseServer();
  const day = localDateKey(timezone);
  try {
    const { data, error } = await supabase.rpc("consume_ai_usage", {
      p_user_id: userId,
      p_feature: feature,
      p_limit: limit,
      p_day: day,
    });
    if (error) {
      // RPC not deployed → fail open (allow), just log.
      console.error(`[AI rate-limit] consume_ai_usage unavailable for ${feature}: ${error.message}`);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean } | undefined;
    if (row && !row.allowed) {
      console.error(`[AI rate-limit] ${feature} daily limit hit for user ${userId}`);
      return NextResponse.json({ error: "Daily limit reached for this feature" }, { status: 429 });
    }

    // Disjoncteur mensuel, par-dessus le quota journalier.
    const ceiling = FEATURE_MONTHLY_CEILING[feature];
    if (!(await consumeMonthlyCeiling(supabase, userId, feature, ceiling, timezone))) {
      return NextResponse.json({ error: "Monthly limit reached for this feature" }, { status: 429 });
    }
    return null;
  } catch (e) {
    console.error(`[AI rate-limit] threw for ${feature}:`, e);
    return null; // fail open
  }
}
