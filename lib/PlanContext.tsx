"use client";

import { createClient } from "@/lib/supabase/client";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export type PlanType = "free" | "plus" | "premium";

export type SubscriptionStatus = "active" | "past_due" | "canceling" | "trialing" | null;

interface PlanContextValue {
  plan: PlanType;
  loading: boolean;
  canUseStrategy: boolean;
  canUseAI: boolean;
  canImportCSV: boolean;
  aiRemaining: number | null; // null = unlimited
  maxAccounts: number | null; // null = unlimited
  maxStrategies: number | null; // null = unlimited
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  incrementAIUsage: () => Promise<void>;
  refreshPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "free",
  loading: true,
  canUseStrategy: false,
  canUseAI: false,
  canImportCSV: false,
  aiRemaining: 0,
  maxAccounts: 1,
  maxStrategies: 1,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  incrementAIUsage: async () => {},
  refreshPlan: async () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [plan, setPlan] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);
  const [dailyAiCount, setDailyAiCount] = useState(0);
  const [dailyAiReset, setDailyAiReset] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);

  const loadPlan = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("plan, plan_expires_at, daily_ai_count, daily_ai_reset")
      .eq("id", user.id)
      .single();

    if (data) {
      // Ensure email is synced in profile
      if (user.email) {
        await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
      }
      // Check expiration
      let effectivePlan: PlanType = (data.plan as PlanType) || "free";
      if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
        effectivePlan = "free";
      }
      setPlan(effectivePlan);

      const today = new Date().toISOString().split("T")[0];
      const weekStart = getWeekStart(new Date());
      // Free plan tracks weekly usage; plus/premium tracks daily
      const resetKey = effectivePlan === "free" ? weekStart : today;
      if (data.daily_ai_reset !== resetKey) {
        setDailyAiCount(0);
        setDailyAiReset(resetKey);
      } else {
        setDailyAiCount(data.daily_ai_count || 0);
        setDailyAiReset(data.daily_ai_reset);
      }
    } else {
      // No profile row yet — create one
      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        plan: "free",
        daily_ai_count: 0,
      });
      setPlan("free");
      setDailyAiCount(0);
    }

    // Fetch active subscription for billing banners
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, cancel_at_period_end, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      setCancelAtPeriodEnd(sub.cancel_at_period_end ?? false);
      setCurrentPeriodEnd(
        sub.current_period_end ? new Date(sub.current_period_end) : null
      );
      if (sub.status === "past_due") {
        setSubscriptionStatus("past_due");
      } else if (sub.cancel_at_period_end) {
        setSubscriptionStatus("canceling");
      } else if (sub.status === "active") {
        setSubscriptionStatus("active");
      } else if (sub.status === "trialing") {
        setSubscriptionStatus("trialing");
      } else {
        setSubscriptionStatus(null);
      }
    } else {
      setSubscriptionStatus(null);
      setCancelAtPeriodEnd(false);
      setCurrentPeriodEnd(null);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPlan();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadPlan();
      } else if (event === "SIGNED_OUT") {
        setPlan("free");
        setDailyAiCount(0);
        setDailyAiReset(null);
        setSubscriptionStatus(null);
        setCancelAtPeriodEnd(false);
        setCurrentPeriodEnd(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const incrementAIUsage = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const weekStart = getWeekStart(new Date());
    const resetKey = plan === "free" ? weekStart : today;
    const newCount = dailyAiReset === resetKey ? dailyAiCount + 1 : 1;

    await supabase
      .from("profiles")
      .update({ daily_ai_count: newCount, daily_ai_reset: resetKey })
      .eq("id", user.id);

    setDailyAiCount(newCount);
    setDailyAiReset(resetKey);
  }, [supabase, dailyAiCount, dailyAiReset, plan]);

  // Derived permissions.
  // Depuis 2026-07 : la boucle cœur (stratégie + analyse IA) est ouverte à tous
  // les plans — le free est limité par les quotas (1 analyse/semaine via
  // PLAN_LIMITS) et par maxStrategies (1 stratégie).
  const canUseStrategy = true;
  const canUseAI = true;

  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart(new Date());
  const effectiveResetKey = plan === "free" ? weekStart : today;
  const effectiveCount = dailyAiReset === effectiveResetKey ? dailyAiCount : 0;

  const aiLimit = PLAN_LIMITS.analyze[plan].limit;
  const aiRemaining = Math.max(0, aiLimit - effectiveCount);

  // Free users can import CSV (1/day limit enforced in CsvImport component)
  const canImportCSV = true;
  const maxAccounts = plan === "free" ? 1 : null;
  const maxStrategies = plan === "free" ? 1 : null;

  return (
    <PlanContext.Provider
      value={{
        plan,
        loading,
        canUseStrategy,
        canUseAI,
        canImportCSV,
        aiRemaining,
        maxAccounts,
        maxStrategies,
        subscriptionStatus,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        incrementAIUsage,
        refreshPlan: loadPlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
