"use client";

/**
 * ChallengeGuardian — Premium-only real-time prop-firm DD watchdog.
 *
 * Monitors ALL active prop challenges (not just the most recent one).
 *
 * Renders nothing for free/plus users (StopTradingGuard still covers their
 * strategy-level limits).  For premium users with active prop challenges,
 * it subscribes to Realtime changes on `trades` and `prop_challenges` and
 * fires per account:
 *   ≥ 80% of a DD limit → persistent banner (warning)
 *   ≥ 95% of a DD limit → included in full-screen overlay (critical)
 *
 * When multiple accounts are in critical state simultaneously, a single
 * overlay lists all of them. Dismiss is per account+ddType so dismissing
 * one never hides another.
 */

import { computeChallengeRules } from "@/lib/challenge-rules";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = "warning" | "critical";
type DdType = "daily" | "total";

interface AlertWithAccount {
  challengeId: string;
  accountLabel: string;
  ddType: DdType;
  level: AlertLevel;
  usedPct: number;
  remainingEur: number;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function dismissKey(challengeId: string, ddType: DdType): string {
  return `challenge_guardian_dismissed_${challengeId}_${ddType}`;
}

function isDismissed(challengeId: string, ddType: DdType): boolean {
  if (typeof window === "undefined") return false;
  try {
    const today = new Date().toISOString().split("T")[0];
    return localStorage.getItem(dismissKey(challengeId, ddType)) === today;
  } catch {
    return false;
  }
}

function writeDismiss(challengeId: string, ddType: DdType): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(dismissKey(challengeId, ddType), today);
}

// ─── Message helper ───────────────────────────────────────────────────────────

function fmt(template: string, account: string, pct: number, eur: number): string {
  return template
    .replace("{account}", account)
    .replace("{pct}", Math.round(pct * 100).toString())
    .replace("{eur}", Math.round(eur).toString());
}

// ─── Account label (consistent with session page selector) ───────────────────

