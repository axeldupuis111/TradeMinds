import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { PlanType } from "@/lib/PlanContext";
import { PLAN_LIMITS } from "@/lib/plan-limits";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

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
    .select("plan, plan_expires_at")
    .eq("id", user.id)
    .single();

  let plan: PlanType = (profile?.plan as PlanType) || "free";
  if (profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
    plan = "free";
  }
  return { userId: user.id, plan };
}

interface QuotaCheckParams {
  userId: string;
  plan: PlanType;
  feature: "analyze" | "chat" | "period_summary";
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
  daily_summary_count: number | null;
  daily_summary_reset: string | null;
}

function getQuotaFromProfile(profile: ProfileQuotaRow | null, feature: "analyze" | "chat" | "period_summary", resetKey: string): number {
  if (!profile) return 0;
  if (feature === "analyze") {
    return profile.daily_ai_reset === resetKey ? (profile.daily_ai_count || 0) : 0;
  }
  if (feature === "period_summary") {
    return profile.daily_summary_reset === resetKey ? (profile.daily_summary_count || 0) : 0;
  }
  return profile.daily_chat_reset === resetKey ? (profile.daily_chat_count || 0) : 0;
}

export async function checkQuota({ userId, plan, feature }: QuotaCheckParams): Promise<QuotaResult | NextResponse> {
  const config = PLAN_LIMITS[feature][plan];

  if (config.limit === 0) {
    console.error(`[API Quota] Blocked ${feature} for free user ${userId}`);
    return NextResponse.json({ error: "Feature not available on free plan" }, { status: 403 });
  }

  const supabase = createSupabaseServer();
  const today = new Date().toISOString().split("T")[0];
  const resetKey = config.resetMode === "week" ? getWeekStart(new Date()) : today;

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_count, daily_ai_reset, daily_chat_count, daily_chat_reset, daily_summary_count, daily_summary_reset")
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

export async function incrementQuota(userId: string, plan: PlanType, feature: "analyze" | "chat" | "period_summary"): Promise<void> {
  const config = PLAN_LIMITS[feature][plan];
  if (!config) return;

  const supabase = createSupabaseServer();
  const today = new Date().toISOString().split("T")[0];
  const resetKey = config.resetMode === "week" ? getWeekStart(new Date()) : today;

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_count, daily_ai_reset, daily_chat_count, daily_chat_reset, daily_summary_count, daily_summary_reset")
    .eq("id", userId)
    .single();

  const currentCount = getQuotaFromProfile(profile as ProfileQuotaRow | null, feature, resetKey);

  if (feature === "analyze") {
    await supabase
      .from("profiles")
      .update({ daily_ai_count: currentCount + 1, daily_ai_reset: resetKey })
      .eq("id", userId);
  } else if (feature === "period_summary") {
    await supabase
      .from("profiles")
      .update({ daily_summary_count: currentCount + 1, daily_summary_reset: resetKey })
      .eq("id", userId);
  } else {
    await supabase
      .from("profiles")
      .update({ daily_chat_count: currentCount + 1, daily_chat_reset: resetKey })
      .eq("id", userId);
  }
}
