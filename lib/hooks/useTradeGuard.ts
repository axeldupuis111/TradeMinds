"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkTradeGuard, type GuardStrategy, type GuardWarning } from "@/lib/trade-guard";

/**
 * Loads the active strategy's rules + today's trades, and exposes runGuard(pair)
 * so a logging form can confront the trader with their own rules before saving.
 */
export function useTradeGuard(strategyId: string | null | undefined) {
  const strategyRef = useRef<GuardStrategy | null>(null);
  const todayRef = useRef<{ netPnl: number }[]>([]);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let strat: GuardStrategy | null = null;
      if (strategyId) {
        const { data } = await supabase
          .from("strategies")
          .select("pairs, max_trades_per_day, max_consecutive_losses")
          .eq("id", strategyId)
          .maybeSingle();
        if (data) strat = data as GuardStrategy;
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: trades } = await supabase
        .from("trades")
        .select("pnl, commission, swap, open_time")
        .eq("user_id", user.id)
        .gte("open_time", today)
        .order("open_time", { ascending: true });

      if (cancelled) return;
      strategyRef.current = strat;
      todayRef.current = (trades ?? []).map((t) => ({
        netPnl: (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0),
      }));
    })();
    return () => { cancelled = true; };
  }, [strategyId]);

  function runGuard(pair: string): GuardWarning[] {
    return checkTradeGuard(strategyRef.current, todayRef.current, { pair });
  }

  return { runGuard };
}
