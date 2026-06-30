"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { checkTradeGuard, type GuardStrategy, type GuardWarning } from "@/lib/trade-guard";
import { startOfLocalDayUtc, browserTimezone } from "@/lib/timezone";

/**
 * Loads the active strategy's rules + today's trades, and exposes runGuard(pair)
 * so a logging form can confront the trader with their own rules before saving.
 */
export function useTradeGuard(strategyId: string | null | undefined) {
  const { selectedAccount } = useActiveAccount();
  const accountId = selectedAccount?.id ?? null;

  const strategyRef = useRef<GuardStrategy | null>(null);
  const todayRef = useRef<{ netPnl: number }[]>([]);
  const dailyLossLimitRef = useRef<number | null>(null);
  const netTodayRef = useRef<number>(0);
  const supabaseRef = useRef(createClient());

  // Max daily loss in € for the active account (same basis as RealTimeGuards).
  const lossPct = selectedAccount?.max_daily_loss_pct ?? selectedAccount?.max_daily_dd_pct ?? null;
  const accountSize = selectedAccount?.account_size ?? 0;
  dailyLossLimitRef.current =
    lossPct != null && lossPct > 0 && accountSize > 0 ? (accountSize * lossPct) / 100 : null;

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

      // Trader's local-day start (not UTC midnight), from the browser timezone.
      const today = startOfLocalDayUtc(browserTimezone()).toISOString();
      const { data: trades } = await supabase
        .from("trades")
        .select("pnl, commission, swap, open_time, status, challenge_id")
        .eq("user_id", user.id)
        .gte("open_time", today)
        .order("open_time", { ascending: true });

      if (cancelled) return;
      strategyRef.current = strat;
      const all = trades ?? [];
      todayRef.current = all.map((t) => ({
        netPnl: (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0),
      }));
      // Today's realised P&L on the active account only (closed trades).
      netTodayRef.current = all
        .filter((t) => t.status === "closed" && (accountId == null || t.challenge_id === accountId))
        .reduce((s, t) => s + (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0), 0);
    })();
    return () => { cancelled = true; };
  }, [strategyId, accountId]);

  function runGuard(pair: string): GuardWarning[] {
    return checkTradeGuard(strategyRef.current, todayRef.current, { pair }, {
      dailyLossLimit: dailyLossLimitRef.current,
      netPnlToday: netTodayRef.current,
    });
  }

  return { runGuard };
}
