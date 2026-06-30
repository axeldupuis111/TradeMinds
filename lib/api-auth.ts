import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

  return { allowed: true, remaining: Math.max(0, config.limit - row.current_count), limit: config.limit };
}

/**
 * Give back a slot reserved by consumeQuota when the downstream work failed
 * (e.g. the Claude call errored), so the user is not charged a quota unit for
 * a response they never received. Best-effort: never throws.
 */
export async function refundQuota(userId: string, plan: PlanType, feature: "analyze" | "chat", timezone?: string): Promise<void> {
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
    if (error) console.error(`[API Quota] refund_quota failed for user ${userId}: ${error.message}`);
  } catch (e) {
    console.error(`[API Quota] refund_quota threw for user ${userId}:`, e);
  }
}
