"use client";

/**
 * DayState — bloc "État du jour" pour le Dashboard.
 * Version stylisée avec les composants UI canoniques.
 * (Ne pas confondre avec DayStatus dans components/DayStatus.tsx,
 * toujours utilisé par la page Session.)
 */

import { CardTitle } from "@/components/ui/Card";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";
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

// ─── Mini progress ring (Trades du jour) ──────────────────────────────────────
// Toujours visible : track gris + arc cyan (même à 0% on voit le cercle de fond)

function MiniRing({ value, max, size = 32, isDark }: { value: number; max: number; size?: number; isDark: boolean }) {
  const sw = 3.5;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - sw * 2 - 2) / 2;  // bord interne propre
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);
  // Track visible même en dark : blanc très transparent
  const trackColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      {isDark && (
        <defs>
          <filter id="daystate-ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {/* Track — toujours affiché pour ancrer le cercle visuellement */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={sw}
      />
      {/* Arc de remplissage — masqué si 0% */}
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          filter={isDark ? "url(#daystate-ring-glow)" : undefined}
        />
      )}
    </svg>
  );
}

// ─── Mini segmented bar (Budget risque) ───────────────────────────────────────

function MiniSegBar({ pct, isDark }: { pct: number; isDark: boolean }) {
  const segments = 4;
  const filledCount = Math.max(0, Math.round((pct / 100) * segments));
  const color = pct > 50 ? "bg-accent" : pct > 20 ? "bg-warning" : "bg-loss";
  const glowColor = pct > 50
    ? "0 0 6px rgba(0,212,216,0.55)"
    : pct > 20
      ? "0 0 6px rgba(245,158,11,0.50)"
      : "0 0 6px rgba(239,68,68,0.50)";

  return (
    <div className="flex gap-0.5 mt-1.5" aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={cn("h-2.5 w-3 rounded-sm transition-colors", i < filledCount ? color : "bg-border")}
          style={isDark && i < filledCount ? { boxShadow: glowColor } : undefined}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DayState() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
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
      todayPnl, todayCount, streak: streakCount,
      maxLossEuro, remainingBudget, budgetPct,
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
  const consumedPct = Math.min(100, Math.max(0, 100 - budgetPct));
  const barColor = consumedPct <= 50 ? "bg-profit" : consumedPct <= 80 ? "bg-warning" : "bg-loss";

  return (
    <KpiCardPremium layout="full" intensity="default" accentColor="amber">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <CardTitle>{t("session_state_title")}</CardTitle>
        {activeSessionStartedAt && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-profit/10 border border-profit/30 text-profit text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            {t("day_session_active_since")}{" "}
            {new Date(activeSessionStartedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        {/* P&L aujourd'hui — badge directionnel bien visible */}
        <div>
          <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider">
            {t("session_today_pnl")}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-xl font-bold tabular-nums", todayPnl >= 0 ? "text-profit" : "text-loss")}>
              {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)} &euro;
            </span>
            {/* Badge icône — seulement si le P&L est non nul */}
            {todayPnl > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-profit/15 text-profit shrink-0">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            )}
            {todayPnl < 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-loss/15 text-loss shrink-0">
                <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            )}
          </div>
        </div>

        {/* Trades du jour — anneau de progression (toujours visible si maxTradesPerDay défini) */}
        <div>
          <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider">
            {t("session_today_trades")}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xl font-bold text-foreground tabular-nums">
              {todayCount}{maxTradesPerDay ? ` / ${maxTradesPerDay}` : ""}
            </p>
            {maxTradesPerDay && (
              <MiniRing value={todayCount} max={maxTradesPerDay} size={32} isDark={isDark} />
            )}
          </div>
        </div>

        {/* Streak — flamme animée si streak > 0 */}
        <div>
          <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider">
            {t("session_streak")}
          </p>
          <p className="text-xl font-bold mt-1 text-foreground tabular-nums flex items-center gap-1.5">
            {streak > 0 && (
              <Flame className="w-4 h-4 text-warning shrink-0 motion-safe:animate-pulse" strokeWidth={1.75} />
            )}
            {streak}
          </p>
        </div>

        {/* Budget risque — mini-segments si data disponible */}
        <div>
          <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider">
            {t("session_risk_budget")}
          </p>
          {maxLossEuro !== null && remainingBudget !== null ? (
            <>
              <p className={cn(
                "text-xl font-bold mt-1 tabular-nums",
                budgetPct > 50 ? "text-profit" : budgetPct > 20 ? "text-warning" : "text-loss"
              )}>
                {remainingBudget.toFixed(0)} &euro;
              </p>
              <MiniSegBar pct={budgetPct} isDark={isDark} />
            </>
          ) : (
            <p className="text-xl font-bold mt-1 text-foreground-muted">&mdash;</p>
          )}
        </div>

      </div>

      {maxLossEuro !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-foreground-subtle mb-1">
            <span>{t("session_budget_label")}</span>
            <span className="tabular-nums">{consumedPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className={cn("h-full transition-all", barColor)} style={{ width: `${consumedPct}%` }} />
          </div>
        </div>
      )}
    </KpiCardPremium>
  );
}
