"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Trade {
  pnl: number;
  commission: number | null;
  swap: number | null;
  close_time: string | null;
  open_time: string;
}

interface Props {
  strategy: {
    max_daily_loss: number | null;
    max_trades_per_day: number | null;
  } | null;
  accountSize: number;
}

function netPnl(tr: Trade) {
  return tr.pnl + (tr.commission || 0) + (tr.swap || 0);
}

function formatTimeSince(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function RealTimeGuards({ strategy, accountSize }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [now, setNow] = useState(Date.now());

  async function loadTrades() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("trades")
      .select("pnl, commission, swap, close_time, open_time")
      .eq("user_id", user.id)
      .gte("open_time", today + "T00:00:00")
      .lte("open_time", today + "T23:59:59")
      .order("open_time", { ascending: false });
    setTrades(data || []);
  }

  useEffect(() => {
    loadTrades();
    const tradeInterval = setInterval(loadTrades, 30000);
    const clockInterval = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearInterval(tradeInterval);
      clearInterval(clockInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayPnl = trades.reduce((s, tr) => s + netPnl(tr), 0);
  const tradeCount = trades.length;
  const maxTrades = strategy?.max_trades_per_day ?? null;
  const tradePct = maxTrades ? tradeCount / maxTrades : 0;

  const maxLossEuro =
    strategy?.max_daily_loss != null && accountSize > 0
      ? (accountSize * strategy.max_daily_loss) / 100
      : null;
  const lossConsumed = maxLossEuro !== null ? Math.abs(Math.min(0, todayPnl)) / maxLossEuro : 0;

  // Find last closed trade (closest close_time to now)
  const lastClosedTrade = trades
    .filter((tr) => tr.close_time !== null)
    .sort((a, b) => new Date(b.close_time!).getTime() - new Date(a.close_time!).getTime())[0] ?? null;
  const timeSinceMs = lastClosedTrade?.close_time
    ? now - new Date(lastClosedTrade.close_time).getTime()
    : null;
  const timeSinceMin = timeSinceMs !== null ? Math.floor(timeSinceMs / 60000) : null;
  const lastTradeWasLoss = lastClosedTrade ? netPnl(lastClosedTrade) < 0 : false;
  const isRevengeRisk = lastTradeWasLoss && timeSinceMin !== null && timeSinceMin < 15;

  // — Trade count card —
  let tradeColor = "text-profit";
  let tradeBg = "bg-profit/5 border-profit/20";
  let tradeMsg = "";
  if (maxTrades !== null) {
    const remaining = maxTrades - tradeCount;
    if (tradeCount >= maxTrades) {
      tradeColor = "text-loss";
      tradeBg = "bg-loss/10 border-loss/30 animate-pulse";
      tradeMsg = `⚠️ ${t("session_active_limit_reached")}`;
    } else if (tradePct >= 0.7) {
      tradeColor = "text-orange-400";
      tradeBg = "bg-orange-500/10 border-orange-500/30";
      tradeMsg =
        remaining === 1
          ? t("session_active_trade_remaining_one")
          : t("session_active_trades_remaining").replace("{n}", String(remaining));
    } else {
      tradeMsg = t("session_active_trades_remaining").replace("{n}", String(remaining));
    }
  }

  // — Drawdown card —
  let pnlColor = todayPnl >= 0 ? "text-profit" : "text-foreground";
  let pnlBg = todayPnl >= 0 ? "bg-profit/5 border-profit/20" : "bg-card border-border";
  let pnlMsg = "";
  if (todayPnl < 0 && maxLossEuro !== null) {
    if (lossConsumed >= 0.8) {
      pnlColor = "text-loss";
      pnlBg = "bg-loss/10 border-loss/30 animate-pulse";
      pnlMsg = `🚨 ${t("session_active_stop_warning")}`;
    } else if (lossConsumed >= 0.5) {
      pnlColor = "text-orange-400";
      pnlBg = "bg-orange-500/10 border-orange-500/30";
      const remaining = maxLossEuro + todayPnl;
      pnlMsg = t("session_active_margin_remaining").replace("{amount}", remaining.toFixed(0) + "€");
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Counter 1 — Trades taken */}
      <div className={`rounded-xl border p-5 flex flex-col gap-2 ${tradeBg}`}>
        <p className="text-xs text-muted uppercase tracking-wider font-medium">
          {t("session_active_trades_taken")}
        </p>
        <p className={`text-5xl md:text-6xl font-bold tabular-nums leading-none ${tradeColor}`}>
          {tradeCount}
          {maxTrades !== null && (
            <span className="text-3xl text-muted font-normal"> / {maxTrades}</span>
          )}
        </p>
        {tradeMsg && (
          <p className={`text-xs font-medium ${tradeColor}`}>{tradeMsg}</p>
        )}
      </div>

      {/* Counter 2 — Drawdown */}
      <div className={`rounded-xl border p-5 flex flex-col gap-2 ${pnlBg}`}>
        <p className="text-xs text-muted uppercase tracking-wider font-medium">
          {t("session_active_drawdown_title")}
        </p>
        <p className={`text-5xl md:text-6xl font-bold tabular-nums leading-none ${pnlColor}`}>
          {todayPnl >= 0 ? "+" : ""}
          {todayPnl.toFixed(2)}€
        </p>
        {maxLossEuro !== null && !pnlMsg && (
          <p className="text-xs text-muted">
            {t("session_active_margin_remaining").replace(
              "{amount}",
              Math.max(0, maxLossEuro + todayPnl).toFixed(0) + "€"
            )}
          </p>
        )}
        {pnlMsg && <p className={`text-xs font-medium ${pnlColor}`}>{pnlMsg}</p>}
      </div>

      {/* Counter 3 — Time since last trade */}
      <div
        className={`rounded-xl border p-5 flex flex-col gap-2 ${
          isRevengeRisk ? "bg-loss/10 border-loss/30 animate-pulse" : "bg-card border-border"
        }`}
      >
        <p className="text-xs text-muted uppercase tracking-wider font-medium">
          {t("session_active_time_since_last_trade")}
        </p>
        <p
          className={`text-5xl md:text-6xl font-bold tabular-nums leading-none ${
            isRevengeRisk ? "text-loss" : "text-foreground"
          }`}
        >
          {timeSinceMin !== null ? formatTimeSince(timeSinceMin) : "—"}
        </p>
        {isRevengeRisk && (
          <p className="text-xs font-medium text-loss">
            ⚠️ {t("session_active_revenge_warning")}
          </p>
        )}
      </div>
    </div>
  );
}
