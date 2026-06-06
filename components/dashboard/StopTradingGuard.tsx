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

import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useAlerts, type Alert } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type LimitType = "daily_loss" | "max_trades" | "consecutive_losses";

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
  const { selectedAccount } = useActiveAccount();
  const supabase = createClient();

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
          () => { if (isMounted) check(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "strategies", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prop_challenges", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); }
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
  }, [selectedAccount?.id, selectedAccount?.max_daily_loss_pct]); // eslint-disable-line react-hooks/exhaustive-deps
  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

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
        .gte("open_time", today)
        .order("open_time", { ascending: true }),
    ]);

    const strategy: Strategy = strat ?? { max_trades_per_day: null, max_consecutive_losses: null };
    const todayTrades = trades || [];

    // todayPnl — global (all accounts), unchanged scope for now.
    const todayPnl = todayTrades
      .filter((tr) => tr.status === "closed")
      .reduce((s, tr) => s + netPnl(tr), 0);

    const reached: LimitType[] = [];
    const alerts: Alert[] = [];

    // ── Daily loss — from ACTIVE ACCOUNT discipline limit ──────────────────
    const accountLossPct = selectedAccount?.max_daily_loss_pct ?? null;
    const accountSize = selectedAccount?.account_size ?? 0;
    if (accountLossPct !== null && accountLossPct > 0 && accountSize > 0) {
      const maxLossEuro = (accountSize * accountLossPct) / 100;
      if (todayPnl <= -maxLossEuro) {
        reached.push("daily_loss");
        const firmLabel = selectedAccount?.firm ?? "";
        alerts.push({
          id: "stop_daily_loss",
          level: "critical" as const,
          category: "daily_loss",
          message: t("stop_limit_daily_loss_account").replace("{firm}", firmLabel),
          dismissible: true,
          dismissKey: `stop_daily_loss_${today}`,
        });
      }
    }

    // ── Max trades per day — from strategy ────────────────────────────────
    if (
      strategy.max_trades_per_day !== null &&
      todayTrades.length >= strategy.max_trades_per_day
    ) {
      reached.push("max_trades");
      alerts.push({
        id: "stop_max_trades",
        level: "critical" as const,
        category: "daily_loss",
        message: t("stop_limit_max_trades"),
        dismissible: true,
        dismissKey: `stop_max_trades_${today}`,
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
        reached.push("consecutive_losses");
        alerts.push({
          id: "stop_consecutive_losses",
          level: "critical" as const,
          category: "daily_loss",
          message: t("stop_limit_consecutive_losses"),
          dismissible: true,
          dismissKey: `stop_consecutive_losses_${today}`,
        });
      }
    }

    setSourceAlerts(SOURCE_KEY, alerts);
  }

  // Pure detector — renders nothing.
  return null;
}
