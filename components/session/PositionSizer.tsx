"use client";

import { computeChallengeRules } from "@/lib/challenge-rules";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  actualRiskForContracts,
  computeContracts,
  computeLotSize,
  computeMaxRiskEur,
  getDefaultPipValuePerLot,
  getUnitsPerLot,
  type RiskCap,
} from "@/lib/position-sizing";
import {
  FUTURES_CONTRACTS,
  getFuturesContract,
} from "@/lib/futures-contracts";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { Info, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  strategy: {
    risk_per_trade_pct: number | null;
    max_sl_pips: number | null;
  } | null;
}

const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent";

export default function PositionSizer({ strategy }: Props) {
  const { t } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const supabase = createClient();

  // ── Active account from shared context (same as session page) ─────────────
  const { selectedAccount } = useActiveAccount();
  const accountSize = selectedAccount?.account_size ?? 0;

  // ── DD ceilings: computed from active account trades on mount + account change
  const [dailyDdRemaining, setDailyDdRemaining] = useState<number | null>(null);
  const [totalDdRemaining, setTotalDdRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (plan !== "premium" || !selectedAccount) {
      setDailyDdRemaining(null);
      setTotalDdRemaining(null);
      return;
    }
    // Only prop-type accounts have DD rules; skip others.
    if (selectedAccount.type !== "prop") {
      setDailyDdRemaining(null);
      setTotalDdRemaining(null);
      return;
    }
    loadDD(selectedAccount.id, selectedAccount);
  }, [plan, selectedAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDD(
    challengeId: string,
    account: NonNullable<typeof selectedAccount>
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const [{ data: allTrades }, { data: todayTrades }] = await Promise.all([
      supabase
        .from("trades")
        .select("pnl, commission, swap")
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId)
        .order("open_time", { ascending: true }),
      supabase
        .from("trades")
        .select("pnl, commission, swap, status")
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId)
        .gte("open_time", today),
    ]);

    let running = account.account_size;
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
        : account.balance;

    const rules = computeChallengeRules(
      {
        account_size: account.account_size,
        profit_target_pct: account.profit_target_pct,
        max_daily_dd_pct: account.max_daily_dd_pct,
        max_total_dd_pct: account.max_total_dd_pct,
        trailing_drawdown: account.trailing_drawdown,
      },
      balance,
      todayPnl,
      equityCurveBalances
    );

    setDailyDdRemaining(rules.dailyDdRemainingEur);
    setTotalDdRemaining(rules.totalDdRemainingEur);
  }

  // ── Market type from active account ──────────────────────────────────────
  const isFutures = selectedAccount?.market_type === "futures";

  // ── Common inputs: account balance + risk per trade (editable) ────────────
  // Prefilled from the active account / strategy, but the user can override —
  // this is what makes it a real, transparent lot calculator.
  const [balance, setBalance] = useState(accountSize > 0 ? String(accountSize) : "");
  const [riskMode, setRiskMode] = useState<"pct" | "eur">("pct");
  const [riskValue, setRiskValue] = useState(
    strategy?.risk_per_trade_pct != null ? String(strategy.risk_per_trade_pct) : ""
  );

  // Keep balance in sync when the active account changes (only if untouched/empty-driven).
  useEffect(() => {
    if (accountSize > 0) setBalance(String(accountSize));
  }, [accountSize]);

  // ── CFD state ─────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("");
  const [slPips, setSlPips] = useState(
    strategy?.max_sl_pips != null ? String(strategy.max_sl_pips) : ""
  );
  const [pipValue, setPipValue] = useState("");
  const [showPipHelp, setShowPipHelp] = useState(false);

  function handleSymbolChange(val: string) {
    setSymbol(val);
    const def = getDefaultPipValuePerLot(val.trim());
    setPipValue(def !== null ? String(def) : "");
  }

  // ── Futures state ─────────────────────────────────────────────────────────
  const [futuresSymbol, setFuturesSymbol] = useState(FUTURES_CONTRACTS[0].symbol);
  const [slPoints, setSlPoints] = useState("");

  // ── Shared derived: max risk (common to both modes) ───────────────────────
  // The user-entered balance + risk define the intended risk; the challenge
  // drawdown ceilings still cap it (TradeDiscipline's discipline guard).
  const balanceNum = parseFloat(balance);
  const riskNum = parseFloat(riskValue);
  const intendedRiskEur =
    riskMode === "pct"
      ? !isNaN(riskNum) && !isNaN(balanceNum)
        ? (riskNum / 100) * balanceNum
        : NaN
      : riskNum;

  const maxRisk = computeMaxRiskEur({
    // express the intended risk as an equivalent % of balance so DD caps apply
    riskPct:
      !isNaN(intendedRiskEur) && balanceNum > 0
        ? (intendedRiskEur / balanceNum) * 100
        : null,
    accountSize: balanceNum > 0 ? balanceNum : 0,
    dailyDdRemainingEur: dailyDdRemaining,
    totalDdRemainingEur: totalDdRemaining,
  });

  // ── CFD derived ───────────────────────────────────────────────────────────
  const slPipsNum = parseFloat(slPips);
  const pipValueNum = parseFloat(pipValue);

  const lotResult =
    !isFutures && maxRisk && !isNaN(slPipsNum) && !isNaN(pipValueNum)
      ? computeLotSize({
          riskEur: maxRisk.riskEur,
          slPips: slPipsNum,
          pipValuePerLot: pipValueNum,
        })
      : null;

  // ── Futures derived ───────────────────────────────────────────────────────
  const futuresContract = getFuturesContract(futuresSymbol);
  const slPointsNum = parseFloat(slPoints);

  const contractCount =
    isFutures && maxRisk && futuresContract && !isNaN(slPointsNum)
      ? computeContracts({
          riskAmount: maxRisk.riskEur,
          slPoints: slPointsNum,
          pointValue: futuresContract.pointValue,
        })
      : null;

  const actualRisk =
    contractCount !== null && futuresContract && !isNaN(slPointsNum)
      ? actualRiskForContracts({
          contracts: contractCount,
          slPoints: slPointsNum,
          pointValue: futuresContract.pointValue,
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
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {t("sizer_title")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
            Premium
          </span>
        </div>
        <p className="text-xs text-muted mt-0.5">{t("sizer_subtitle")}</p>
      </div>

      {/* Common inputs — account balance + risk per trade (editable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Account balance */}
        <div>
          <label className="block text-xs text-muted mb-1">{t("sizer_balance_label")}</label>
          <input
            type="number"
            min="0"
            step="100"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="10000"
            className={inputClass}
          />
          {accountSize > 0 && (
            <p className="text-xs text-muted mt-1">{t("sizer_balance_hint")}</p>
          )}
        </div>

        {/* Risk per trade with %/€ toggle */}
        <div>
          <label className="block text-xs text-muted mb-1">{t("sizer_risk_label")}</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step={riskMode === "pct" ? "0.1" : "10"}
              value={riskValue}
              onChange={(e) => setRiskValue(e.target.value)}
              placeholder={riskMode === "pct" ? "1" : "100"}
              className={`${inputClass} flex-1`}
            />
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              {(["pct", "eur"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRiskMode(m)}
                  className={`px-3 text-sm font-medium transition-colors ${
                    riskMode === m
                      ? "bg-accent text-white"
                      : "bg-surface text-muted hover:text-foreground"
                  }`}
                  aria-pressed={riskMode === m}
                >
                  {m === "pct" ? "%" : "€"}
                </button>
              ))}
            </div>
          </div>
          {strategy?.risk_per_trade_pct != null && (
            <p className="text-xs text-muted mt-1">{t("sizer_risk_hint")}</p>
          )}
        </div>
      </div>

      {/* Risk display — common to both modes, currency symbol adapts */}
      {maxRisk && maxRisk.riskEur === 0 ? (
        <div className="rounded-lg px-4 py-3 flex items-start gap-3 bg-loss/10 border border-loss/40">
          <span className="text-loss text-lg leading-none mt-0.5">⛔</span>
          <div>
            <p className="text-sm font-semibold text-loss">{t("sizer_limit_reached")}</p>
            <p className="text-xs text-loss/80 mt-0.5">{cappedByLabel(maxRisk.cappedBy)}</p>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-lg px-4 py-3 flex flex-col gap-0.5 ${
            maxRisk ? "bg-profit/10 border border-profit/30" : "bg-surface border border-border"
          }`}
        >
          <span className="text-xs text-muted uppercase tracking-wider">{t("sizer_max_risk_label")}</span>
          {maxRisk ? (
            <>
              <span className="text-xl font-bold text-profit tabular-nums">
                {maxRisk.riskEur.toFixed(2)} {isFutures ? "$" : "€"}
              </span>
              <span className="text-xs text-muted">{cappedByLabel(maxRisk.cappedBy)}</span>
            </>
          ) : (
            <span className="text-sm text-muted">{t("sizer_risk_undefined")}</span>
          )}
        </div>
      )}

      {/* Inputs + result — hidden when limit fully consumed */}
      {maxRisk?.riskEur !== 0 && (
        <>
          {isFutures ? (
            /* ── FUTURES MODE ────────────────────────────────────────────── */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Contract selector */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("sizer_futures_contract")}
                  </label>
                  <select
                    value={futuresSymbol}
                    onChange={(e) => setFuturesSymbol(e.target.value)}
                    className={inputClass}
                  >
                    {FUTURES_CONTRACTS.map((c) => (
                      <option key={c.symbol} value={c.symbol}>
                        {c.symbol} · {c.name}
                      </option>
                    ))}
                  </select>
                  {futuresContract && (
                    <p className="text-xs text-muted mt-1">
                      {t("sizer_futures_point_value")
                        .replace("{sym}", futuresContract.symbol)
                        .replace("{val}", String(futuresContract.pointValue))}
                    </p>
                  )}
                </div>

                {/* SL in points */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("sizer_futures_sl_points")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={futuresContract ? String(futuresContract.tickSize) : "0.25"}
                    value={slPoints}
                    onChange={(e) => setSlPoints(e.target.value)}
                    placeholder={futuresContract ? String(futuresContract.tickSize * 4) : "1"}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Futures result */}
              <div
                className={`rounded-lg px-4 py-3 border transition-colors ${
                  contractCount !== null && contractCount > 0
                    ? "bg-accent/10 border-accent/30"
                    : contractCount === 0
                    ? "bg-loss/5 border-loss/20"
                    : "bg-surface border-border"
                }`}
              >
                {contractCount === null ? (
                  <p className="text-sm text-muted">{t("sizer_fill_sl_pip")}</p>
                ) : contractCount === 0 ? (
                  <p className="text-sm text-loss/90">{t("sizer_futures_no_contract")}</p>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted uppercase tracking-wider">
                        {t("sizer_futures_contracts_label")}
                      </span>
                      <span className="text-2xl font-bold text-accent tabular-nums motion-safe:transition-all">
                        {contractCount}
                      </span>
                    </div>
                    {actualRisk !== null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-muted">{t("sizer_futures_actual_risk")}</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {actualRisk.toFixed(2)} $
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── CFD MODE (unchanged) ────────────────────────────────────── */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Instrument */}
                <div>
                  <label className="block text-xs text-muted mb-1">{t("sizer_instrument")}</label>
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
                  <label className="block text-xs text-muted mb-1">{t("sizer_sl_pips")}</label>
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
                <div className="sm:col-span-1">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs text-muted">{t("sizer_pip_value")}</label>
                    <button
                      type="button"
                      onClick={() => setShowPipHelp((v) => !v)}
                      aria-label={t("sizer_pip_help_aria")}
                      aria-expanded={showPipHelp}
                      className="text-muted hover:text-accent transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pipValue}
                    onChange={(e) => setPipValue(e.target.value)}
                    placeholder="10"
                    className={`${inputClass} ${symbol && !pipValue ? "border-amber-500/50 focus:ring-amber-500" : ""}`}
                  />
                  {symbol && !pipValue && (
                    <p className="text-xs text-amber-400 mt-1">{t("sizer_pip_value_manual")}</p>
                  )}
                </div>
              </div>

              {/* Pip help panel */}
              {showPipHelp && (
                <div
                  className="rounded-lg border border-border bg-surface p-4 text-xs text-muted space-y-3 motion-safe:animate-[fadeIn_150ms_ease]"
                  role="region"
                  aria-label={t("sizer_pip_help_aria")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground font-medium text-sm">{t("sizer_pip_help_title")}</p>
                    <button
                      type="button"
                      onClick={() => setShowPipHelp(false)}
                      aria-label={t("sizer_pip_help_close")}
                      className="shrink-0 text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p>{t("sizer_pip_help_def")}</p>
                  <div>
                    <p className="font-medium text-foreground mb-1">{t("sizer_pip_help_where_title")}</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>{t("sizer_pip_help_where_broker")}</li>
                      <li>{t("sizer_pip_help_where_mt")}</li>
                      <li>{t("sizer_pip_help_where_trade")}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">{t("sizer_pip_help_benchmarks_title")}</p>
                    <p>{t("sizer_pip_help_benchmarks")}</p>
                  </div>
                  <p className="text-amber-400">{t("sizer_pip_help_warning")}</p>
                </div>
              )}

              {/* CFD result — lots + units + funds at risk */}
              <div
                className={`rounded-lg px-4 py-3 border transition-colors ${
                  lotResult ? "bg-accent/10 border-accent/30" : "bg-surface border-border"
                }`}
              >
                {lotResult ? (
                  (() => {
                    const unitsPerLot = getUnitsPerLot(symbol.trim());
                    const units = unitsPerLot !== null ? lotResult.lots * unitsPerLot : null;
                    const fundsAtRisk = lotResult.lots * slPipsNum * pipValueNum;
                    return (
                      <div className="space-y-2.5">
                        {/* Lots — headline */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs text-muted uppercase tracking-wider">{t("sizer_lot_label")}</span>
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
                        {/* Units + funds at risk */}
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/60">
                          <div>
                            <p className="text-[11px] text-muted uppercase tracking-wider">{t("sizer_units_label")}</p>
                            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                              {units !== null ? units.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                            </p>
                            {unitsPerLot !== null && (
                              <p className="text-[10px] text-muted/70 mt-0.5">
                                {t("sizer_contract_size")}: {unitsPerLot.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase tracking-wider">{t("sizer_funds_at_risk")}</p>
                            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                              {fundsAtRisk.toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted">
                    {!slPips || !pipValue ? t("sizer_fill_sl_pip") : t("sizer_lot_unavailable")}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
