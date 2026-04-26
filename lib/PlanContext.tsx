"use client";

import { createClient } from "@/lib/supabase/client";
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

// "premium" is kept for DB backward-compat but treated as "plus" everywhere in UI
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
      // Ensure email is synced in profile
      if (user.email) {
        await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
      }
      // Check expiration
      let effectivePlan: PlanType = (data.plan as PlanType) || "free";
      if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
        effectivePlan = "free";
      }
      // Premium is discontinued — treat as plus
      if (effectivePlan === "premium") {
        effectivePlan = "plus";
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

  // Derived permissions
  // Free: strategy unlocked, AI unlocked (1/week), coach (3/day)
  // Plus/premium: AI (1/day), coach (10/day), unlimited imports
  const canUseStrategy = true;
  const canUseAI = true;

  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart(new Date());
  const effectiveResetKey = plan === "free" ? weekStart : today;
  const effectiveCount = dailyAiReset === effectiveResetKey ? dailyAiCount : 0;

  // Free: 1 AI analysis per week. Plus: 1 per day.
  const aiRemaining = Math.max(0, 1 - effectiveCount);

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
