"use client";

/**
 * KpiCards — grille des KPI du Dashboard.
 *
 * Layout "Terminal de précision" :
 * - Score hero — pleine largeur, composition horizontale avec anneau XL + stats riches
 * - 3 autres cards — grille 3 colonnes en-dessous
 *
 * Sparkline P&L : série du jour si ≥ 2 points, sinon fallback sur les 7
 * derniers points d'equity. Si vraiment vide : état texte "Pas encore de données".
 */

import CountUp from "@/components/animations/CountUp";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { WinRateGauge } from "@/components/dashboard/WinRateGauge";
import { DEFAULT_CURRENCY, currencySymbol, money } from "@/lib/account-currency";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
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
  /** Last ≤7 equity values — sparkline fallback when no today trades */
  equitySparkSeries: number[];
  // Active account
  displayAccount: DisplayAccount | null;
  challengePct: number | null;
  activeAccountsCount: number;
  totalPnl: number;
  /**
   * Devise du compte affiché. En vue « tous les comptes » l'appelant passe
   * l'euro : aucun symbole unique ne serait juste sur un total mélangé.
   */
  currency?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreSubLabel(score: number, t: (k: string) => string): string {
  if (score >= 90) return t("dash_score_excellent");
  if (score >= 75) return t("dash_score_good");
  if (score >= 60) return t("dash_score_ok");
  if (score >= 40) return t("dash_score_weak");
  return t("dash_score_bad");
}

/** Phrase de contexte en fonction du niveau de discipline */
function scoreContextPhrase(score: number, t: (k: string) => string): string {
  if (score >= 90) return t("dash_score_ctx_excellent");
  if (score >= 75) return t("dash_score_ctx_good");
  if (score >= 60) return t("dash_score_ctx_ok");
  if (score >= 40) return t("dash_score_ctx_weak");
  return t("dash_score_ctx_bad");
}

