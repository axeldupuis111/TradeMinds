"use client";

import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { WinRateGauge } from "@/components/dashboard/WinRateGauge";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/LanguageContext";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayAccount {
  firm: string;
  accountNumber: string | null;
  /** balance − account_size (positive = profit) */
  balanceChange: number;
}

export interface KpiCardsProps {
  // Score discipline
  score: number | null;
  // Trades this period
  weekCount: number;
  weekWins: number;
  useMonthFallback: boolean;
  // P&L today
  todayPnl: number;
  filteredTodayCount: number;
  // Active account
  displayAccount: DisplayAccount | null;
  challengePct: number | null;
  activeAccountsCount: number;
  totalPnl: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreSubLabel(score: number, t: (k: string) => string): string {
  if (score >= 90) return t("dash_score_excellent");
  if (score >= 75) return t("dash_score_good");
  if (score >= 60) return t("dash_score_ok");
  if (score >= 40) return t("dash_score_weak");
  return t("dash_score_bad");
}

function scoreTrend(score: number): "up" | "neutral" | "down" {
  if (score >= 75) return "up";
  if (score >= 40) return "neutral";
  return "down";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KpiCards({
  score,
  weekCount,
  weekWins,
  useMonthFallback,
  todayPnl,
  filteredTodayCount,
  displayAccount,
  challengePct,
  activeAccountsCount,
  totalPnl,
}: KpiCardsProps) {
  const { t } = useLanguage();

  const pnlSign = todayPnl >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      {/* ── Card 1 : Score de discipline ─────────────────────────────── */}
      <Card padding="md">
        {score !== null ? (
          <Stat
            label={t("dash_discipline")}
            value={`${score}/100`}
            sublabel={scoreSubLabel(score, t)}
            trend={scoreTrend(score)}
            visual={<ScoreRing score={score} />}
          />
        ) : (
          <Stat
            label={t("dash_discipline")}
            value="—"
            sublabel={t("dash_no_score_yet")}
          />
        )}
      </Card>

      {/* ── Card 2 : Trades cette semaine / ce mois ──────────────────── */}
      <Card padding="md">
        <Stat
          label={useMonthFallback ? t("dash_month_trades") : t("dash_week_trades")}
          value={weekCount}
          sublabel={`${weekWins} ${t("dash_wins")} · ${weekCount - weekWins} ${t("dash_losses")}`}
          visual={<WinRateGauge wins={weekWins} total={weekCount} />}
        />
      </Card>

      {/* ── Card 3 : P&L du jour ─────────────────────────────────────── */}
      <Card
        padding="md"
        className={cn(pnlSign ? "bg-profit/[0.02]" : undefined)}
      >
        <Stat
          label={t("dash_today_pnl")}
          value={`${pnlSign ? "+" : ""}${todayPnl.toFixed(2)} €`}
          sublabel={`${filteredTodayCount} trade${filteredTodayCount !== 1 ? "s" : ""} ${t("dash_today_label")}`}
          trend={pnlSign ? "up" : "down"}
          visual={
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                pnlSign ? "bg-profit/10" : "bg-loss/10"
              )}
            >
              {pnlSign
                ? <TrendingUp className="w-6 h-6 text-profit" strokeWidth={1.75} />
                : <TrendingDown className="w-6 h-6 text-loss" strokeWidth={1.75} />
              }
            </div>
          }
        />
      </Card>

      {/* ── Card 4 : Compte actif ─────────────────────────────────────── */}
      <Card padding="md">
        {displayAccount ? (
          /* Single account selected */
          <div className="flex flex-col gap-2">
            <Stat
              label={t("dash_active_challenge")}
              value={displayAccount.firm}
              sublabel={
                challengePct !== null
                  ? `${challengePct.toFixed(0)}% ${t("dash_challenge_target") || "objectif"}`
                  : `${displayAccount.balanceChange >= 0 ? "+" : ""}${displayAccount.balanceChange.toFixed(2)} €`
              }
              trend={
                challengePct !== null
                  ? (challengePct >= 50 ? "up" : "neutral")
                  : (displayAccount.balanceChange >= 0 ? "up" : "down")
              }
              visual={
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                  <Wallet className="w-6 h-6 text-accent" strokeWidth={1.75} />
                </div>
              }
            />
            {challengePct !== null && (
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-profit rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, challengePct)}%` }}
                />
              </div>
            )}
            {displayAccount.accountNumber && (
              <p className="text-[10px] text-foreground-subtle tabular-nums">
                #{displayAccount.accountNumber}
              </p>
            )}
            <Link
              href="/dashboard/challenge"
              className="text-xs text-accent hover:underline mt-0.5 inline-block"
            >
              {t("dash_manage_accounts")}
            </Link>
          </div>
        ) : activeAccountsCount > 1 ? (
          /* Multiple accounts, no single selected */
          <div className="flex flex-col gap-1.5">
            <Stat
              label={t("dash_active_challenge")}
              value={`${activeAccountsCount} ${t("dash_accounts_count")}`}
              sublabel={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`}
              trend={totalPnl >= 0 ? "up" : "down"}
              visual={
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                  <Wallet className="w-6 h-6 text-accent" strokeWidth={1.75} />
                </div>
              }
            />
            <Link
              href="/dashboard/challenge"
              className="text-xs text-accent hover:underline mt-1 inline-block"
            >
              {t("dash_manage_accounts")}
            </Link>
          </div>
        ) : (
          /* No accounts */
          <div className="flex flex-col gap-1.5">
            <Stat
              label={t("dash_active_challenge")}
              value="—"
              sublabel={t("dash_no_challenge")}
              visual={
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                  <Wallet className="w-6 h-6 text-accent" strokeWidth={1.75} />
                </div>
              }
            />
            <Link
              href="/dashboard/challenge"
              className="text-xs text-accent hover:underline mt-1 inline-block"
            >
              {t("dash_create_challenge")}
            </Link>
          </div>
        )}
      </Card>

    </div>
  );
}
