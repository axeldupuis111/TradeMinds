"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import TradingCalendar from "@/components/charts/TradingCalendar";
import DayStatus from "@/components/DayStatus";
import GoalsStreaks from "@/components/dashboard/GoalsStreaks";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

interface TradeData {
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
}

interface TradeWithTime extends TradeData {
  open_time: string;
  pair: string;
  direction: string;
}

interface RecentTrade extends TradeWithTime {
  id: string;
  pair: string;
  direction: string;
}

interface ActiveAccount {
  id: string;
  firm: string;
  account_number: string | null;
  account_size: number;
  profit_target_pct: number;
  max_total_dd_pct: number;
  balance: number;
  type: string;
}

interface Props {
  displayName: string;
  score: number | null;
  scoreColor: string;
  weekTrades: TradeData[];
  todayTrades: TradeData[];
  activeAccounts: ActiveAccount[];
  recentTrades: RecentTrade[];
  lastReview: { discipline_score: number; created_at: string; analysis?: { recommendations?: string[]; strengths?: string[]; patterns?: { type: string; description: string }[] } } | null;
  allTrades: TradeWithTime[];
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

function MiniScoreCircle({ score }: { score: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={radius} fill="none" stroke="rgb(var(--border))" strokeWidth="3" />
      <circle cx="18" cy="18" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 18 18)" className="transition-all duration-700" />
    </svg>
  );
}