/** Mini-stat verticale : label tracé, valeur colorée */
function MiniStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[9px] font-semibold uppercase text-foreground-subtle leading-none"
        style={{ letterSpacing: "0.1em" }}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums leading-tight",
          positive === true
            ? "text-profit"
            : positive === false
              ? "text-loss"
              : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
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
  equitySparkSeries,
  displayAccount,
  challengePct,
  activeAccountsCount,
  totalPnl,
  currency = DEFAULT_CURRENCY,
}: KpiCardsProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  const pnlPositive = todayPnl >= 0;

  // ── Sparkline — série du jour, fallback equity, fallback état vide ────────
  const usingTodayPnl = todayPnlSeries.length >= 2;
  const usingEquity   = !usingTodayPnl && equitySparkSeries.length >= 2;
  const sparkSeries   = usingTodayPnl
    ? todayPnlSeries
    : usingEquity
      ? equitySparkSeries
      : [];
  const sparkPositive = usingTodayPnl
    ? pnlPositive
    : usingEquity
      ? (equitySparkSeries[equitySparkSeries.length - 1] ?? 0) >=
        (equitySparkSeries[0] ?? 0)
      : true;

  const sparklineElement =
    sparkSeries.length >= 2 ? (
      <Sparkline
        data={sparkSeries}
        positive={sparkPositive}
        width={80}
        height={36}
        // Today's cumulative P&L hovers around 0 → anchor at 0. The equity
        // fallback holds absolute balances (~100k €) → anchor at the series min
        // so it renders as a curve instead of a full-height block.
        baseline={usingTodayPnl ? "zero" : "auto"}
        // The equity fallback is recent context, not today's result — render it
        // in a neutral tone so it doesn't read as a P&L gain/loss for the day.
        color={usingTodayPnl ? undefined : "rgb(var(--foreground-muted))"}
      />
    ) : (
      <p className="text-[10px] text-foreground-subtle italic leading-snug">
        {t("kpi_no_data")}
      </p>
    );

  // ── Card 1 — Score hero ───────────────────────────────────────────────────
  // Composition horizontale pleine largeur : anneau XL à gauche + stats riches à droite.
  // Si score = null : fallback card simple pleine largeur.
  const heroCard =
    score !== null ? (
      <div
        className={cn(
          "kpi-premium relative overflow-hidden rounded-xl cursor-default",
          isDark ? "border border-white/[0.08]" : "border border-border"
        )}
        style={{
          background: `linear-gradient(160deg, rgb(var(--card-grad-top)) 0%, rgb(var(--card-grad-bot)) 100%)`,
          boxShadow: `var(--glow-shadow)`,
        }}
      >
        {/* Sheen */}
        <div
          className="absolute top-0 inset-x-0 h-[2px] pointer-events-none z-20"
          style={{ background: `var(--sheen)` }}
        />

        {/* Double aura cyan — dark uniquement */}
        {isDark && (
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background: [
                "radial-gradient(ellipse 100% 80% at 85% 0%, rgb(var(--accent-glow) / 0.38) 0%, transparent 70%)",
                "radial-gradient(ellipse 50% 40% at 0% 100%, rgb(var(--accent-glow) / 0.12) 0%, transparent 60%)",
              ].join(", "),
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 p-6 flex flex-col sm:flex-row gap-6">

          {/* ── Colonne gauche : anneau XL ── */}
          <div className="flex sm:flex-col items-center justify-center shrink-0">
            <ScoreRing score={score} size="xl" />
          </div>

          {/* Séparateur vertical desktop */}
          <div
            className={cn(
              "hidden sm:block w-px self-stretch",
              isDark ? "bg-white/[0.06]" : "bg-border"
            )}
          />

          {/* ── Colonne droite : infos riches ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">

            {/* Label */}
            <p
              className="text-[10px] font-semibold uppercase text-foreground-muted leading-none"
              style={{ letterSpacing: "0.12em" }}
            >
              {t("dash_discipline")}
            </p>

            {/* Score numérique + pill de tendance */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black tabular-nums text-foreground leading-none">
                  <CountUp end={score} duration={1.5} />
                </span>
                <span className="text-sm font-semibold text-foreground-muted opacity-60">
                  /100
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full leading-none",
                  score >= 75
                    ? "bg-profit/15 text-profit"
                    : score >= 40
                      ? "bg-warning/15 text-warning"
                      : "bg-loss/15 text-loss"
                )}
              >
                {score >= 75 ? "↑" : score >= 40 ? "→" : "↓"}{" "}
                {scoreSubLabel(score, t)}
              </span>
            </div>

            {/* Phrase de contexte */}
            <p className="text-sm text-foreground-muted leading-snug max-w-sm">
              {scoreContextPhrase(score, t)}
            </p>

            {/* Séparateur horizontal */}
            <div
              className={cn(
                "h-px",
                isDark ? "bg-white/[0.05]" : "bg-border/60"
              )}
            />

            {/* Mini-stats */}
            <div className="flex items-start gap-6 flex-wrap">
              <MiniStat
                label={
                  useMonthFallback
                    ? t("dash_month_trades")
                    : t("dash_week_trades")
                }
                value={weekCount > 0 ? String(weekCount) : "—"}
              />
              <MiniStat
                label="Win rate"
                value={
                  weekCount > 0
                    ? `${Math.round((weekWins / weekCount) * 100)}%`
                    : "—"
                }
                positive={
                  weekCount > 0 ? weekWins / weekCount >= 0.5 : undefined
                }
              />
              <MiniStat
                label={t("dash_today_pnl")}
                value={
                  filteredTodayCount > 0
                    ? money(todayPnl, currency, { signed: true })
                    : "—"
                }
                positive={
                  filteredTodayCount > 0 ? todayPnl >= 0 : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>
    ) : (
      /* Fallback : pas encore de score — card simple pleine largeur */
      <KpiCardPremium
        label={t("dash_discipline")}
        value={<span className="text-foreground-muted">—</span>}
        sublabel={t("dash_no_score_yet")}
        accentColor="cyan"
        intensity="hero"
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
  const card3 = (
    <KpiCardPremium
      label={t("dash_today_pnl")}
      value={
        <CountUp
          end={Math.abs(todayPnl)}
          prefix={pnlPositive ? "+" : "-"}
          suffix={` ${currencySymbol(currency).trim()}`}
          decimals={2}
          duration={1.5}
        />
      }
      sublabel={`${filteredTodayCount} trade${filteredTodayCount !== 1 ? "s" : ""} ${t("dash_today_label")}`}
      trend={pnlPositive ? "up" : "down"}
      accentColor={pnlPositive ? "cyan" : "amber"}
      visual={sparklineElement}
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
    const challengeSubLabel =
      challengePct !== null
        ? `${challengePct.toFixed(0)}% ${t("dash_challenge_target") || "objectif"}`
        : money(displayAccount.balanceChange, currency, { digits: 2, signed: true });

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
            ? challengePct >= 50
              ? "up"
              : "neutral"
            : displayAccount.balanceChange >= 0
              ? "up"
              : "down"
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
        value={
          <CountUp
            end={activeAccountsCount}
            duration={1}
            suffix={` ${t("dash_accounts_count")}`}
          />
        }
        sublabel={money(totalPnl, currency, { digits: 2, signed: true })}
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

  // ── Layout : Score hero (pleine largeur) + 3-col grid ────────────────────
  return (
    <div className="space-y-4">
      {/* Score hero — pleine largeur */}
      {heroCard}

      {/* 3 autres KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {card2}
        {card3}
        {card4}
      </div>
    </div>
  );
}
