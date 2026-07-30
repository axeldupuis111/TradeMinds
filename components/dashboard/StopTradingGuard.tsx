"use client";

/**
 * StopTradingGuard — detector only (rendering moved to AlertCenter).
 *
 * Watches strategy limits (max_trades_per_day / max_consecutive_losses)
 * and the account discipline daily-loss limit (max_daily_loss_pct from
 * the ACTIVE ACCOUNT via ActiveAccountContext).
 *
 * Daily-loss guard:
 *   - Source of truth: selectedAccount.max_daily_loss_pct (set by the
 *     trader on their account, Phase 1).  No longer read from strategy.
 *   - No active account OR max_daily_loss_pct null/0 → guard is off for
 *     daily loss; no alert pushed.
 *   - todayPnl scope: GLOBAL (all user's closed trades today) — unchanged
 *     from previous behaviour; per-account scope is Phase 3.
 *
 * Other guards (max_trades, consecutive_losses) remain strategy-based.
 */

import { DEFAULT_CURRENCY, accountCurrency, money } from "@/lib/account-currency";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useAlerts, type Alert } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { startOfLocalDayUtc, browserTimezone } from "@/lib/timezone";
import { useEffect, useRef } from "react";

interface Strategy {
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
}

function netPnl(tr: { pnl: number; commission: number | null; swap: number | null }) {
  return tr.pnl + (tr.commission || 0) + (tr.swap || 0);
}

const SOURCE_KEY = "stop-trading";

export default function StopTradingGuard() {
  const { t, lang } = useLanguage();
  const { setSourceAlerts } = useAlerts();
  const { selectedAccount, loading: accountLoading } = useActiveAccount();
  const supabase = createClient();

  // Always points to the latest check() — Realtime callbacks read this ref
  // so they never use a stale closure from the mount render.
  const checkRef = useRef<() => void>(() => {});

  // Keep the ref in sync with the current render's check() after every render.
  useEffect(() => { checkRef.current = check; });

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      await check();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`stop-guard-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) checkRef.current(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "strategies", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) checkRef.current(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prop_challenges", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) checkRef.current(); }
        )
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
      setSourceAlerts(SOURCE_KEY, []);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-push alerts with updated translations on language change.
  useEffect(() => {
    check();
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check when the selected account changes (limit may differ).
  useEffect(() => {
    check();
  }, [accountLoading, selectedAccount?.id, selectedAccount?.max_daily_loss_pct, selectedAccount?.account_size]); // eslint-disable-line react-hooks/exhaustive-deps
  async function check() {
    // Wait for ActiveAccountContext to finish loading before evaluating
    // the discipline limit — avoids overwriting with an empty alert list
    // while selectedAccount is still null.
    if (accountLoading) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!selectedAccount) {
      setSourceAlerts(SOURCE_KEY, []);
      return;
    }

    const today = startOfLocalDayUtc(browserTimezone()).toISOString();

    // Strategy is still the source for max_trades and consecutive_losses.
    const [{ data: strat }, { data: trades }] = await Promise.all([
      supabase
        .from("strategies")
        .select("max_trades_per_day, max_consecutive_losses")
        .eq("user_id", user.id)
        .limit(1)
        .single(),
      supabase
        .from("trades")
        .select("pnl, commission, swap, open_time, status")
        .eq("user_id", user.id)
        .eq("challenge_id", selectedAccount.id)
        .gte("open_time", today)
        .order("open_time", { ascending: true }),
    ]);

    const strategy: Strategy = strat ?? { max_trades_per_day: null, max_consecutive_losses: null };
    const todayTrades = trades || [];

    // todayPnl — scoped to the active account (challenge_id).
    const todayPnl = todayTrades
      .filter((tr) => tr.status === "closed")
      .reduce((s, tr) => s + netPnl(tr), 0);

    const alerts: Alert[] = [];

    // ── Daily loss — graduated paliers from ACTIVE ACCOUNT discipline limit ──
    const accountLossPct = selectedAccount?.max_daily_loss_pct ?? null;
    const accountSize = selectedAccount?.account_size ?? 0;
    if (accountLossPct !== null && accountLossPct > 0 && accountSize > 0) {
      const maxLossEuro = (accountSize * accountLossPct) / 100;
      const usedPct = (-todayPnl) / maxLossEuro;
      const remainingEur = Math.max(0, Math.round(maxLossEuro + todayPnl));
      const pctRounded = Math.round(usedPct * 100);

      if (usedPct >= 0.5) {
        const firmLabel = selectedAccount?.firm ?? "";
        const cur = selectedAccount ? accountCurrency(selectedAccount) : DEFAULT_CURRENCY;
        let level: "critical" | "warning" | "info";
        let message: string;
        let dismissible: boolean;
        let dismissKey: string | undefined;

        if (usedPct >= 1) {
          level = "critical";
          dismissible = true;
          dismissKey = undefined; // in-memory only → overlay re-appears on reload
          message = t("stop_limit_daily_loss_account").replace("{firm}", firmLabel);
        } else if (usedPct >= 0.95) {
          level = "warning";
          dismissible = false;
          message = t("stop_daily_loss_95")
            .replace("{pct}", String(pctRounded))
            .replace("{amount}", money(remainingEur, cur));
        } else if (usedPct >= 0.75) {
          level = "warning";
          dismissible = false;
          message = t("stop_daily_loss_75")
            .replace("{pct}", String(pctRounded))
            .replace("{amount}", money(remainingEur, cur));
        } else {
          level = "info";
          dismissible = false;
          message = t("stop_daily_loss_50")
            .replace("{pct}", String(pctRounded))
            .replace("{amount}", money(remainingEur, cur));
        }

        alerts.push({
          id: "stop_daily_loss",
          level,
          category: "daily_loss",
          message,
          dismissible,
          ...(dismissKey ? { dismissKey } : {}),
        });
      }
    }

    // ── Max trades per day — from strategy ────────────────────────────────
    if (
      strategy.max_trades_per_day !== null &&
      todayTrades.length >= strategy.max_trades_per_day
    ) {
      alerts.push({
        id: "stop_max_trades",
        level: "warning" as const,
        category: "daily_loss",
        message: t("warn_max_trades"),
        dismissible: false,
      });
    }

    // ── Consecutive losses — from strategy ────────────────────────────────
    if (strategy.max_consecutive_losses !== null) {
      const closedTrades = todayTrades.filter((tr) => tr.status === "closed");
      let consecutiveLosses = 0;
      for (const tr of closedTrades) {
        if (netPnl(tr) < 0) consecutiveLosses++;
        else consecutiveLosses = 0;
      }
      if (consecutiveLosses >= strategy.max_consecutive_losses) {
        alerts.push({
          id: "stop_consecutive_losses",
          level: "warning" as const,
          category: "daily_loss",
          message: t("warn_consecutive_losses").replace("{n}", String(consecutiveLosses)),
          dismissible: false,
        });
      }
    }

    setSourceAlerts(SOURCE_KEY, alerts);
  }

  // Pure detector — renders nothing.
  return null;
}
