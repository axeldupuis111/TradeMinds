"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import TradingCalendar from "@/components/charts/TradingCalendar";
import { AiInsights } from "@/components/dashboard/AiInsights";
import DayState from "@/components/dashboard/DayState";
import GoalsStreaks from "@/components/dashboard/GoalsStreaks";
import OnboardingChecklist, { type OnboardingState } from "@/components/dashboard/OnboardingChecklist";
import CapitalLeaks from "@/components/dashboard/CapitalLeaks";
import { DemoDataBanner, DemoDataCta } from "@/components/dashboard/DemoData";
import PatternAlerts from "@/components/dashboard/PatternAlerts";
import WeeklyPlanCard from "@/components/dashboard/WeeklyPlanCard";
import WeeklyRecap from "@/components/dashboard/WeeklyRecap";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useTheme } from "@/lib/ThemeContext";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import {
  AlertTriangle,
  Lock,
  Play,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { countLockedFeatures } from "@/lib/plan-features";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import StaggerContainer, { StaggerItem } from "@/components/animations/StaggerContainer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradeData {
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
}

interface TradeWithTime extends TradeData {
  open_time: string;
  close_time?: string | null;
  pair: string;
  direction: string;
  lot_size?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
}

interface RecentTrade extends TradeWithTime {
  id: string;
  close_time?: string | null;
  lot_size?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
}

interface ActiveAccount {
  id: string;
  firm: string;
  account_number: string | null;
  account_size: number;
  profit_target_pct: number;
  max_total_dd_pct: number;
  max_daily_dd_pct: number | null;
  max_daily_loss_pct: number | null;
  balance: number;
  type: string;
}

