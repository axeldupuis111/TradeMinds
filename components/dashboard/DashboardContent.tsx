"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import { useLanguage } from "@/lib/LanguageContext";
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
  lastReview: { discipline_score: number; created_at: string } | null;
  allTrades: TradeWithTime[];
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Filter trades by selected account
  const filterByAccount = useCallback(<T extends { challenge_id: string | null }>(trades: T[]): T[] => {
    if (!selectedAccountId) return trades;
    return trades.filter((tr) => tr.challenge_id === selectedAccountId);
  }, [selectedAccountId]);

  const filteredWeek = useMemo(() => filterByAccount(weekTrades), [filterByAccount, weekTrades]);
  const filteredToday = useMemo(() => filterByAccount(todayTrades), [filterByAccount, todayTrades]);
  const filteredAll = useMemo(() => filterByAccount(allTrades), [filterByAccount, allTrades]);
  const filteredRecent = useMemo(() => filterByAccount(recentTrades), [filterByAccount, recentTrades]);

  // Computed stats
  const weekCount = filteredWeek.length;
  const weekWins = filteredWeek.filter((tr) => netPnl(tr) > 0).length;
  const weekWinrate = weekCount > 0 ? ((weekWins / weekCount) * 100).toFixed(0) : "0";
  const todayPnl = filteredToday.reduce((sum, tr) => sum + netPnl(tr), 0);

  // Selected account info
  const selectedAccount = selectedAccountId
    ? activeAccounts.find((a) => a.id === selectedAccountId) ?? null
    : null;

  // Challenge progress for selected account (or first active)
  const displayAccount = selectedAccount || (activeAccounts.length === 1 ? activeAccounts[0] : null);
  const challengePct = displayAccount
    ? Math.max(0, Math.min(100, ((displayAccount.balance - displayAccount.account_size) / (displayAccount.account_size * displayAccount.profit_target_pct / 100)) * 100))
    : 0;

  // Drawdown
  const ddMax = displayAccount ? displayAccount.account_size * displayAccount.max_total_dd_pct / 100 : 0;
  const ddUsed = displayAccount ? Math.max(0, displayAccount.account_size - displayAccount.balance) : 0;
  const ddPct = ddMax > 0 ? (ddUsed / ddMax) * 100 : 0;

  // Equity curve
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("dash_welcome")} {displayName}
          </h1>
          <p className="text-muted mt-1">{t("dash_overview")}</p>
        </div>

        {/* Account selector */}
        {activeAccounts.length > 0 && (
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value || null)}
            className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent w-full sm:w-auto"
          >
            <option value="">{t("dash_all_accounts")}</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firm} — {a.account_number || a.account_size.toLocaleString() + "€"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Card 1 — Score */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-muted">{t("dash_discipline")}</p>
          </div>
          {score !== null ? (
            <p className={`text-2xl font-bold mt-1 ${scoreColor}`}>{score}/100</p>
          ) : (
            <div className="mt-1">
              <p className="text-2xl font-bold text-muted">—</p>
              <Link href="/dashboard/analysis" className="text-xs text-accent hover:underline">
                {t("dash_run_analysis")}
              </Link>
            </div>
          )}
        </div>

        {/* Card 2 — Week trades */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <p className="text-sm text-muted">{t("dash_week_trades")}</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {weekCount}
            <span className="text-sm font-normal text-muted ml-2">
              ({weekWinrate}% WR)
            </span>
          </p>
        </div>

        {/* Card 3 — Today PnL */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-muted">{t("dash_today_pnl")}</p>
          </div>
          <p className={`text-2xl font-bold mt-1 ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)} €
          </p>
        </div>

        {/* Card 4 — Active account */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 3.943 3H5zm4 6V7H7v2H4l1 12h8l1-12h-5zm2-4H7l1-2h2l1 2z" />
            </svg>
            <p className="text-sm text-muted">{t("dash_active_challenge")}</p>
          </div>
          {displayAccount ? (
            <div className="mt-1">
              <p className="text-lg font-bold text-foreground">
                {displayAccount.firm}
                {displayAccount.account_number && (
                  <span className="text-muted text-sm ml-1">#{displayAccount.account_number}</span>
                )}
                <span className="text-accent ml-2 text-base">{challengePct.toFixed(0)}%</span>
              </p>
              <div className="h-1.5 bg-[#1e1e1e] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-profit rounded-full transition-all" style={{ width: `${Math.min(100, challengePct)}%` }} />
              </div>
            </div>
          ) : activeAccounts.length > 1 ? (
            <div className="mt-1">
              <p className="text-lg font-bold text-foreground">{activeAccounts.length}</p>
              <p className="text-xs text-muted">{t("dash_select_account")}</p>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-2xl font-bold text-muted">{t("dash_no_challenge")}</p>
              <Link href="/dashboard/challenge" className="text-xs text-accent hover:underline">
                {t("dash_create_challenge")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Equity Curve */}
      {equityCurveData.length > 0 && (
        <div className="mt-8">
          <EquityCurve data={equityCurveData} initialBalance={initialBalance} />
        </div>
      )}

      {/* Bonus sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent trades */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">{t("dash_recent_trades")}</h2>
            <Link href="/dashboard/trades" className="text-xs text-accent hover:underline">
              {t("dash_see_all")}
            </Link>
          </div>
          {filteredRecent.length === 0 ? (
            <p className="text-muted text-sm">{t("dash_no_trades")}</p>
          ) : (
            <div className="space-y-2">
              {filteredRecent.map((tr) => {
                const net = netPnl(tr);
                return (
                  <div key={tr.id} className="flex items-center justify-between py-1.5 border-b border-[#1e1e1e] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs w-16">
                        {tr.open_time
                          ? new Date(tr.open_time).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </span>
                      <span className="text-foreground text-sm font-medium">{tr.pair}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tr.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                        {tr.direction?.toUpperCase()}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${net >= 0 ? "text-profit" : "text-loss"}`}>
                      {net >= 0 ? "+" : ""}{net.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Last analysis + Alerts */}
        <div className="space-y-6">
          {/* Last analysis */}
          <Link href="/dashboard/analysis" className="block bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
            <h2 className="text-sm font-semibold text-foreground mb-2">{t("dash_last_analysis")}</h2>
            {lastReview ? (
              <div className="flex items-center justify-between">
                <span className="text-muted text-sm">
                  {new Date(lastReview.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className={`text-2xl font-bold ${lastReview.discipline_score >= 75 ? "text-profit" : lastReview.discipline_score >= 50 ? "text-orange-400" : "text-loss"}`}>
                  {lastReview.discipline_score}/100
                </span>
              </div>
            ) : (
              <p className="text-muted text-sm">{t("dash_no_analysis")}</p>
            )}
          </Link>

          {/* Drawdown alert */}
          {displayAccount && ddPct > 75 && (
            <div className={`border rounded-xl p-5 ${ddPct > 90 ? "bg-loss/10 border-loss/30" : "bg-orange-500/10 border-orange-500/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                <svg className={`w-5 h-5 ${ddPct > 90 ? "text-loss" : "text-orange-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
                </svg>
                <h2 className={`text-sm font-semibold ${ddPct > 90 ? "text-loss" : "text-orange-400"}`}>
                  {ddPct > 90 ? t("dash_dd_critical") : t("dash_dd_high")}
                </h2>
              </div>
              <p className="text-foreground text-sm">
                {displayAccount.firm} — Drawdown{" "}
                <span className="font-bold">{ddPct.toFixed(1)}%</span> ({ddUsed.toFixed(0)}€ / {ddMax.toFixed(0)}€).
                {ddPct > 90 ? ` ${t("dash_dd_stop")}` : ` ${t("dash_dd_careful")}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
