"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Strategy {
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
}

interface DayStats {
  todayPnl: number;
  todayCount: number;
  streak: number;
  maxLossEuro: number | null;
  remainingBudget: number | null;
  budgetPct: number;
  maxTradesPerDay: number | null;
  activeSessionStartedAt: string | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function DayStatus() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [stats, setStats] = useState<DayStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [{ data: strat }, { data: trades }, { data: reviews }, { data: accounts }, { data: activeSession }] = await Promise.all([
      supabase.from("strategies").select("max_daily_loss, max_trades_per_day").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("trades").select("pnl, commission, swap").eq("user_id", user.id).gte("open_time", today),
      supabase.from("session_reviews").select("created_at, analysis").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("prop_challenges").select("account_size").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("sessions").select("created_at").eq("user_id", user.id).eq("active", true).gte("created_at", today).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const strategy = strat as Strategy | null;
    const accountSize = accounts?.account_size || 0;
    const todaysTrades = trades || [];
    const todayCount = todaysTrades.length;
    const todayPnl = todaysTrades.reduce((s, tr) => s + netPnl(tr), 0);

    // Discipline streak
    const reviewList = reviews || [];
    let streakCount = 0;
    const seenDays = new Set<string>();
    for (const r of reviewList) {
      const day = r.created_at.split("T")[0];
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      const violations = (r.analysis as { violations?: unknown[] })?.violations;
      if (!violations || violations.length === 0) streakCount++;
      else break;
    }

    const maxDailyLoss = strategy?.max_daily_loss ?? null;
    const maxLossEuro = maxDailyLoss !== null && accountSize > 0 ? (accountSize * maxDailyLoss) / 100 : null;
    const remainingBudget = maxLossEuro !== null ? Math.max(0, maxLossEuro + todayPnl) : null;
    const budgetPct = maxLossEuro !== null && remainingBudget !== null ? (remainingBudget / maxLossEuro) * 100 : 100;

    setStats({
      todayPnl,
      todayCount,
      streak: streakCount,
      maxLossEuro,
      remainingBudget,
      budgetPct,
      maxTradesPerDay: strategy?.max_trades_per_day ?? null,
      activeSessionStartedAt: activeSession?.created_at ?? null,
    });
    setLoading(false);
  }

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-5 skeleton h-40" />;
  }
  if (!stats) return null;

  const { todayPnl, todayCount, streak, maxLossEuro, remainingBudget, budgetPct, maxTradesPerDay, activeSessionStartedAt } = stats;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground">{t("session_state_title")}</h2>
        {activeSessionStartedAt && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-profit/10 border border-profit/30 text-profit text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            {t("day_session_active_since")} {new Date(activeSessionStartedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted">{t("session_today_pnl")}</p>
          <p className={`text-xl font-bold mt-1 ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)} &euro;
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_today_trades")}</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {todayCount}{maxTradesPerDay ? ` / ${maxTradesPerDay}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_streak")}</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {streak > 0 ? `🔥 ${streak}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_risk_budget")}</p>
          {maxLossEuro !== null && remainingBudget !== null ? (
            <p className={`text-xl font-bold mt-1 ${budgetPct > 50 ? "text-profit" : budgetPct > 20 ? "text-orange-400" : "text-loss"}`}>
              {remainingBudget.toFixed(0)} &euro;
            </p>
          ) : (
            <p className="text-xl font-bold mt-1 text-muted">&mdash;</p>
          )}
        </div>
      </div>

      {maxLossEuro !== null && (
        <div className="mt-4">
          {(() => {
            const consumedPct = Math.min(100, Math.max(0, 100 - budgetPct));
            const barColor = consumedPct <= 50 ? "bg-profit" : consumedPct <= 80 ? "bg-orange-400" : "bg-loss";
            return (
              <>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{t("session_budget_label")}</span>
                  <span>{consumedPct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${barColor}`} style={{ width: `${consumedPct}%` }} />
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
