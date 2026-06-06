"use client";

/**
 * StopTradingGuard — detector only (rendering moved to AlertCenter).
 *
 * Watches strategy limits (max_daily_loss / max_trades_per_day /
 * max_consecutive_losses) via Realtime and pushes Alert objects to
 * AlertsContext.  Renders nothing itself.
 */

import { useAlerts, type Alert } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type LimitType = "daily_loss" | "max_trades" | "consecutive_losses";

interface Strategy {
  max_daily_loss: number | null;
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
      // Clear this source's alerts on unmount
      setSourceAlerts(SOURCE_KEY, []);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-push alerts with updated translations when language changes.
  useEffect(() => {
    check();
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const [{ data: strat }, { data: trades }, { data: accounts }] = await Promise.all([
      supabase
        .from("strategies")
        .select("max_daily_loss, max_trades_per_day, max_consecutive_losses")
        .eq("user_id", user.id)
        .limit(1)
        .single(),
      supabase
        .from("trades")
        .select("pnl, commission, swap, open_time, status")
        .eq("user_id", user.id)
        .gte("open_time", today)
        .order("open_time", { ascending: true }),
      supabase
        .from("prop_challenges")
        .select("account_size")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single(),
    ]);

    if (!strat) {
      setSourceAlerts(SOURCE_KEY, []);
      return;
    }

    const strategy: Strategy = strat;
    const todayTrades = trades || [];
    const accountSize = accounts?.account_size || 10000;

    const reached: LimitType[] = [];

    // Check daily loss
    const todayPnl = todayTrades
      .filter((tr) => tr.status === "closed")
      .reduce((s, tr) => s + netPnl(tr), 0);
    if (strategy.max_daily_loss !== null) {
      const maxLossEuro = (accountSize * strategy.max_daily_loss) / 100;
      if (todayPnl <= -maxLossEuro) reached.push("daily_loss");
    }

    // Check max trades per day
    if (
      strategy.max_trades_per_day !== null &&
      todayTrades.length >= strategy.max_trades_per_day
    ) {
      reached.push("max_trades");
    }

    // Check consecutive losses today
    if (strategy.max_consecutive_losses !== null) {
      const closedTrades = todayTrades.filter((tr) => tr.status === "closed");
      let consecutiveLosses = 0;
      for (const tr of closedTrades) {
        if (netPnl(tr) < 0) consecutiveLosses++;
        else consecutiveLosses = 0;
      }
      if (consecutiveLosses >= strategy.max_consecutive_losses) {
        reached.push("consecutive_losses");
      }
    }

    if (reached.length === 0) {
      setSourceAlerts(SOURCE_KEY, []);
      return;
    }

    // Build one Alert per reached limit
    const alerts: Alert[] = reached.map((limitType) => ({
      id: `stop_${limitType}`,
      level: "critical" as const,
      category: "daily_loss",
      message: t(`stop_limit_${limitType}`),
      dismissible: true,
      dismissKey: `stop_${limitType}_${today}`,
    }));

    setSourceAlerts(SOURCE_KEY, alerts);
  }

  // Pure detector — renders nothing.
  return null;
}