interface Props {
  displayName: string;
  score: number | null;
  scoreColor: string; // kept for API compat with dashboard/page.tsx — not used in render
  weekTrades: TradeData[];
  monthTrades: TradeData[];
  todayTrades: TradeData[];
  activeAccounts: ActiveAccount[];
  recentTrades: RecentTrade[];
  lastReview: {
    discipline_score: number;
    created_at: string;
    analysis?: {
      recommendations?: string[];
      strengths?: string[];
      patterns?: { type: string; description: string }[];
    };
  } | null;
  allTrades: TradeWithTime[];
  maxTradesPerDay: number | null;
  allowedPairs: string[] | null;
  onboarding: OnboardingState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** Smart price formatter — adapts decimal places to the instrument magnitude */
function fmtPrice(p: number): string {
  if (p >= 10000) return p.toFixed(0);
  if (p >= 100)   return p.toFixed(2);
  if (p >= 1)     return p.toFixed(4);
  return p.toFixed(5);
}

/** Button-style class strings for action Links in the header */
const linkBtnBase =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 h-8 px-3 text-xs";
const linkBtnSecondary =
  "bg-surface text-foreground border border-border hover:bg-border/60";
const linkBtnPrimary =
  "bg-accent text-background hover:bg-accent-hover";

// ─── Last-review score class (tokens only) ───────────────────────────────────

function reviewScoreClass(s: number): string {
  if (s >= 75) return "text-profit";
  if (s >= 40) return "text-warning";
  return "text-loss";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardContent({
  displayName,
  score,
  // scoreColor is unused — KpiCards/ScoreRing compute colors from score directly
  weekTrades,
  monthTrades,
  todayTrades,
  activeAccounts,
  recentTrades,
  lastReview,
  allTrades,
  maxTradesPerDay,
  allowedPairs,
  onboarding,
}: Props) {
  const { t } = useLanguage();
  const { plan, canUseAI, loading: planLoading } = usePlan();
  const { theme } = useTheme();
  const prefersReduced = useReducedMotion();
  const isDark = theme !== "light";
  const { selectedAccountId, setSelectedAccountId } = useActiveAccount();
  const [upsellDismissed, setUpsellDismissed] = useState(false);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filterByAccount = useCallback(<T extends { challenge_id: string | null }>(trades: T[]): T[] => {
    if (!selectedAccountId) return trades;
    return trades.filter((tr) => tr.challenge_id === selectedAccountId);
  }, [selectedAccountId]);

  const filteredWeek   = useMemo(() => filterByAccount(weekTrades),   [filterByAccount, weekTrades]);
  const filteredMonth  = useMemo(() => filterByAccount(monthTrades),  [filterByAccount, monthTrades]);
  const filteredToday  = useMemo(() => filterByAccount(todayTrades),  [filterByAccount, todayTrades]);
  const filteredAll    = useMemo(() => filterByAccount(allTrades),    [filterByAccount, allTrades]);
  const filteredRecent = useMemo(() => filterByAccount(recentTrades), [filterByAccount, recentTrades]);

  // ── Computed KPI values ────────────────────────────────────────────────────
  const useMonthFallback   = filteredWeek.length === 0 && filteredMonth.length > 0;
  const activePeriodTrades = useMonthFallback ? filteredMonth : filteredWeek;
  const weekCount          = activePeriodTrades.length;
  const weekWins           = activePeriodTrades.filter((tr) => netPnl(tr) > 0).length;
  const todayPnl           = filteredToday.reduce((sum, tr) => sum + netPnl(tr), 0);
  const totalPnl           = useMemo(() => filteredAll.reduce((sum, tr) => sum + netPnl(tr), 0), [filteredAll]);

  // ── Account ────────────────────────────────────────────────────────────────
  const selectedAccount = selectedAccountId
    ? activeAccounts.find((a) => a.id === selectedAccountId) ?? null
    : null;
  const displayAccount = selectedAccount || (activeAccounts.length === 1 ? activeAccounts[0] : null);

  const profitTargetAmount = displayAccount && displayAccount.profit_target_pct > 0
    ? (displayAccount.account_size * displayAccount.profit_target_pct) / 100
    : 0;
  const challengePct = profitTargetAmount > 0
    ? Math.max(0, Math.min(100, ((displayAccount!.balance - displayAccount!.account_size) / profitTargetAmount) * 100))
    : null;

  // ── Drawdown ───────────────────────────────────────────────────────────────
  const ddMax  = displayAccount ? displayAccount.account_size * displayAccount.max_total_dd_pct / 100 : 0;
  const ddUsed = displayAccount ? Math.max(0, displayAccount.account_size - displayAccount.balance) : 0;
  const ddPct  = ddMax > 0 ? (ddUsed / ddMax) * 100 : 0;

  // ── Calendar discipline overlay (process, not P&L) ───────────────────────────
  const calendarRules = useMemo(() => {
    const lossPct = displayAccount?.max_daily_loss_pct ?? displayAccount?.max_daily_dd_pct ?? null;
    const size = displayAccount?.account_size ?? 0;
    const maxDailyLossEur = lossPct != null && lossPct > 0 && size > 0 ? (size * lossPct) / 100 : null;
    return { maxTradesPerDay, maxDailyLossEur, allowedPairs };
  }, [displayAccount, maxTradesPerDay, allowedPairs]);

  // ── Equity curve ───────────────────────────────────────────────────────────
  const equityCurveData = useMemo(() => {
    if (filteredAll.length === 0) return [];
    const initial = displayAccount?.account_size ?? 0;
    let running = initial;
    return filteredAll.map((tr) => {
      running += netPnl(tr);
      return { date: tr.open_time.split("T")[0] || tr.open_time, balance: running };
    });
  }, [filteredAll, displayAccount]);

  const initialBalance = displayAccount?.account_size ?? 0;

  // ── AI Insights ────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!lastReview?.analysis) return [];
    const items: string[] = [];
    const a = lastReview.analysis;
    if (a.patterns      && a.patterns.length      > 0) items.push(a.patterns[0].description);
    if (a.recommendations && a.recommendations.length > 0) items.push(a.recommendations[0]);
    if (a.strengths     && a.strengths.length     > 0) items.push(a.strengths[0]);
    return items.slice(0, 4);
  }, [lastReview]);

  // ── Date & salutation selon l'heure ───────────────────────────────────────
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const hourNow = new Date().getHours();
  const greetingKey =
    hourNow < 6 ? "greeting_evening"
    : hourNow < 12 ? "greeting_morning"
    : hourNow < 18 ? "greeting_afternoon"
    : "greeting_evening";

  // ── Sparkline series for P&L card (cumulative today PnL per trade) ────────
  const todayPnlSeries = useMemo(() => {
    let running = 0;
    return filteredToday.map((tr) => {
      running += netPnl(tr);
      return running;
    });
  }, [filteredToday]);

