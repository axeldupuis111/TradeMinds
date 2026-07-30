"use client";

import { DEFAULT_CURRENCY, accountCurrency, money } from "@/lib/account-currency";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { startOfLocalDayUtc, browserTimezone } from "@/lib/timezone";
import { useEffect, useState } from "react";

interface Trade {
  pnl: number;
  commission: number | null;
  swap: number | null;
  close_time: string | null;
  open_time: string;
  status: "open" | "closed";
}

interface Props {
  strategy: {
    max_trades_per_day: number | null;
    max_session_minutes: number | null;
  } | null;
  accountSize: number;
  sessionStartedAt: string | null;
  sessionPausedAt: string | null;
}

function netPnl(tr: Trade) {
  return tr.pnl + (tr.commission || 0) + (tr.swap || 0);
}

function formatSessionDuration(
  minutes: number,
  t: (k: string) => string
): string {
  if (minutes < 60)
    return t("session_duration_mins").replace("{m}", String(minutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) {
    if (m === 0) return t("session_duration_hours").replace("{h}", String(h));
    return t("session_duration_hours_mins")
      .replace("{h}", String(h))
      .replace("{m}", String(m));
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return t("session_duration_days_hours")
    .replace("{d}", String(d))
    .replace("{h}", String(rh));
}

export default function RealTimeGuards({ strategy, accountSize, sessionStartedAt, sessionPausedAt }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const { selectedAccount } = useActiveAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [now, setNow] = useState(Date.now());

  async function loadTrades() {
    if (!selectedAccount) { setTrades([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dayStart = startOfLocalDayUtc(browserTimezone());
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const { data } = await supabase
      .from("trades")
      .select("pnl, commission, swap, close_time, open_time, status")
      .eq("user_id", user.id)
      .eq("challenge_id", selectedAccount.id)
      .gte("open_time", dayStart.toISOString())
      .lt("open_time", dayEnd.toISOString())
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
  }, [selectedAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayPnl = trades
    .filter((tr) => tr.status === "closed")
    .reduce((s, tr) => s + netPnl(tr), 0);
  const tradeCount = trades.length;
  const maxTrades = strategy?.max_trades_per_day ?? null;
  const tradePct = maxTrades ? tradeCount / maxTrades : 0;

  const cur = selectedAccount ? accountCurrency(selectedAccount) : DEFAULT_CURRENCY;
  const lossPct = selectedAccount?.max_daily_loss_pct ?? selectedAccount?.max_daily_dd_pct ?? null;
  const maxLossEuro =
    lossPct != null && lossPct > 0 && accountSize > 0
      ? (accountSize * lossPct) / 100
      : null;
  const lossConsumed = maxLossEuro !== null ? Math.abs(Math.min(0, todayPnl)) / maxLossEuro : 0;

  // Session duration
  const isPaused = sessionPausedAt !== null;
  const sessionDurationMin = sessionStartedAt
    ? Math.max(0, Math.floor((now - new Date(sessionStartedAt).getTime()) / 60000))
    : null;

  const maxSessionMin = strategy?.max_session_minutes ?? null;
  const sessionRatio =
    maxSessionMin && maxSessionMin > 0 && sessionDurationMin !== null
      ? sessionDurationMin / maxSessionMin
      : 0;
  const sessionOverLimit = sessionRatio >= 1;
  const sessionNearLimit = sessionRatio >= 0.8 && sessionRatio < 1;

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
      pnlMsg = t("session_active_margin_remaining").replace("{amount}", money(remaining, cur));
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
          {money(todayPnl, cur, { digits: 2, signed: true })}
        </p>
        {maxLossEuro !== null && !pnlMsg && (
          <p className="text-xs text-muted">
            {t("session_active_margin_remaining").replace(
              "{amount}",
              money(Math.max(0, maxLossEuro + todayPnl), cur)
            )}
          </p>
        )}
        {pnlMsg && <p className={`text-xs font-medium ${pnlColor}`}>{pnlMsg}</p>}
      </div>

      {/* Counter 3 — Session duration */}
      {(() => {
        let durBg = "bg-card border-border";
        let durValueColor = "text-foreground";
        let durMsg = "";
        let durMsgColor = "";

        if (isPaused) {
          durBg = "bg-orange-500/5 border-orange-500/30";
        } else if (sessionOverLimit) {
          durBg = "bg-loss/10 border-loss/30 animate-pulse";
          durValueColor = "text-loss";
          durMsg = `🚨 ${t("session_active_duration_over")}`;
          durMsgColor = "text-loss";
        } else if (sessionNearLimit) {
          durBg = "bg-orange-500/10 border-orange-500/30";
          durValueColor = "text-orange-400";
          durMsg = `⚠️ ${t("session_active_duration_near")}`;
          durMsgColor = "text-orange-400";
        }

        return (
          <div className={`rounded-xl border p-5 flex flex-col gap-2 ${durBg}`}>
            <p className="text-xs text-muted uppercase tracking-wider font-medium">
              {t("session_active_session_duration")}
            </p>
            <p className={`text-3xl md:text-4xl font-bold tabular-nums leading-none whitespace-nowrap ${durValueColor}`}>
              {sessionDurationMin !== null
                ? formatSessionDuration(sessionDurationMin, t)
                : "—"}
              {maxSessionMin !== null && (
                <span className="text-2xl text-muted font-normal"> / {formatSessionDuration(maxSessionMin, t)}</span>
              )}
            </p>
            {isPaused && (
              <p className="text-xs font-medium text-orange-400">
                ⏸️ {t("session_active_duration_paused")}
              </p>
            )}
            {!isPaused && durMsg && (
              <p className={`text-xs font-medium ${durMsgColor}`}>{durMsg}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
