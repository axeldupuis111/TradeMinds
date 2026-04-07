"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";

interface RecentTrade {
  id: string;
  open_time: string | null;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

interface Props {
  displayName: string;
  score: number | null;
  scoreColor: string;
  weekCount: number;
  weekWinrate: string;
  todayPnl: number;
  ac: {
    firm: string;
    account_size: number;
    profit_target_pct: number;
    max_total_dd_pct: number;
    balance: number;
  } | null;
  challengePct: number;
  ddPct: number;
  challengeDdUsed: number;
  challengeDdMax: number;
  recentTrades: RecentTrade[];
  lastReview: { discipline_score: number; created_at: string } | null;
}

export default function DashboardContent({
  displayName,
  score,
  scoreColor,
  weekCount,
  weekWinrate,
  todayPnl,
  ac,
  challengePct,
  ddPct,
  challengeDdUsed,
  challengeDdMax,
  recentTrades,
  lastReview,
}: Props) {
  const { t } = useLanguage();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("dash_welcome")} {displayName}
      </h1>
      <p className="text-muted mt-1">{t("dash_overview")}</p>

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

        {/* Card 4 — Challenge */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 3.943 3H5zm4 6V7H7v2H4l1 12h8l1-12h-5zm2-4H7l1-2h2l1 2z" />
            </svg>
            <p className="text-sm text-muted">{t("dash_active_challenge")}</p>
          </div>
          {ac ? (
            <div className="mt-1">
              <p className="text-lg font-bold text-foreground">
                {ac.firm}
                <span className="text-accent ml-2 text-base">{challengePct.toFixed(0)}%</span>
              </p>
              <div className="h-1.5 bg-[#1e1e1e] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-profit rounded-full transition-all" style={{ width: `${challengePct}%` }} />
              </div>
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
          {recentTrades.length === 0 ? (
            <p className="text-muted text-sm">{t("dash_no_trades")}</p>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((tr) => {
                const net = (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
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

          {/* Alerts */}
          {ac && ddPct > 75 && (
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
                {ac.firm} — Drawdown{" "}
                <span className="font-bold">{ddPct.toFixed(1)}%</span> ({challengeDdUsed.toFixed(0)}€ / {challengeDdMax.toFixed(0)}€).
                {ddPct > 90 ? ` ${t("dash_dd_stop")}` : ` ${t("dash_dd_careful")}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
