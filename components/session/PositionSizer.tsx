"use client";

import { computeChallengeRules } from "@/lib/challenge-rules";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeLotSize,
  computeMaxRiskEur,
  getDefaultPipValuePerLot,
  type RiskCap,
} from "@/lib/position-sizing";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  accountSize: number;
  strategy: {
    risk_per_trade_pct: number | null;
    max_sl_pips: number | null;
  } | null;
}

interface ChallengeDD {
  dailyDdRemainingEur: number;
  totalDdRemainingEur: number;
}

const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent";

export default function PositionSizer({ accountSize, strategy }: Props) {
  const { t } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const supabase = createClient();

  // Challenge DD ceilings (null when no active challenge)
  const [challengeDD, setChallengeDD] = useState<ChallengeDD | null>(null);

  // Calculator local state
  const [symbol, setSymbol] = useState("");
  const [slPips, setSlPips] = useState(
    strategy?.max_sl_pips != null ? String(strategy.max_sl_pips) : ""
  );
  const [pipValue, setPipValue] = useState("");

  // Load challenge DD on mount (same approach as ChallengeGuardian)
  useEffect(() => {
    if (plan !== "premium") return;
    loadChallengeDD();
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadChallengeDD() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const { data: challenge } = await supabase
      .from("prop_challenges")
      .select(
        "id, account_size, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown, balance"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("type", "prop")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) return;

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
      .reduce(
        (s, tr) => s + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0),
        0
      );

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
      equityCurveBalances
    );

    setChallengeDD({
      dailyDdRemainingEur: rules.dailyDdRemainingEur,
      totalDdRemainingEur: rules.totalDdRemainingEur,
    });
  }

  // When symbol changes → auto-fill pip value default
  function handleSymbolChange(val: string) {
    setSymbol(val);
    const def = getDefaultPipValuePerLot(val.trim());
    if (def !== null) {
      setPipValue(String(def));
    } else {
      setPipValue("");
    }
  }

  // ── Derived calculations ──────────────────────────────────────────────────
  const maxRisk = computeMaxRiskEur({
    riskPct: strategy?.risk_per_trade_pct ?? null,
    accountSize,
    dailyDdRemainingEur: challengeDD?.dailyDdRemainingEur ?? null,
    totalDdRemainingEur: challengeDD?.totalDdRemainingEur ?? null,
  });

  const slPipsNum = parseFloat(slPips);
  const pipValueNum = parseFloat(pipValue);

  const lotResult =
    maxRisk && !isNaN(slPipsNum) && !isNaN(pipValueNum)
      ? computeLotSize({
          riskEur: maxRisk.riskEur,
          slPips: slPipsNum,
          pipValuePerLot: pipValueNum,
        })
      : null;

  function cappedByLabel(cap: RiskCap): string {
    if (cap === "daily_dd") return t("sizer_capped_daily_dd");
    if (cap === "total_dd") return t("sizer_capped_total_dd");
    return t("sizer_capped_risk_pct");
  }

  // ── Gating ────────────────────────────────────────────────────────────────
  if (planLoading) return null;

  if (plan !== "premium") {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("sizer_premium_title")}
          </p>
          <p className="text-xs text-muted mt-0.5">{t("sizer_premium_desc")}</p>
        </div>
        <Link
          href="/dashboard/upgrade"
          className="shrink-0 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          {t("plan_upgrade_btn")}
        </Link>
      </div>
    );
  }

  // ── Full calculator ───────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {t("sizer_title")}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
          Premium
        </span>
      </div>

      {/* Risk € display — always prominent */}
      <div
        className={`rounded-lg px-4 py-3 flex flex-col gap-0.5 ${
          maxRisk
            ? "bg-profit/10 border border-profit/30"
            : "bg-surface border border-border"
        }`}
      >
        <span className="text-xs text-muted uppercase tracking-wider">
          {t("sizer_max_risk_label")}
        </span>
        {maxRisk ? (
          <>
            <span className="text-xl font-bold text-profit tabular-nums">
              {maxRisk.riskEur.toFixed(2)} €
            </span>
            <span className="text-xs text-muted">
              {cappedByLabel(maxRisk.cappedBy)}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">{t("sizer_risk_undefined")}</span>
        )}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Instrument */}
        <div>
          <label className="block text-xs text-muted mb-1">
            {t("sizer_instrument")}
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            placeholder="XAUUSD"
            className={inputClass}
          />
        </div>

        {/* SL pips */}
        <div>
          <label className="block text-xs text-muted mb-1">
            {t("sizer_sl_pips")}
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={slPips}
            onChange={(e) => setSlPips(e.target.value)}
            placeholder={strategy?.max_sl_pips != null ? String(strategy.max_sl_pips) : "20"}
            className={inputClass}
          />
        </div>

        {/* Pip value per lot */}
        <div>
          <label
            className="block text-xs text-muted mb-1"
            title={t("sizer_pip_value_tooltip")}
          >
            {t("sizer_pip_value")}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={pipValue}
            onChange={(e) => setPipValue(e.target.value)}
            placeholder="10"
            className={`${inputClass} ${
              symbol && !pipValue
                ? "border-amber-500/50 focus:ring-amber-500"
                : ""
            }`}
          />
          {symbol && !pipValue && (
            <p className="text-xs text-amber-400 mt-1">
              {t("sizer_pip_value_manual")}
            </p>
          )}
        </div>
      </div>

      {/* Result */}
      <div
        className={`rounded-lg px-4 py-3 border transition-colors ${
          lotResult
            ? "bg-accent/10 border-accent/30"
            : "bg-surface border-border"
        }`}
      >
        {lotResult ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs text-muted uppercase tracking-wider">
              {t("sizer_lot_label")}
            </span>
            <span className="text-2xl font-bold text-accent tabular-nums motion-safe:transition-all">
              {lotResult.lots.toFixed(2)}
            </span>
            <span className="text-xs text-muted">lots</span>
            {Math.abs(lotResult.raw - lotResult.lots) >= 0.005 && (
              <span className="text-xs text-muted">
                ({t("sizer_raw_label")} {lotResult.raw.toFixed(3)})
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {!slPips || !pipValue
              ? t("sizer_fill_sl_pip")
              : t("sizer_lot_unavailable")}
          </p>
        )}
      </div>
    </div>
  );
}
