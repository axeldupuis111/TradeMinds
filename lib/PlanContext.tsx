"use client";

import { createClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type PlanType = "free" | "plus" | "premium";

interface PlanContextValue {
  plan: PlanType;
  loading: boolean;
  canUseStrategy: boolean;
  canUseAI: boolean;
  canImportCSV: boolean;
  aiRemaining: number | null; // null = unlimited
  maxAccounts: number | null; // null = unlimited
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
  incrementAIUsage: async () => {},
  refreshPlan: async () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [plan, setPlan] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);
  const [dailyAiCount, setDailyAiCount] = useState(0);
  const [dailyAiReset, setDailyAiReset] = useState<string | null>(null);

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
      // Check expiration
      let effectivePlan: PlanType = (data.plan as PlanType) || "free";
      if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
        effectivePlan = "free";
      }
      setPlan(effectivePlan);

      const today = new Date().toISOString().split("T")[0];
      if (data.daily_ai_reset !== today) {
        // Reset counter for new day
        setDailyAiCount(0);
        setDailyAiReset(today);
      } else {
        setDailyAiCount(data.daily_ai_count || 0);
        setDailyAiReset(data.daily_ai_reset);
      }
    } else {
      // No profile row yet — create one
      await supabase.from("profiles").upsert({
        id: user.id,
        plan: "free",
        daily_ai_count: 0,
      });
      setPlan("free");
      setDailyAiCount(0);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const incrementAIUsage = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const newCount = dailyAiReset === today ? dailyAiCount + 1 : 1;

    await supabase
      .from("profiles")
      .update({ daily_ai_count: newCount, daily_ai_reset: today })
      .eq("id", user.id);

    setDailyAiCount(newCount);
    setDailyAiReset(today);
  }, [supabase, dailyAiCount, dailyAiReset]);

  // Derived permissions
  const canUseStrategy = plan === "plus" || plan === "premium";
  const canUseAI = plan === "plus" || plan === "premium";

  const today = new Date().toISOString().split("T")[0];
  const effectiveCount = dailyAiReset === today ? dailyAiCount : 0;
  const aiRemaining =
    plan === "premium"
      ? null // unlimited
      : plan === "plus"
        ? Math.max(0, 1 - effectiveCount)
        : 0;

  const canImportCSV = plan === "plus" || plan === "premium";
  const maxAccounts = plan === "free" ? 1 : null;

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