  // ── Equity fallback sparkline — derniers 7 points de l'equity curve ───────
  const equitySparkSeries = useMemo(
    () => equityCurveData.slice(-7).map((d) => d.balance),
    [equityCurveData]
  );

  // ── KpiCards props ─────────────────────────────────────────────────────────
  const kpiDisplayAccount = displayAccount
    ? {
        firm: displayAccount.firm,
        accountNumber: displayAccount.account_number,
        balanceChange: displayAccount.balance - displayAccount.account_size,
      }
    : null;

  return (
    <div>
      {/* ── Mode démo : bannière tant que des trades fictifs existent.
           key sur le volume de trades : router.refresh() après injection/
           purge remonte le composant, qui re-vérifie son état. ── */}
      <DemoDataBanner key={`demo-${allTrades.length}`} />

      {/* ── Onboarding / activation ──────────────────────────────────── */}
      <OnboardingChecklist state={onboarding} />

      {/* ── Mode démo : proposer des données fictives si compte vide ── */}
      {allTrades.length === 0 && <DemoDataCta />}

      {/* ── « Ce que tu rates » : les fonctionnalités verrouillées, visibles.
           Remplace l'ancienne bannière upsell générique — un free doit VOIR
           ce qui lui manque, pas le découvrir en cliquant au hasard. ── */}
      {!planLoading && plan === "free" && !upsellDismissed && (
        <div className="mb-4 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-gold shrink-0" strokeWidth={1.75} />
              {t("missing_title")}
            </p>
            <button
              onClick={() => setUpsellDismissed(true)}
              className="text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
            {(["missing_1", "missing_2", "missing_3", "missing_4"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2 text-sm text-foreground-muted">
                <Lock className="w-3.5 h-3.5 text-gold/70 mt-0.5 shrink-0" strokeWidth={1.75} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
          >
            {t("missing_cta").replace("{n}", String(countLockedFeatures("free")))} →
          </Link>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
            <span>
              {t(greetingKey)},{" "}
              <span
                className="text-gradient-animated"
                style={{
                  background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #60a5fa 45%, #a78bfa 75%, rgb(var(--accent)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {displayName}
              </span>
            </span>
            <motion.span
              className="inline-block origin-[70%_70%] text-xl"
              initial={false}
              animate={prefersReduced ? undefined : { rotate: [0, 16, -7, 14, 0] }}
              transition={{ duration: 1.1, delay: 0.4, ease: "easeInOut" }}
              aria-hidden
            >
              👋
            </motion.span>
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-foreground-muted text-sm capitalize">{dateStr}</p>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span
                className="w-2 h-2 rounded-full bg-accent motion-safe:animate-pulse shrink-0"
                style={isDark ? { boxShadow: "0 0 8px rgba(0,229,208,.5)" } : undefined}
              />
              <span className="text-xs text-foreground-muted">{t("live_indicator")}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeAccounts.length > 0 && (
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">{t("dash_all_accounts")}</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firm} — {a.account_number || a.account_size.toLocaleString() + "€"}
                </option>
              ))}
            </select>
          )}

          <Link href="/dashboard/trades" className={cn(linkBtnBase, linkBtnSecondary)}>
            <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("dash_action_import")}
          </Link>

          <Link href="/dashboard/analysis" className={cn(linkBtnBase, linkBtnSecondary)}>
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("dash_action_analyze")}
          </Link>

          <Link href="/dashboard/session" className={cn(linkBtnBase, linkBtnPrimary)}>
            <Play className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("dash_action_session")}
          </Link>
        </div>
      </div>

      {/* ── Compte sans trade alors que d'autres en ont ──────────────── */}
      {selectedAccountId && filteredAll.length === 0 && allTrades.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-surface/60 border border-border rounded-xl">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-foreground flex-1 min-w-[200px]">
            {t("dash_account_no_trades").replace("{count}", String(allTrades.length))}
          </p>
          <button
            onClick={() => setSelectedAccountId("")}
            className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
          >
            {t("dash_account_no_trades_cta")}
          </button>
        </div>
      )}