export default function DashboardContent({
  displayName,
  score,
  scoreColor,
  weekTrades,
  todayTrades,
  activeAccounts,
  recentTrades,
  lastReview,
  allTrades,
}: Props) {
  const { t } = useLanguage();
  const { plan } = usePlan();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [upsellDismissed, setUpsellDismissed] = useState(false);

  const filterByAccount = useCallback(<T extends { challenge_id: string | null }>(trades: T[]): T[] => {
    if (!selectedAccountId) return trades;
    return trades.filter((tr) => tr.challenge_id === selectedAccountId);
  }, [selectedAccountId]);

  const filteredWeek = useMemo(() => filterByAccount(weekTrades), [filterByAccount, weekTrades]);
  const filteredToday = useMemo(() => filterByAccount(todayTrades), [filterByAccount, todayTrades]);
  const filteredAll = useMemo(() => filterByAccount(allTrades), [filterByAccount, allTrades]);
  const filteredRecent = useMemo(() => filterByAccount(recentTrades), [filterByAccount, recentTrades]);

  const weekCount = filteredWeek.length;
  const weekWins = filteredWeek.filter((tr) => netPnl(tr) > 0).length;
  const weekWinrate = weekCount > 0 ? ((weekWins / weekCount) * 100).toFixed(0) : "0";
  const todayPnl = filteredToday.reduce((sum, tr) => sum + netPnl(tr), 0);

  const selectedAccount = selectedAccountId ? activeAccounts.find((a) => a.id === selectedAccountId) ?? null : null;
  const displayAccount = selectedAccount || (activeAccounts.length === 1 ? activeAccounts[0] : null);
  const challengePct = displayAccount
    ? Math.max(0, Math.min(100, ((displayAccount.balance - displayAccount.account_size) / (displayAccount.account_size * displayAccount.profit_target_pct / 100)) * 100))
    : 0;

  const ddMax = displayAccount ? displayAccount.account_size * displayAccount.max_total_dd_pct / 100 : 0;
  const ddUsed = displayAccount ? Math.max(0, displayAccount.account_size - displayAccount.balance) : 0;
  const ddPct = ddMax > 0 ? (ddUsed / ddMax) * 100 : 0;

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

  // AI Insights from last review
  const insights = useMemo(() => {
    if (!lastReview?.analysis) return [];
    const items: string[] = [];
    const a = lastReview.analysis;
    if (a.patterns && a.patterns.length > 0) {
      items.push(a.patterns[0].description);
    }
    if (a.recommendations && a.recommendations.length > 0) {
      items.push(a.recommendations[0]);
    }
    if (a.strengths && a.strengths.length > 0) {
      items.push(a.strengths[0]);
    }
    return items.slice(0, 4);
  }, [lastReview]);

  // Date string
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      {/* Free user upsell banner */}
      {plan === "free" && !upsellDismissed && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
          <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <p className="text-sm text-foreground flex-1">{t("upsell_banner_text")}</p>
          <Link href="/dashboard/upgrade" className="text-xs font-semibold text-accent hover:underline whitespace-nowrap">
            {t("upsell_banner_cta")}
          </Link>
          <button
            onClick={() => setUpsellDismissed(true)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {t("dash_greeting")} {displayName} 👋
          </h1>
          <p className="text-muted text-sm mt-0.5 capitalize">{dateStr}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeAccounts.length > 0 && (
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
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
          <Link href="/dashboard/trades" className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-muted hover:text-foreground hover:border-muted btn-scale flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            {t("dash_action_import")}
          </Link>
          <Link href="/dashboard/analysis" className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-muted hover:text-foreground hover:border-muted btn-scale flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12" /></svg>
            {t("dash_action_analyze")}
          </Link>
          <Link href="/dashboard/session" className="px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-lg text-xs font-medium text-accent hover:bg-accent/15 btn-scale flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            {t("dash_action_session")}
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {/* Discipline Score */}
        <div className="bg-card border border-border rounded-xl p-5 card-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">{t("dash_discipline")}</p>
              {score !== null ? (
                <p className={`text-2xl font-bold mt-1 tabular-nums ${scoreColor}`}>{score}/100</p>
              ) : (
                <p className="text-2xl font-bold mt-1 text-muted">—</p>
              )}
            </div>
            {score !== null && <MiniScoreCircle score={score} />}
          </div>
          {score !== null ? (
            <p className="text-[11px] text-muted mt-2">{score >= 75 ? t("dash_score_good") : score >= 50 ? t("dash_score_ok") : t("dash_score_bad")}</p>
          ) : (
            <Link href="/dashboard/analysis" className="text-[11px] text-accent hover:underline mt-2 inline-block">
              {t("dash_run_analysis")}
            </Link>
          )}
        </div>

        {/* Week Trades */}
        <div className="bg-card border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">{t("dash_week_trades")}</p>
          <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">
            {weekCount}
            <span className="text-sm font-medium text-muted ml-2">({weekWinrate}% WR)</span>
          </p>
          <p className="text-[11px] text-muted mt-2">
            {weekWins} {t("dash_wins")} · {weekCount - weekWins} {t("dash_losses")}
          </p>
        </div>

        {/* Today P&L */}
        <div className={`border rounded-xl p-5 card-shadow ${todayPnl >= 0 ? "bg-profit/5 border-profit/10" : "bg-loss/5 border-loss/10"}`}>
          <p className="text-xs text-muted font-medium uppercase tracking-wider">{t("dash_today_pnl")}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)} €
          </p>
          <p className="text-[11px] text-muted mt-2">{filteredToday.length} trade{filteredToday.length !== 1 ? "s" : ""} {t("dash_today_label")}</p>
        </div>

        {/* Active Account */}
        <div className="bg-card border border-border rounded-xl p-5 card-shadow">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">{t("dash_active_challenge")}</p>
          {displayAccount ? (
            <div className="mt-1">
              <p className="text-lg font-bold text-foreground">
                {displayAccount.firm}
                <span className="text-accent ml-2 text-sm tabular-nums">{challengePct.toFixed(0)}%</span>
              </p>
              <div className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-profit rounded-full transition-all" style={{ width: `${Math.min(100, challengePct)}%` }} />
              </div>
              {displayAccount.account_number && <p className="text-[11px] text-muted mt-1.5">#{displayAccount.account_number}</p>}
              <Link href="/dashboard/challenge" className="text-[11px] text-accent hover:underline mt-1.5 inline-block">{t("dash_manage_accounts")}</Link>
            </div>
          ) : activeAccounts.length > 1 ? (
            <div className="mt-1">
              <p className="text-2xl font-bold text-foreground tabular-nums">{activeAccounts.length}</p>
              <p className="text-[11px] text-muted mt-1">{t("dash_select_account")}</p>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-lg font-bold text-muted">{t("dash_no_challenge")}</p>
              <Link href="/dashboard/challenge" className="text-[11px] text-accent hover:underline mt-1 inline-block">{t("dash_create_challenge")}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Day status */}
      <div className="mt-6">
        <DayStatus />
      </div>

      {/* AI Insights + Equity Curve — side by side on large screens */}
      <div className={`mt-6 grid gap-4 ${equityCurveData.length > 0 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <section className="bg-card border border-border rounded-xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12" />
              </svg>
              <h2 className="text-sm font-semibold text-foreground">{t("dash_insights_title")}</h2>
            </div>
            <Link href="/dashboard/analysis" className="text-xs text-accent hover:underline">{t("dash_insights_see_all")}</Link>
          </div>
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-surface border border-border">
                  <span className="text-accent text-sm shrink-0 mt-0.5">
                    {["💡", "📊", "✅", "⚡"][i % 4]}
                  </span>
                  <p className="text-xs text-muted leading-relaxed">{ins}</p>
                </div>
              ))}
            </div>
          ) : filteredAll.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">{t("dash_insights_has_trades").replace("{count}", String(filteredAll.length))}</p>
              <Link href="/dashboard/analysis" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/15 transition-colors btn-scale">
                {t("dash_action_analyze")} →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">{t("dash_insights_no_trades")}</p>
              <Link href="/dashboard/trades" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-muted text-xs font-medium hover:text-foreground hover:border-muted transition-colors btn-scale">
                {t("dash_action_import")} →
              </Link>
            </div>
          )}
        </section>

        {equityCurveData.length > 0 && (
          <EquityCurve data={equityCurveData} initialBalance={initialBalance} />
        )}
      </div>

      {/* Trading Calendar */}
      <div className="mt-6">
        <TradingCalendar trades={allTrades} selectedAccountId={selectedAccountId} />
      </div>

      {/* Goals & Streaks */}
      <div className="mt-6">
        <GoalsStreaks />
      </div>

      {/* Bottom sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {/* Recent trades */}
        <section className="bg-card border border-border rounded-xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">{t("dash_recent_trades")}</h2>
            <Link href="/dashboard/trades" className="text-xs text-accent hover:underline">{t("dash_see_all")}</Link>
          </div>
          {filteredRecent.length === 0 ? (
            <p className="text-muted text-sm">{t("dash_no_trades")}</p>
          ) : (
            <div className="space-y-0.5">
              {filteredRecent.map((tr) => {
                const net = netPnl(tr);
                return (
                  <div key={tr.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-xs tabular-nums w-12">
                        {tr.open_time ? new Date(tr.open_time).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }) : "—"}
                      </span>
                      <span className="text-foreground text-sm font-medium">{tr.pair}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tr.direction === "long" || tr.direction === "buy" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                        {tr.direction === "long" || tr.direction === "buy" ? "BUY" : "SELL"}
                      </span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${net >= 0 ? "text-profit" : "text-loss"}`}>
                      {net >= 0 ? "+" : ""}{net.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right column */}
        <div className="space-y-4">
          {/* Last analysis */}
          <div className="bg-card border border-border rounded-xl p-5 card-shadow">
            <h2 className="text-sm font-semibold text-foreground mb-2">{t("dash_last_analysis")}</h2>
            {lastReview ? (
              <Link href="/dashboard/analysis" className="flex items-center justify-between hover:opacity-80 transition-opacity">
                <span className="text-muted text-sm">
                  {new Date(lastReview.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className={`text-2xl font-bold tabular-nums ${lastReview.discipline_score >= 75 ? "text-profit" : lastReview.discipline_score >= 50 ? "text-warning" : "text-loss"}`}>
                  {lastReview.discipline_score}/100
                </span>
              </Link>
            ) : (
              <Link href="/dashboard/analysis" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 text-blue-400 text-sm font-medium hover:bg-blue-500/10 hover:border-blue-500/50 transition-colors cursor-pointer">
                {t("dash_run_ai_analysis")}
              </Link>
            )}
          </div>

          {/* Drawdown alert */}
          {displayAccount && ddPct > 75 && (
            <div className={`border rounded-xl p-5 card-shadow ${ddPct > 90 ? "bg-loss/5 border-loss/20" : "bg-warning/5 border-warning/20"}`}>
              <div className="flex items-center gap-2 mb-1">
                <svg className={`w-5 h-5 ${ddPct > 90 ? "text-loss" : "text-warning"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <h2 className={`text-sm font-semibold ${ddPct > 90 ? "text-loss" : "text-warning"}`}>
                  {ddPct > 90 ? t("dash_dd_critical") : t("dash_dd_high")}
                </h2>
              </div>
              <p className="text-foreground text-sm">
                {displayAccount.firm} — Drawdown{" "}
                <span className="font-bold tabular-nums">{ddPct.toFixed(1)}%</span> ({ddUsed.toFixed(0)}€ / {ddMax.toFixed(0)}€)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
