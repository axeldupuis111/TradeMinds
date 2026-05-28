"use client";

/**
 * KpiCards — grille des 4 KPI du Dashboard.
 *
 * Utilise KpiCardPremium (direction artistique "Terminal de précision") :
 * Card 1 : Score de discipline — ScoreRing animé, aura cyan
 * Card 2 : Trades / Win rate   — WinRateGauge animé, aura verte
 * Card 3 : P&L du jour         — Sparkline animée, aura cyan/amber
 * Card 4 : Compte actif        — icône Wallet, barre de progression
 */

import CountUp from "@/components/animations/CountUp";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { WinRateGauge } from "@/components/dashboard/WinRateGauge";
import { useLanguage } from "@/lib/LanguageContext";
import { Wallet } from "lucide-react";
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
  /** Cumulative P&L series for today's sparkline */
  todayPnlSeries: number[];
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
  todayPnlSeries,
  displayAccount,
  challengePct,
  activeAccountsCount,
  totalPnl,
}: KpiCardsProps) {
  const { t } = useLanguage();

  const pnlPositive = todayPnl >= 0;

  // ── Card 1 — Score de discipline ──────────────────────────────────────────
  const card1 = score !== null ? (
    <KpiCardPremium
      label={t("dash_discipline")}
      value={
        <span>
          <CountUp end={score} duration={1.5} />
          <span className="text-sm font-semibold text-foreground-muted opacity-70">/100</span>
        </span>
      }
      sublabel={scoreSubLabel(score, t)}
      trend={scoreTrend(score)}
      accentColor="cyan"
      visual={<ScoreRing score={score} size="md" />}
    />
  ) : (
    <KpiCardPremium
      label={t("dash_discipline")}
      value={<span className="text-foreground-muted">—</span>}
      sublabel={t("dash_no_score_yet")}
      accentColor="cyan"
    />
  );

  // ── Card 2 — Trades / Win rate ────────────────────────────────────────────
  const card2 = (
    <KpiCardPremium
      label={useMonthFallback ? t("dash_month_trades") : t("dash_week_trades")}
      value={<CountUp end={weekCount} duration={1.2} />}
      sublabel={`${weekWins} ${t("dash_wins")} · ${weekCount - weekWins} ${t("dash_losses")}`}
      accentColor="green"
      visual={<WinRateGauge wins={weekWins} total={weekCount} />}
    />
  );

  // ── Card 3 — P&L du jour ──────────────────────────────────────────────────
  const sparkline = todayPnlSeries.length >= 2 ? (
    <Sparkline
      data={todayPnlSeries}
      positive={pnlPositive}
      width={80}
      height={36}
    />
  ) : (
    /* No data yet — subtle icon container */
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        pnlPositive ? "bg-profit/10" : "bg-loss/10"
      }`}
    >
      <span className={`text-lg ${pnlPositive ? "text-profit" : "text-loss"}`}>
        {pnlPositive ? "↑" : "↓"}
      </span>
    </div>
  );

  const card3 = (
    <KpiCardPremium
      label={t("dash_today_pnl")}
      value={
        <CountUp
          end={Math.abs(todayPnl)}
          prefix={pnlPositive ? "+" : "-"}
          suffix=" €"
          decimals={2}
          duration={1.5}
        />
      }
      sublabel={`${filteredTodayCount} trade${filteredTodayCount !== 1 ? "s" : ""} ${t("dash_today_label")}`}
      trend={pnlPositive ? "up" : "down"}
      accentColor={pnlPositive ? "cyan" : "amber"}
      visual={sparkline}
    />
  );

  // ── Card 4 — Compte actif ─────────────────────────────────────────────────
  const walletVisual = (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10 shrink-0">
      <Wallet className="w-6 h-6 text-accent" strokeWidth={1.75} />
    </div>
  );

  const manageLink = (label: string) => (
    <Link
      href="/dashboard/challenge"
      className="text-xs text-accent hover:underline"
    >
      {label}
    </Link>
  );

  let card4: React.ReactNode;

  if (displayAccount) {
    const challengeSubLabel = challengePct !== null
      ? `${challengePct.toFixed(0)}% ${t("dash_challenge_target") || "objectif"}`
      : `${displayAccount.balanceChange >= 0 ? "+" : ""}${displayAccount.balanceChange.toFixed(2)} €`;

    card4 = (
      <KpiCardPremium
        label={t("dash_active_challenge")}
        value={
          <span className="text-xl font-black truncate block">
            {displayAccount.firm}
          </span>
        }
        sublabel={challengeSubLabel}
        trend={
          challengePct !== null
            ? (challengePct >= 50 ? "up" : "neutral")
            : (displayAccount.balanceChange >= 0 ? "up" : "down")
        }
        accentColor="cyan"
        visual={walletVisual}
      >
        {challengePct !== null && (
          <div className="h-1.5 bg-border/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-profit rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, challengePct)}%` }}
            />
          </div>
        )}
        {displayAccount.accountNumber && (
          <p className="text-[10px] text-foreground-subtle tabular-nums">
            #{displayAccount.accountNumber}
          </p>
        )}
        {manageLink(t("dash_manage_accounts"))}
      </KpiCardPremium>
    );
  } else if (activeAccountsCount > 1) {
    card4 = (
      <KpiCardPremium
        label={t("dash_active_challenge")}
        value={<CountUp end={activeAccountsCount} duration={1} suffix={` ${t("dash_accounts_count")}`} />}
        sublabel={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`}
        trend={totalPnl >= 0 ? "up" : "down"}
        accentColor="cyan"
        visual={walletVisual}
      >
        {manageLink(t("dash_manage_accounts"))}
      </KpiCardPremium>
    );
  } else {
    card4 = (
      <KpiCardPremium
        label={t("dash_active_challenge")}
        value={<span className="text-foreground-muted">—</span>}
        sublabel={t("dash_no_challenge")}
        accentColor="cyan"
        visual={walletVisual}
      >
        {manageLink(t("dash_create_challenge"))}
      </KpiCardPremium>
    );
  }

  // ── Grid ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {card1}
      {card2}
      {card3}
      {card4}
    </div>
  );
}