      {/* ── Blocs Dashboard — stagger cascade au montage ────────────── */}
      <StaggerContainer staggerDelay={0.08}>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <KpiCards
          score={score}
          weekCount={weekCount}
          weekWins={weekWins}
          useMonthFallback={useMonthFallback}
          todayPnl={todayPnl}
          filteredTodayCount={filteredToday.length}
          todayPnlSeries={todayPnlSeries}
          equitySparkSeries={equitySparkSeries}
          displayAccount={kpiDisplayAccount}
          challengePct={challengePct}
          activeAccountsCount={activeAccounts.length}
          totalPnl={totalPnl}
        />
      </StaggerItem>

      {/* ── État du jour ─────────────────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <DayState />
      </StaggerItem>

      {/* ── Coach temps réel — patterns du trader en alertes live ────── */}
      <StaggerItem className="mt-6">
        <PatternAlerts />
      </StaggerItem>

      {/* ── Fuites de capital — le coût chiffré de l'indiscipline ────── */}
      <StaggerItem className="mt-6">
        <CapitalLeaks />
      </StaggerItem>

      {/* ── Bilan de la semaine ──────────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <WeeklyRecap trades={filteredAll} />
      </StaggerItem>

      {/* ── Plan de la semaine (IA, prospectif) ──────────────────────── */}
      <StaggerItem className="mt-6">
        <WeeklyPlanCard />
      </StaggerItem>

      {/* ── AI Insights + Equity Curve ───────────────────────────────── */}
      <StaggerItem>
        {canUseAI ? (
          <div className={cn(
            "mt-6 grid gap-4",
            equityCurveData.length > 0 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          )}>
            <AiInsights insights={insights} filteredAllLength={filteredAll.length} />
            {equityCurveData.length > 0 && (
              <EquityCurve data={equityCurveData} initialBalance={initialBalance} />
            )}
          </div>
        ) : equityCurveData.length > 0 ? (
          <div className="mt-6">
            <EquityCurve data={equityCurveData} initialBalance={initialBalance} />
          </div>
        ) : null}
      </StaggerItem>

      {/* ── Trading Calendar ─────────────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <TradingCalendar trades={allTrades} selectedAccountId={selectedAccountId} rules={calendarRules} />
      </StaggerItem>

      {/* ── Position sizer shortcut ──────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <Link href="/dashboard/session" className="block group">
          <KpiCardPremium layout="full" intensity="default" accentColor="cyan">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">📐</span>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{t("dash_sizer_card_title")}</CardTitle>
                    {plan !== "premium" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{t("dash_sizer_card_desc")}</p>
                </div>
              </div>
              <svg
                className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </KpiCardPremium>
        </Link>
      </StaggerItem>

      {/* ── Goals & Streaks ──────────────────────────────────────────── */}
      <StaggerItem className="mt-6">
        <GoalsStreaks />
      </StaggerItem>

      {/* ── Bottom : Recent trades + Last analysis + DD alert ────────── */}
      <StaggerItem>
      <div className={cn(
        "grid grid-cols-1 gap-4 mt-6",
        (canUseAI || (displayAccount && ddPct > 75)) ? "lg:grid-cols-2" : ""
      )}>

