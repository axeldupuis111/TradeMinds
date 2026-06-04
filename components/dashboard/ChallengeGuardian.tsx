"use client";

/**
 * ChallengeGuardian — Premium-only real-time prop-firm DD watchdog.
 *
 * Renders nothing for free/plus users (StopTradingGuard still covers their
 * strategy-level limits).  For premium users with an active prop challenge,
 * it subscribes to Realtime changes on `trades` and `prop_challenges` and
 * fires:
 *   ≥ 80% of a DD limit → persistent banner (warning)
 *   ≥ 95% of a DD limit → full-screen overlay (critical) — z-[101] so it
 *                          sits above the StopTradingGuard overlay (z-[100])
 *
 * The StopTradingGuard watches strategy limits (max_daily_loss %).
 * The Guardian watches challenge-specific limits (max_daily_dd_pct /
 * max_total_dd_pct) which are the prop-firm rules that actually disqualify
 * the account.  When both would show an overlay, the Guardian takes
 * precedence (higher z-index).
 */

import { computeChallengeRules } from "@/lib/challenge-rules";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = "warning" | "critical";
type DdType = "daily" | "total";

interface GuardianAlert {
  level: AlertLevel;
  ddType: DdType;
  usedPct: number;    // 0–1+
  remainingEur: number;
}

interface DismissRecord {
  date: string;
  ddType: DdType;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "challenge_guardian_dismissed";

function readDismiss(): DismissRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: DismissRecord = JSON.parse(raw);
    if (!parsed.date || !parsed.ddType) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDismiss(record: DismissRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

function clearDismiss(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Message helpers ──────────────────────────────────────────────────────────

function fmt(
  template: string,
  pct: number,
  eur: number,
): string {
  return template
    .replace("{pct}", Math.round(pct * 100).toString())
    .replace("{eur}", Math.round(eur).toString());
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChallengeGuardian() {
  const { plan } = usePlan();
  const { t } = useLanguage();
  const supabase = createClient();

  const [alert, setAlert] = useState<GuardianAlert | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  // Gate: only premium users get this watchdog.
  // Return early AFTER all hooks to respect rules-of-hooks.
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

    // Fetch first active prop challenge with all rule fields.
    const { data: challenge } = await supabase
      .from("prop_challenges")
      .select(
        "id, account_size, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown, balance",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("type", "prop")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) {
      clearDismiss();
      setOverlayDismissed(false);
      setAlert(null);
      return;
    }

    // All trades for this challenge (to build equityCurveBalances for trailing DD).
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

    // Build running balance array (needed for trailing equityHigh).
    let running = challenge.account_size;
    const equityCurveBalances = (allTrades || []).map((tr) => {
      running += (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
      return running;
    });

    // Today PnL from closed trades only.
    const todayPnl = (todayTrades || [])
      .filter((tr) => tr.status === "closed")
      .reduce((s, tr) => s + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0), 0);

    // Use the latest computed balance (more accurate than stored value).
    const balance = equityCurveBalances.length > 0
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

    // Determine the highest-priority alert.
    // Priority: critical > warning; total_dd > daily_dd within same level.
    let detected: GuardianAlert | null = null;

    const candidates: GuardianAlert[] = [];

    if (rules.ddDailyUsedPct >= 0.8 && rules.dailyDdMax > 0) {
      candidates.push({
        level: rules.ddDailyUsedPct >= 0.95 ? "critical" : "warning",
        ddType: "daily",
        usedPct: rules.ddDailyUsedPct,
        remainingEur: rules.dailyDdRemainingEur,
      });
    }
    if (rules.ddTotalUsedPct >= 0.8 && rules.totalDdMax > 0) {
      candidates.push({
        level: rules.ddTotalUsedPct >= 0.95 ? "critical" : "warning",
        ddType: "total",
        usedPct: rules.ddTotalUsedPct,
        remainingEur: rules.totalDdRemainingEur,
      });
    }

    if (candidates.length > 0) {
      // Highest priority: critical beats warning; within same level, total beats daily.
      const criticals = candidates.filter((c) => c.level === "critical");
      const pool = criticals.length > 0 ? criticals : candidates;
      const totalDd = pool.find((c) => c.ddType === "total");
      detected = totalDd ?? pool[0];
    }

    if (!detected) {
      clearDismiss();
      setOverlayDismissed(false);
      setAlert(null);
      return;
    }

    setAlert(detected);

    // Check if already dismissed today for this ddType.
    const dismissed = readDismiss();
    if (dismissed && dismissed.date === today && dismissed.ddType === detected.ddType) {
      setOverlayDismissed(true);
    } else {
      setOverlayDismissed(false);
    }
  }

  function dismiss() {
    if (!alert) return;
    writeDismiss({
      date: new Date().toISOString().split("T")[0],
      ddType: alert.ddType,
    });
    setOverlayDismissed(true);
  }

  // No alert, or non-premium: render nothing.
  if (!isPremium || !alert) return null;

  // ── Banner (after dismiss or warning level only) ──────────────────────────
  if (overlayDismissed || alert.level === "warning") {
    const bannerKey = alert.ddType === "daily" ? "guardian_banner_daily" : "guardian_banner_total";
    const bannerText = fmt(t(bannerKey), alert.usedPct, alert.remainingEur);
    return (
      <div className="bg-orange-500/20 border-b border-orange-500/40 px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
        </svg>
        <span className={`font-medium ${overlayDismissed ? "text-loss" : "text-orange-400"}`}>
          {bannerText}
        </span>
      </div>
    );
  }

  // ── Critical overlay (z-[101] > StopTradingGuard z-[100]) ────────────────
  const msgKey = alert.ddType === "daily" ? "guardian_daily_dd_critical" : "guardian_total_dd_critical";
  const msg = fmt(t(msgKey), alert.usedPct, alert.remainingEur);

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
          <p className="text-muted mt-3 text-base leading-relaxed max-w-sm mx-auto">{msg}</p>
          <p className="text-loss mt-2 font-semibold">{t("guardian_overlay_instruction")}</p>
        </div>

        {/* Visual severity bar */}
        <div className="mt-8 rounded-xl border border-border bg-background p-5">
          <div className="flex justify-between text-xs text-muted mb-2">
            <span>{alert.ddType === "daily" ? "DD journalier challenge" : "DD total challenge"}</span>
            <span className="text-loss font-semibold">{Math.round(alert.usedPct * 100)}%</span>
          </div>
          <div className="h-3 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-loss animate-pulse"
              style={{ width: `${Math.min(alert.usedPct * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2 text-right">
            {Math.round(alert.remainingEur)}€ restants
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={dismiss}
            className="px-6 py-3 bg-loss/20 border border-loss/40 text-loss rounded-lg font-medium hover:bg-loss/30 transition-colors"
          >
            {t("guardian_understand")}
          </button>
        </div>
      </div>
    </div>
  );
}
