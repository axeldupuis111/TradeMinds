"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { accountCurrency } from "@/lib/account-currency";
import { checkTradeGuard, type GuardStrategy, type GuardWarning } from "@/lib/trade-guard";
import { startOfLocalDayUtc, browserTimezone } from "@/lib/timezone";
import { reglesEcritesDuTrader, type FicheDuTrader } from "@/lib/regles-du-trader";

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

      /**
       * ⚠️⚠️ L'AVERTISSEMENT DIT « TES PAIRES AUTORISÉES » : IL DOIT DONC LES
       * CONNAÎTRE TOUTES. Il ne lisait que la fiche sélectionnée pour la
       * séance, et reprochait à un trader multi-méthodes un instrument qu'une
       * AUTRE de ses fiches autorise noir sur blanc. Mesuré en base le
       * 2026-09-18 : un abonné à trois fiches, dont une « trendline nas100 »,
       * a 92 de ses 157 trades hors de sa fiche la plus ancienne.
       *
       * ⚠️ La fiche de la séance reste lue : c'est elle qui décide si la règle
       * est vérifiable du tout (sans fiche, l'avertissement se tait, comme
       * avant). Ce sont les CHIFFRES et le PÉRIMÈTRE qui viennent de l'ensemble.
       */
      let strat: GuardStrategy | null = null;
      if (strategyId) {
        const { data: fiches } = await supabase
          .from("strategies")
          .select("id, pairs, max_trades_per_day, max_consecutive_losses")
          .eq("user_id", user.id);
        const toutes = (fiches ?? []) as FicheDuTrader[];
        if (toutes.length > 0 && (fiches ?? []).some((f) => f.id === strategyId)) {
          const regles = reglesEcritesDuTrader(toutes);
          strat = {
            pairs: regles.pairs ?? [],
            max_trades_per_day: regles.max_trades_per_day,
            max_consecutive_losses: regles.max_consecutive_losses,
          } as GuardStrategy;
        }
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
      // ⚠️ La devise du compte, sinon le message d'arret parle en euros a
      // quelqu'un dont le compte est en dollars.
      devise: selectedAccount ? accountCurrency(selectedAccount) : undefined,
    });
  }

  return { runGuard };
}