function makeAccountLabel(row: {
  firm: string;
  account_number: string | null;
  account_size: number;
}): string {
  const parts: string[] = [row.firm || "Compte"];
  if (row.account_number) parts.push(row.account_number);
  parts.push(row.account_size.toLocaleString() + "€");
  return parts.join(" · ");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChallengeGuardian() {
  const { plan } = usePlan();
  const { t } = useLanguage();
  const supabase = createClient();

  const [alerts, setAlerts] = useState<AlertWithAccount[]>([]);
  // "challengeId_ddType" strings dismissed today (mirrored from localStorage)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const isPremium = plan === "premium";

  useEffect(() => {
    if (!isPremium) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      await check();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`challenge-guardian-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prop_challenges", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); },
        )
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    // Fetch ALL active prop challenges.
    const { data: challenges } = await supabase
      .from("prop_challenges")
      .select(
        "id, firm, account_number, account_size, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown, balance",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("type", "prop")
      .order("created_at", { ascending: false });

    if (!challenges || challenges.length === 0) {
      setAlerts([]);
      return;
    }

    // Evaluate each challenge in parallel.
    const perChallenge = await Promise.all(
      challenges.map(async (challenge) => {
        const [{ data: allTrades }, { data: todayTrades }] = await Promise.all([
          supabase
            .from("trades")
            .select("pnl, commission, swap")
            .eq("user_id", user.id)
            .eq("challenge_id", challenge.id)
            .order("open_time", { ascending: true }),
          supabase
            .from("trades")
            .select("pnl, commission, swap, status")
            .eq("user_id", user.id)
            .eq("challenge_id", challenge.id)
            .gte("open_time", today),
        ]);

        let running = challenge.account_size;
        const equityCurveBalances = (allTrades || []).map((tr) => {
          running += (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
          return running;
        });

        const todayPnl = (todayTrades || [])
          .filter((tr) => tr.status === "closed")
          .reduce((s, tr) => s + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0), 0);

        const balance =
          equityCurveBalances.length > 0
            ? equityCurveBalances[equityCurveBalances.length - 1]
            : challenge.balance;

        const rules = computeChallengeRules(
          {
            account_size: challenge.account_size,
            profit_target_pct: challenge.profit_target_pct,
            max_daily_dd_pct: challenge.max_daily_dd_pct,
            max_total_dd_pct: challenge.max_total_dd_pct,
            trailing_drawdown: challenge.trailing_drawdown ?? false,
          },
          balance,
          todayPnl,
          equityCurveBalances,
        );

        const label = makeAccountLabel(challenge);
        const found: AlertWithAccount[] = [];

        if (rules.ddDailyUsedPct >= 0.8 && rules.dailyDdMax > 0) {
          found.push({
            challengeId: challenge.id,
            accountLabel: label,
            ddType: "daily",
            level: rules.ddDailyUsedPct >= 0.95 ? "critical" : "warning",
            usedPct: rules.ddDailyUsedPct,
            remainingEur: rules.dailyDdRemainingEur,
          });
        }
        if (rules.ddTotalUsedPct >= 0.8 && rules.totalDdMax > 0) {
          found.push({
            challengeId: challenge.id,
            accountLabel: label,
            ddType: "total",
            level: rules.ddTotalUsedPct >= 0.95 ? "critical" : "warning",
            usedPct: rules.ddTotalUsedPct,
            remainingEur: rules.totalDdRemainingEur,
          });
        }

        return found;
      })
    );

    const allAlerts = perChallenge.flat();
    setAlerts(allAlerts);

    // Re-sync dismissed set from localStorage.
    const freshDismissed = new Set<string>();
    for (const a of allAlerts) {
      if (isDismissed(a.challengeId, a.ddType)) {
        freshDismissed.add(`${a.challengeId}_${a.ddType}`);
      }
    }
    setDismissed(freshDismissed);
  }

  function dismissAlert(challengeId: string, ddType: DdType) {
    writeDismiss(challengeId, ddType);
    setDismissed((prev) => new Set(Array.from(prev).concat(`${challengeId}_${ddType}`)));
  }

  function dismissAllCritical(criticals: AlertWithAccount[]) {
    const extra = criticals.map((a) => {
      writeDismiss(a.challengeId, a.ddType);
      return `${a.challengeId}_${a.ddType}`;
    });
    setDismissed((prev) => new Set(Array.from(prev).concat(extra)));
  }

  // No alerts or non-premium → render nothing.
  if (!isPremium || alerts.length === 0) return null;

  const isAlertDismissed = (a: AlertWithAccount) =>
    dismissed.has(`${a.challengeId}_${a.ddType}`);

  const undismissedCriticals = alerts.filter(
    (a) => a.level === "critical" && !isAlertDismissed(a)
  );

  const bannerAlerts = alerts.filter(
    (a) => a.level === "warning" || isAlertDismissed(a)
  );

  // ── Critical overlay: lists all undismissed critical accounts ──────────────
  if (undismissedCriticals.length > 0) {
    return (
      <div className="fixed inset-0 z-[101] bg-black/95 flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-xl w-full">
          <div className="text-center">
            <h1 className="text-[100px] sm:text-[160px] font-black text-loss leading-none tracking-tight">
              STOP
            </h1>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider">
              Challenge Guardian · Premium
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-4">
              {t("stop_title")}
            </h2>
            <p className="text-loss mt-2 font-semibold">{t("guardian_overlay_instruction")}</p>
          </div>

          {/* One row per critical account */}
          <div className="mt-6 rounded-xl border border-border bg-background divide-y divide-border overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
              {t("guardian_overlay_accounts_title")}
            </p>
            {undismissedCriticals.map((a) => {
              const msgKey =
                a.ddType === "daily"
                  ? "guardian_overlay_account_daily"
                  : "guardian_overlay_account_total";
              return (
                <div key={`${a.challengeId}_${a.ddType}`} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm text-foreground">
                      {fmt(t(msgKey), a.accountLabel, a.usedPct, a.remainingEur)}
                    </p>
                    <span className="text-loss font-bold tabular-nums shrink-0">
                      {Math.round(a.usedPct * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-loss animate-pulse"
                      style={{ width: `${Math.min(a.usedPct * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => dismissAllCritical(undismissedCriticals)}
              className="px-6 py-3 bg-loss/20 border border-loss/40 text-loss rounded-lg font-medium hover:bg-loss/30 transition-colors"
            >
              {t("guardian_understand")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Banner stack: one per warning / dismissed critical ──────────────────────
  if (bannerAlerts.length === 0) return null;

  return (
    <>
      {bannerAlerts.map((a) => {
        const wasCritical = a.level === "critical"; // critical already dismissed
        const msgKey =
          a.ddType === "daily"
            ? "guardian_banner_account_daily"
            : "guardian_banner_account_total";
        const text = fmt(t(msgKey), a.accountLabel, a.usedPct, a.remainingEur);

        return (
          <div
            key={`${a.challengeId}_${a.ddType}`}
            className={`border-b px-4 py-2 flex items-center justify-between gap-2 text-sm ${
              wasCritical
                ? "bg-loss/10 border-loss/30"
                : "bg-orange-500/20 border-orange-500/40"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg
                className={`w-4 h-4 shrink-0 ${wasCritical ? "text-loss" : "text-orange-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
                />
              </svg>
              <span
                className={`font-medium truncate ${
                  wasCritical ? "text-loss" : "text-orange-400"
                }`}
              >
                {text}
              </span>
            </div>
            {/* Dismiss button — warnings only; dismissed criticals already wrote to storage */}
            {!wasCritical && (
              <button
                onClick={() => dismissAlert(a.challengeId, a.ddType)}
                aria-label="Fermer"
                className="shrink-0 text-muted hover:text-foreground transition-colors ml-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