        {/* Recent trades */}
        <KpiCardPremium layout="full" intensity="default" accentColor="violet">
          <CardHeader>
            <CardTitle>{t("dash_recent_trades")}</CardTitle>
            <Link href="/dashboard/trades" className="text-xs text-accent hover:underline">
              {t("dash_see_all")}
            </Link>
          </CardHeader>
          {filteredRecent.length === 0 ? (
            <p className="text-foreground-muted text-sm">{t("dash_no_trades")}</p>
          ) : (
            <div className="space-y-0">
              {filteredRecent.map((tr) => {
                const net = netPnl(tr);
                const isBuy = tr.direction === "long" || tr.direction === "buy";
                return (
                  <div
                    key={tr.id}
                    className="group flex items-center gap-3 py-2 border-b border-border last:border-0 -mx-1 px-1 rounded-lg transition-colors hover:bg-foreground/[0.04]"
                  >
                    {/* Left: date + pair + badge */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-foreground-muted text-xs tabular-nums w-12 shrink-0">
                        {tr.open_time
                          ? new Date(tr.open_time).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </span>
                      <span className="text-foreground text-sm font-medium truncate">{tr.pair}</span>
                      <Badge variant={isBuy ? "success" : "danger"} size="sm">
                        {isBuy ? "BUY" : "SELL"}
                      </Badge>
                    </div>
                    {/* Sparkline / Reveal hover — conteneur fixe, pas de saut de layout */}
                    <div className="shrink-0 w-[88px] h-[34px] sm:w-[104px] sm:h-[36px] relative overflow-hidden">
                      {/* Sparkline — disparaît au hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-0 transition-opacity duration-150">
                        <Sparkline data={[0, net]} positive={net >= 0} width={80} height={18} glow={isDark} />
                      </div>
                      {/* Révélation enrichie : heure · lot / entry→exit / frais */}
                      <div className="absolute inset-0 flex flex-col justify-center gap-px opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                        {/* Ligne 1 — heure + taille de lot */}
                        <p className="text-[10px] text-foreground-muted tabular-nums leading-none">
                          {tr.open_time
                            ? new Date(tr.open_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                          {tr.lot_size != null && tr.lot_size > 0
                            ? ` · ${tr.lot_size}`
                            : ""}
                        </p>
                        {/* Ligne 2 — prix entrée → sortie (si disponibles) */}
                        {tr.entry_price != null && tr.exit_price != null && (
                          <p className="text-[10px] text-foreground tabular-nums leading-none">
                            {fmtPrice(tr.entry_price)}
                            <span className="text-foreground-subtle mx-px">→</span>
                            {fmtPrice(tr.exit_price)}
                          </p>
                        )}
                        {/* Ligne 3 — frais (si non nuls) */}
                        {((tr.commission ?? 0) + (tr.swap ?? 0)) !== 0 && (
                          <p className="text-[9px] text-foreground-subtle tabular-nums leading-none">
                            {((tr.commission ?? 0) + (tr.swap ?? 0)) > 0 ? "+" : ""}
                            {((tr.commission ?? 0) + (tr.swap ?? 0)).toFixed(2)}€
                          </p>
                        )}
                      </div>
                    </div>
                    {/* P&L */}
                    <span className={cn("text-sm font-medium tabular-nums shrink-0", net >= 0 ? "text-profit" : "text-loss")}>
                      {net >= 0 ? "+" : ""}{net.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </KpiCardPremium>

        {/* Right column */}
        {(canUseAI || (displayAccount && ddPct > 75)) && (
          <div className="space-y-4">

            {/* Last analysis — Plus only */}
            {canUseAI && (
              <KpiCardPremium layout="full" intensity="default" accentColor="cyan">
                <CardHeader>
                  <CardTitle>{t("dash_last_analysis")}</CardTitle>
                  {lastReview && (
                    <Link href="/dashboard/analysis" className="text-xs text-accent hover:underline">
                      {t("dash_see_all")}
                    </Link>
                  )}
                </CardHeader>
                {lastReview ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-foreground-muted text-xs">
                        {new Date(lastReview.created_at).toLocaleDateString(undefined, {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </span>
                      <span className={cn("text-xl font-bold tabular-nums", reviewScoreClass(lastReview.discipline_score))}>
                        {lastReview.discipline_score}/100
                      </span>
                    </div>
                    {insights.length > 0 && (
                      <p className="text-xs text-foreground-muted leading-relaxed line-clamp-2">{insights[0]}</p>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/dashboard/analysis"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/30 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 hover:border-accent/50 transition-colors"
                  >
                    {t("dash_run_ai_analysis")}
                  </Link>
                )}
              </KpiCardPremium>
            )}

            {/* Drawdown alert */}
            {displayAccount && ddPct > 75 && (
              <div className={cn(
                "border rounded-xl p-5",
                ddPct > 90 ? "bg-loss/5 border-loss/20" : "bg-warning/5 border-warning/20"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle
                    className={cn("w-5 h-5", ddPct > 90 ? "text-loss" : "text-warning")}
                    strokeWidth={1.5}
                  />
                  <h2 className={cn("text-sm font-semibold", ddPct > 90 ? "text-loss" : "text-warning")}>
                    {ddPct > 90 ? t("dash_dd_critical") : t("dash_dd_high")}
                  </h2>
                </div>
                <p className="text-foreground text-sm">
                  {displayAccount.firm} — Drawdown{" "}
                  <span className="font-bold tabular-nums">{ddPct.toFixed(1)}%</span>
                  {" "}({ddUsed.toFixed(0)}€ / {ddMax.toFixed(0)}€)
                </p>
              </div>
            )}

          </div>
        )}
      </div>
      </StaggerItem>

      </StaggerContainer>
    </div>
  );
}
