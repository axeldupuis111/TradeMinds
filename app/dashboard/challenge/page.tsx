"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  accountCurrency,
  currencyMismatch,
  money,
} from "@/lib/account-currency";
import { resolveAccountBalance } from "@/lib/challenge-balance";
import { computeChallengeRules } from "@/lib/challenge-rules";
import { projectChallenge } from "@/lib/challenge-projection";
import { ChallengeProjectionBlock } from "@/components/dashboard/ChallengeProjectionBlock";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { setDemoWatermark } from "@/lib/pdf/kit";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows, chunk, ID_CHUNK } from "@/lib/supabase-paginate";
import { useEffect, useState, useCallback } from "react";

interface Challenge {
  id: string;
  user_id: string;
  type: "prop" | "personal";
  firm: string;
  account_number: string | null;
  account_size: number;
  profit_target_pct: number;
  max_daily_dd_pct: number;
  max_total_dd_pct: number;
  trailing_drawdown: boolean;
  market_type: "cfd" | "futures";
  max_daily_loss_pct: number | null;
  start_date: string;
  end_date: string | null;
  balance: number;
  status: "active" | "passed" | "failed";
  created_at: string;
  /** Devise choisie à la création. Le broker fait autorité s'il en annonce une. */
  currency: string | null;
  /** Solde réel poussé par l'EA. Null tant qu'aucune synchro n'a eu lieu. */
  synced_balance: number | null;
  synced_equity: number | null;
  synced_open_positions: number | null;
  synced_currency: string | null;
  synced_at: string | null;
}

interface AccountStats {
  balance: number;
  currentPnl: number;
  todayPnl: number;
  equityCurveData: { date: string; balance: number }[];
  /** P&L net par trade (chronologique) — pour les stats avancées du PDF. */
  tradePnls: number[];
  tradeCount: number;
  winrate: number;
  /** Le solde vient du broker plutôt que d'une reconstitution. */
  fromBroker: boolean;
  /** Un EA a donné signe de vie il y a moins de 15 min. */
  live: boolean;
  /** Equity temps réel, uniquement si une position est ouverte. */
  equity: number | null;
  openPositions: number;
  /**
   * Point de départ de la courbe d'equity. Vaut account_size tant que rien n'est
   * synchronisé ; une fois le solde réel connu, la courbe est décalée pour finir
   * dessus et sa ligne de référence doit suivre le même décalage.
   */
  curveBaseline: number;
}

const PROP_FIRMS = [
  "Alpha Capital Group", "Apex Trader Funding", "Aquafunded", "Blue Guardian",
  "Bulenox", "City Traders Imperium", "E8 Funding", "Earn2Trade",
  "FTMO", "FXIFY", "FundedNext", "Funded Trading Plus", "Funding Pips",
  "Goat Funded Trader", "Hola Prime", "Instant Funding", "Lux Trading Firm",
  "Maven Trading", "Ment Funding", "MyForexFunds", "MyFundedFX",
  "OFP Funding", "Skilled Funded Trader", "TFT", "The5ers",
  "TopStep", "Trade The Pool", "Traders With Edge", "True Forex Funds", "Ux Funding",
];
const BROKERS = [
  "ActivTrades", "Admiral Markets", "Axi", "BDSwiss", "BlackBull Markets",
  "Capital.com", "CMC Markets", "DEGIRO", "Dukascopy", "eToro",
  "Exness", "FP Markets", "Fusion Markets", "FXCM", "FXPRO",
  "HF Markets", "IC Markets", "IG Group", "InstaForex", "Interactive Brokers",
  "LiteFinance", "Moneta Markets", "MultiBank", "OANDA", "OctaFX",
  "Pepperstone", "Plus500", "RoboForex", "Saxo Bank", "Skilling",
  "Swissquote", "ThinkMarkets", "Tickmill", "Trade Nation", "Tradovate",
  "Vantage", "XM", "XTB",
];
const CUSTOM_VALUE = "__custom__";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";
const inputErrorClass =
  "w-full px-3 py-2 bg-surface border border-red-500 rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500";

function TrailingDdToggle({
  value,
  onChange,
  t,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  t: (key: string) => string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card ${value ? "bg-accent" : "bg-border"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
      <span className="text-sm text-foreground">{t("challenge_trailing_dd")}</span>
      <span className="relative inline-block">
        <button
          type="button"
          className="text-muted hover:text-foreground transition-colors"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Info"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {showTooltip && (
          <span className="absolute left-0 top-6 z-20 w-72 bg-card border border-border rounded-lg p-3 text-xs text-muted shadow-xl">
            {t("challenge_trailing_dd_tooltip")}
          </span>
        )}
      </span>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
  label,
  currency,
  alert,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  currency: string;
  alert?: boolean;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const pctUsed = max > 0 ? value / max : 0;
  const alertLevel = pctUsed > 0.9 ? "critical" : pctUsed > 0.75 ? "warning" : "normal";

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-foreground">
          {money(value, currency)} / {money(max, currency)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            alert && alertLevel === "critical"
              ? "bg-loss animate-pulse"
              : alert && alertLevel === "warning"
                ? "bg-orange-500"
                : color
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DailyLossGauge({
  lossEur,
  stopEur,
  challengeEur,
  currency,
  t,
}: {
  lossEur: number;
  stopEur: number | null;
  challengeEur: number;
  currency: string;
  t: (k: string) => string;
}) {
  const fillPct = challengeEur > 0 ? Math.min((lossEur / challengeEur) * 100, 100) : 0;
  const stopPct =
    stopEur != null && challengeEur > 0
      ? Math.min((stopEur / challengeEur) * 100, 100)
      : null;

  const ref = stopEur && stopEur > 0 ? stopEur : challengeEur;
  const ratio = ref > 0 ? lossEur / ref : 0;

  const fillColor =
    ratio >= 1 ? "bg-loss animate-pulse"
    : ratio >= 0.75 ? "bg-orange-500"
    : "bg-accent";

  const statusColor =
    ratio >= 1 ? "text-loss"
    : ratio >= 0.75 ? "text-orange-500"
    : "text-accent";

  let status: string;
  if (stopEur == null) {
    status = `${money(lossEur, currency)} / ${money(challengeEur, currency)}`;
  } else if (lossEur >= stopEur) {
    status = t("gauge_stop_exceeded").replace("{amount}", money(lossEur - stopEur, currency));
  } else {
    status = t("gauge_remaining").replace("{amount}", money(stopEur - lossEur, currency));
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{t("gauge_daily_loss")}</span>
        <span className={`font-medium ${statusColor}`}>{status}</span>
      </div>
      <div className="relative h-4 text-xs text-muted">
        {stopPct != null && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${stopPct}%` }}>
            {t("gauge_stop_marker")} · {money(stopEur as number, currency)}
          </span>
        )}
      </div>
      <div className="relative h-3 bg-border rounded-full">
        <div className={`h-full rounded-full transition-all duration-500 ${fillColor}`} style={{ width: `${fillPct}%` }} />
        {stopPct != null && (
          <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/40" style={{ left: `${stopPct}%` }} />
        )}
      </div>
      <div className="text-right text-xs text-muted mt-1">
        {t("gauge_challenge_marker")} · {money(challengeEur, currency)}
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-green-500/30 text-green-400 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        {t("challenge_status_active")}
      </span>
    );
  }
  if (status === "passed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-green-500/30 text-green-400 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        {t("challenge_status_passed")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-red-500/30 text-red-400 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        {t("challenge_status_failed")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-500/30 text-gray-400 select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {t("challenge_closed")}
    </span>
  );
}

// One-click prop-firm presets. Percentages (not € amounts) so they scale with
// any account size. These are common, well-known defaults — the UI labels them
// as editable starting values since firm rules change and vary by program.
const PROP_TEMPLATES: {
  name: string;
  profit: number;
  daily: number;
  total: number;
  trailing: boolean;
  market: "cfd" | "futures";
}[] = [
  // Names match the PROP_FIRMS dropdown exactly so the firm select stays in sync.
  { name: "FTMO", profit: 10, daily: 5, total: 10, trailing: false, market: "cfd" },
  { name: "Funding Pips", profit: 8, daily: 5, total: 10, trailing: false, market: "cfd" },
  { name: "The5ers", profit: 8, daily: 5, total: 10, trailing: false, market: "cfd" },
  { name: "TopStep", profit: 6, daily: 2, total: 4, trailing: true, market: "futures" },
];

function EditAccountModal({
  account,
  onConfirm,
  onCancel,
  t,
}: {
  account: Challenge;
  onConfirm: (data: Partial<Challenge>) => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [firm, setFirm] = useState(account.firm);
  const [accountNumber, setAccountNumber] = useState(account.account_number || "");
  const [accountType, setAccountType] = useState<"prop" | "personal">(account.type);
  const [accountSize, setAccountSize] = useState(String(account.account_size));
  const [currency, setCurrency] = useState(account.currency || DEFAULT_CURRENCY);
  const [profitTarget, setProfitTarget] = useState(String(account.profit_target_pct));
  const [maxDailyDd, setMaxDailyDd] = useState(String(account.max_daily_dd_pct));
  const [maxTotalDd, setMaxTotalDd] = useState(String(account.max_total_dd_pct));
  const [trailingDrawdown, setTrailingDrawdown] = useState(account.trailing_drawdown ?? false);
  const [marketType, setMarketType] = useState<"cfd" | "futures">(account.market_type ?? "cfd");
  const [maxDailyLoss, setMaxDailyLoss] = useState(
    account.max_daily_loss_pct != null ? String(account.max_daily_loss_pct) : ""
  );
  const [startDate, setStartDate] = useState(account.start_date);
  const [endDate, setEndDate] = useState(account.end_date || "");
  const [status, setStatus] = useState(account.status);

  function handleSubmit() {
    if (!firm.trim() || !accountSize || parseFloat(accountSize) <= 0) return;
    onConfirm({
      firm: firm.trim(),
      account_number: accountNumber.trim() || null,
      type: accountType,
      account_size: parseFloat(accountSize),
      currency,
      profit_target_pct: accountType === "prop" ? (parseFloat(profitTarget) || 0) : 0,
      max_daily_dd_pct: accountType === "prop" ? (parseFloat(maxDailyDd) || 0) : 0,
      max_total_dd_pct: accountType === "prop" ? (parseFloat(maxTotalDd) || 0) : 0,
      trailing_drawdown: accountType === "prop" ? trailingDrawdown : false,
      market_type: marketType,
      max_daily_loss_pct: maxDailyLoss.trim() ? parseFloat(maxDailyLoss) : null,
      start_date: startDate,
      end_date: endDate || null,
      status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-foreground font-semibold mb-4">{t("challenge_edit_title")}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">{t("challenge_edit_name")}</label>
            <input type="text" value={firm} onChange={(e) => setFirm(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">{t("challenge_account_number")}</label>
            <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">{t("challenge_account_type")}</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as "prop" | "personal")} className={inputClass}>
              <option value="prop">{t("challenge_type_prop")}</option>
              <option value="personal">{t("challenge_type_personal")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">{t("challenge_market_type")}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMarketType("cfd")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${marketType === "cfd" ? "bg-accent text-on-accent border-accent" : "border-border text-muted hover:border-accent/50"}`}>
                {t("challenge_market_cfd")}
              </button>
              <button type="button" onClick={() => setMarketType("futures")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${marketType === "futures" ? "bg-accent text-on-accent border-accent" : "border-border text-muted hover:border-accent/50"}`}>
                {t("challenge_market_futures")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_account_size")}</label>
              <input type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_currency")}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {accountType === "prop" && (
            <>
              <div>
                <label className="block text-sm text-muted mb-2">{t("challenge_templates")}</label>
                <div className="flex flex-wrap gap-2">
                  {PROP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setFirm(tpl.name);
                        setProfitTarget(String(tpl.profit));
                        setMaxDailyDd(String(tpl.daily));
                        setMaxTotalDd(String(tpl.total));
                        setTrailingDrawdown(tpl.trailing);
                        setMarketType(tpl.market);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:border-accent/50 hover:text-foreground transition-colors"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1">{t("challenge_templates_help")}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_profit_target_pct")}</label>
                  <input type="number" step="0.1" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_daily_dd_pct")}</label>
                  <input type="number" step="0.1" value={maxDailyDd} onChange={(e) => setMaxDailyDd(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_total_dd_pct")}</label>
                  <input type="number" step="0.1" value={maxTotalDd} onChange={(e) => setMaxTotalDd(e.target.value)} className={inputClass} />
                </div>
              </div>
              <TrailingDdToggle value={trailingDrawdown} onChange={setTrailingDrawdown} t={t} />
              {/* Discipline limit — personal stop-trading rule, optional */}
              <div>
                <label className="block text-sm text-muted mb-1">{t("challenge_max_daily_loss_pct")}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(e.target.value)}
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
                <p className="text-xs text-muted mt-1">{t("challenge_max_daily_loss_pct_help")}</p>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_start_date")}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_end_date")}</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">{t("challenge_edit_status")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Challenge["status"])} className={inputClass}>
              <option value="active">{t("challenge_status_active")}</option>
              <option value="passed">{t("challenge_status_passed")}</option>
              <option value="failed">{t("challenge_status_failed")}</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors">
            {t("csv_cancel")}
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors">
            {t("challenge_edit_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modale de suppression d'un compte.
 *
 * L'echec s'affiche ICI, dans la modale. La banniere de la page vit tout en bas,
 * dans le formulaire de creation : un utilisateur qui vient de cliquer sur
 * « Supprimer » depuis la carte de son compte ne la voit jamais, et l'echec
 * ressemble alors a un bouton mort.
 */
function DeleteAccountModal({
  accountName,
  tradeCount,
  onConfirm,
  onCancel,
  t,
}: {
  accountName: string;
  tradeCount: number;
  /** Renvoie null si la suppression a eu lieu, sinon le message a afficher. */
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    // Succes : le parent demonte la modale. Echec : elle reste ouverte avec la
    // raison sous les yeux.
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  }

  const question =
    tradeCount > 0
      ? t("challenge_delete_account_confirm_trades")
          .replace("{name}", accountName)
          .replace("{count}", String(tradeCount))
      : t("challenge_delete_account_confirm").replace("{name}", accountName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-loss font-semibold mb-3">{t("challenge_delete_account_title")}</h3>
        <p className="text-foreground text-sm leading-relaxed">{question}</p>
        {error && (
          <p className="text-loss text-sm leading-relaxed mt-3 border-t border-border pt-3">{error}</p>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={busy} className="flex-1 py-2 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50">
            {t("csv_cancel")}
          </button>
          <button onClick={confirm} disabled={busy} className="flex-1 py-2 bg-loss text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
            {busy ? t("challenge_deleting") : t("challenge_delete_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  ac,
  stats,
  isSelected,
  onSelect,
  onStatusChange,
  onEdit,
  onDelete,
  onExportPdf,
  t,
}: {
  ac: Challenge;
  stats: AccountStats;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (id: string, status: "passed" | "failed") => void;
  onEdit: (id: string, data: Partial<Challenge>) => void;
  /** Renvoie null si le compte est parti, sinon le message a afficher. */
  onDelete: (id: string) => Promise<string | null>;
  onExportPdf: () => void;
  t: (key: string) => string;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const balance = stats.balance;
  const currentPnl = stats.currentPnl;
  const todayPnl = stats.todayPnl;
  const hasNoTrades = stats.equityCurveData.length === 0;
  const isProp = (ac.type ?? "prop") === "prop";
  // Devise du compte : le broker fait autorité, la saisie sert de repli.
  const cur = accountCurrency(ac);
  const mismatch = currencyMismatch(ac);

  // Shared DD / progress calculations via single-source-of-truth util.
  // trailing_drawdown=false path is ISO vs. the previous inline code.
  const rules = computeChallengeRules(
    ac,
    balance,
    todayPnl,
    stats.equityCurveData.map((d) => d.balance),
  );

  // Projection (prop challenges only) — probabilité de passer avant de percer le
  // DD. On lit les P&L par trade tels quels : les redériver depuis la courbe
  // ferait absorber au premier trade le décalage de calage sur le solde réel.
  const projection = isProp
    ? projectChallenge({
        profitRemainingEur: rules.profitRemainingEur,
        ddBufferEur: rules.totalDdRemainingEur,
        tradePnls: stats.tradePnls,
        tradeDays: stats.equityCurveData.map((d) => d.date),
      })
    : null;

  const daysElapsed = Math.floor(
    (Date.now() - new Date(ac.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = ac.end_date
    ? Math.max(0, Math.floor((new Date(ac.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className={`bg-card border rounded-xl p-6 transition-colors ${isSelected ? "border-accent ring-1 ring-accent" : "border-border"}`}>
      {showEdit && (
        <EditAccountModal
          account={ac}
          onConfirm={(data) => { onEdit(ac.id, data); setShowEdit(false); }}
          onCancel={() => setShowEdit(false)}
          t={t}
        />
      )}
      {showDeleteConfirm && (
        <DeleteAccountModal
          accountName={ac.firm}
          tradeCount={stats.tradeCount}
          onConfirm={async () => {
            const failure = await onDelete(ac.id);
            if (!failure) setShowDeleteConfirm(false);
            return failure;
          }}
          onCancel={() => setShowDeleteConfirm(false)}
          t={t}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {ac.firm} · {money(ac.account_size, cur)}
            </h2>
          </div>
          <p className="text-muted text-sm">
            {ac.account_number && <span className="text-foreground">#{ac.account_number} · </span>}
            {t("challenge_started")} {new Date(ac.start_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isSelected ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent text-on-accent">
              {t("account_selected")}
            </span>
          ) : (
            <button
              onClick={onSelect}
              className="px-3 py-1 rounded-full text-xs font-medium border border-border text-muted hover:text-accent hover:border-accent transition-colors"
            >
              {t("account_select_action")}
            </button>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
            {isProp ? t("challenge_type_prop") : t("challenge_type_personal")}
          </span>
          <StatusBadge status={ac.status} t={t} />
        </div>
      </div>

      {/* Devise : le broker annonce autre chose que ce qui a été saisi. On
          affiche déjà la sienne, l'avis sert à corriger la fiche du compte. */}
      {mismatch && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <span className="text-muted">
            {t("challenge_currency_mismatch")
              .replace("{broker}", mismatch.broker)
              .replace("{saved}", mismatch.saved)}
          </span>
          <button
            onClick={() => onEdit(ac.id, { currency: mismatch.broker })}
            className="font-medium text-accent hover:underline"
          >
            {t("challenge_currency_align").replace("{broker}", mismatch.broker)}
          </button>
        </div>
      )}

      {/* Progress bars — only for prop firm */}
      {isProp && (
        <div className="space-y-4">
          <ProgressBar value={rules.profitUsed} max={rules.profitMax} color="bg-profit" label={t("challenge_profit_target")} currency={cur} />
          <ProgressBar value={rules.totalDdUsed} max={rules.totalDdMax} color="bg-loss" label={t("challenge_total_dd")} currency={cur} alert />
          <DailyLossGauge
            lossEur={rules.dailyDdUsed}
            stopEur={ac.max_daily_loss_pct != null ? ac.account_size * (ac.max_daily_loss_pct / 100) : null}
            challengeEur={rules.dailyDdMax}
            currency={cur}
            t={t}
          />
        </div>
      )}

      {/* Stats grid */}
      <div className={`grid grid-cols-2 ${isProp ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3 mt-6`}>
        <div className="bg-background rounded-lg p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted">{t("challenge_balance")}</p>
            {stats.live && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-profit">
                <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
                {t("challenge_balance_live")}
              </span>
            )}
          </div>
          <p className="text-lg font-bold text-foreground">{money(balance, cur)}</p>
          {/* Equity : seulement position ouverte, sinon elle vaut le solde et
              afficher deux fois le même chiffre n'apprend rien. */}
          {stats.equity !== null ? (
            <p className="text-xs mt-0.5">
              <span className={stats.equity >= balance ? "text-profit" : "text-loss"}>
                {t("challenge_equity")} {money(stats.equity, cur)}
              </span>
              <span className="text-muted">
                {" · "}
                {stats.openPositions} {stats.openPositions > 1 ? t("challenge_open_positions") : t("challenge_open_position")}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5">
              {stats.fromBroker ? t("challenge_from_broker") : t("challenge_from_trades")}
            </p>
          )}
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_total_pnl")}</p>
          {hasNoTrades ? (
            <p className="text-sm text-muted italic mt-1">{t("challenge_no_trades")}</p>
          ) : (
            <p className={`text-lg font-bold ${currentPnl >= 0 ? "text-profit" : "text-loss"}`}>
              {money(currentPnl, cur, { digits: 2, signed: true })}
            </p>
          )}
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_today_pnl")}</p>
          <p className={`text-lg font-bold ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {money(todayPnl, cur, { digits: 2, signed: true })}
          </p>
        </div>
        {isProp && (
          <div className="bg-background rounded-lg p-3">
            <p className="text-xs text-muted">{t("challenge_days")}</p>
            <p className="text-lg font-bold text-foreground">
              {daysElapsed}j
              {daysRemaining !== null && (
                <span className="text-muted text-sm font-normal"> / {daysRemaining} {t("challenge_days_remaining")}</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons — prop only */}
      {isProp && (
        <div className="flex gap-3 mt-6">
          <button onClick={() => onStatusChange(ac.id, "passed")} className="flex-1 py-2 bg-profit/10 border border-profit/20 text-profit rounded-lg text-sm font-medium hover:bg-profit/20 transition-colors">
            {t("challenge_passed")}
          </button>
          <button onClick={() => onStatusChange(ac.id, "failed")} className="flex-1 py-2 bg-loss/10 border border-loss/20 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors">
            {t("challenge_failed")}
          </button>
        </div>
      )}

      {/* Edit / Delete / Export buttons */}
      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={() => setShowEdit(true)} className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 15H9v-2z" />
          </svg>
          {t("challenge_edit_btn")}
        </button>
        <button onClick={onExportPdf} className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t("challenge_export_pdf")}
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-loss/10 border border-loss/20 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {t("challenge_delete_account_btn")}
        </button>
      </div>

      {/* Projection (prop challenges) */}
      {projection && !hasNoTrades && <ChallengeProjectionBlock projection={projection} currency={cur} />}

      {/* Equity curve */}
      <div className="mt-6">
        <EquityCurve data={stats.equityCurveData} initialBalance={stats.curveBaseline} />
      </div>
    </div>
  );
}

/** Même principe que DeleteAccountModal : l'échec s'affiche dans la modale. */
function DeleteModal({
  onConfirm,
  onCancel,
  t,
}: {
  /** Renvoie null si la suppression a eu lieu, sinon le message à afficher. */
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-foreground text-sm leading-relaxed">{t("challenge_delete_history_confirm")}</p>
        {error && (
          <p className="text-loss text-sm leading-relaxed mt-3 border-t border-border pt-3">{error}</p>
        )}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
          >
            {t("csv_cancel")}
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 py-2 bg-loss/10 border border-loss/20 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
          >
            {busy ? t("challenge_deleting") : t("challenge_delete_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChallengePage() {
  const { t, lang } = useLanguage();
  const { maxAccounts, demoMode } = usePlan();
  const supabase = createClient();
  const { selectedAccountId, setSelectedAccountId } = useActiveAccount();

  // Form state
  const [accountType, setAccountType] = useState<"prop" | "personal">("prop");
  const firmList = accountType === "prop" ? PROP_FIRMS : BROKERS;
  const [firm, setFirm] = useState(PROP_FIRMS[0]);
  const [customFirm, setCustomFirm] = useState("");
  const effectiveFirm = firm === CUSTOM_VALUE ? customFirm.trim() : firm;
  const [accountNumber, setAccountNumber] = useState("");
  const [accountSize, setAccountSize] = useState("50000");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [profitTarget, setProfitTarget] = useState("8");
  const [maxDailyDd, setMaxDailyDd] = useState("5");
  const [maxTotalDd, setMaxTotalDd] = useState("10");
  const [trailingDrawdown, setTrailingDrawdown] = useState(false);
  const [marketType, setMarketType] = useState<"cfd" | "futures">("cfd");
  const [maxDailyLoss, setMaxDailyLoss] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formErrors, setFormErrors] = useState<{ accountNumber?: boolean; accountSize?: boolean; startDate?: boolean }>({});

  // Data state
  const [activeAccounts, setActiveAccounts] = useState<Challenge[]>([]);
  const [accountStatsMap, setAccountStatsMap] = useState<Record<string, AccountStats>>({});
  const [history, setHistory] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [tooltipId, setTooltipId] = useState<string | null>(null);

  const isFormValid = accountNumber.trim() !== "" && accountSize !== "" && parseFloat(accountSize) > 0 && startDate !== "" && effectiveFirm !== "";

  // `silent` : rafraîchissement de fond (suivi en direct), sans squelette de
  // chargement qui ferait clignoter la page toutes les minutes.
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Load all active accounts
    const { data: actives } = await supabase
      .from("prop_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setActiveAccounts(actives || []);

    // Load history (passed/failed)
    const { data: past } = await supabase
      .from("prop_challenges")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["passed", "failed"])
      .order("created_at", { ascending: false });

    setHistory(past || []);

    // Calculate stats for each active account
    const statsMap: Record<string, AccountStats> = {};
    const today = new Date().toISOString().split("T")[0];

    for (const ac of actives || []) {
      const [{ data: challengeTrades }, { data: todayTrades }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, pnl, commission, swap")
          .eq("user_id", user.id)
          .eq("challenge_id", ac.id)
          .order("open_time", { ascending: true }),
        supabase
          .from("trades")
          .select("pnl, commission, swap")
          .eq("user_id", user.id)
          .eq("challenge_id", ac.id)
          .gte("open_time", today),
      ]);

      const netOf = (t: { pnl: number | null; commission: number | null; swap: number | null }) =>
        (t.pnl || 0) + (t.commission || 0) + (t.swap || 0);

      const totalPnl = (challengeTrades || []).reduce((sum, t) => sum + netOf(t), 0);

      // Solde réel du broker quand l'EA l'a poussé, reconstitution sinon.
      // Voir lib/challenge-balance.ts pour la règle exacte.
      const resolved = resolveAccountBalance(ac, totalPnl);
      const newBalance = resolved.balance;

      // Update balance in Supabase if changed
      if (Math.abs(newBalance - ac.balance) > 0.01) {
        await supabase.from("prop_challenges").update({ balance: newBalance }).eq("id", ac.id);
      }

      // Courbe décalée pour finir exactement sur le solde affiché : les écarts
      // (donc le drawdown) sont préservés, seul le niveau est recalé.
      let running = ac.account_size + resolved.curveOffset;
      const eqData = (challengeTrades || []).map((t) => {
        running += netOf(t);
        return {
          date: t.open_time ? new Date(t.open_time).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—",
          balance: Math.round(running * 100) / 100,
        };
      });

      const todayTotal = (todayTrades || []).reduce(
        (sum, t) => sum + (t.pnl || 0) + (t.commission || 0) + (t.swap || 0), 0
      );

      const allTrades = challengeTrades || [];
      const tradePnls = allTrades.map(netOf);
      const wins = tradePnls.filter((p) => p > 0).length;
      statsMap[ac.id] = {
        balance: newBalance,
        currentPnl: totalPnl,
        todayPnl: todayTotal,
        equityCurveData: eqData,
        tradePnls,
        tradeCount: allTrades.length,
        winrate: allTrades.length > 0 ? (wins / allTrades.length) * 100 : 0,
        fromBroker: resolved.fromBroker,
        live: resolved.live,
        equity: resolved.equity,
        openPositions: resolved.openPositions,
        curveBaseline: ac.account_size + resolved.curveOffset,
      };
    }

    setAccountStatsMap(statsMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Suivi en direct : dès qu'un compte reçoit l'état poussé par un EA, on se
  // cale sur son rythme (60 s) pour voir l'equity bouger position ouverte.
  // Onglet en arrière-plan = aucune requête, et retour au premier plan =
  // rafraîchissement immédiat plutôt qu'un chiffre périmé.
  const hasSyncedAccount = Object.values(accountStatsMap).some((s) => s.fromBroker);
  useEffect(() => {
    if (!hasSyncedAccount) return;
    const tick = () => {
      if (document.visibilityState === "visible") loadData(true);
    };
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [hasSyncedAccount, loadData]);

  async function handleCreate() {
    setMessage(null);

    const errors: { accountNumber?: boolean; accountSize?: boolean; startDate?: boolean } = {};
    if (!accountNumber.trim()) errors.accountNumber = true;
    if (!accountSize || parseFloat(accountSize) <= 0) errors.accountSize = true;
    if (!startDate) errors.startDate = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage({ type: "error", text: t("not_connected") }); setSaving(false); return; }

    const size = parseFloat(accountSize) || 50000;
    const { error } = await supabase.from("prop_challenges").insert({
      user_id: user.id,
      type: accountType,
      firm: effectiveFirm,
      account_number: accountNumber.trim(),
      account_size: size,
      currency,
      profit_target_pct: accountType === "prop" ? (parseFloat(profitTarget) || 8) : 0,
      max_daily_dd_pct: accountType === "prop" ? (parseFloat(maxDailyDd) || 5) : 0,
      max_total_dd_pct: accountType === "prop" ? (parseFloat(maxTotalDd) || 10) : 0,
      trailing_drawdown: accountType === "prop" ? trailingDrawdown : false,
      market_type: marketType,
      max_daily_loss_pct: maxDailyLoss.trim() ? parseFloat(maxDailyLoss) : null,
      start_date: startDate || new Date().toISOString().split("T")[0],
      end_date: accountType === "prop" ? (endDate || null) : null,
      balance: size,
      status: "active",
    });

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: t("challenge_created") });
      setAccountNumber("");
      setStartDate("");
      loadData();
    }
  }

  async function handleStatusChange(challengeId: string, status: "passed" | "failed") {
    const confirmMsg = status === "passed" ? t("challenge_confirm_passed") : t("challenge_confirm_failed");
    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from("prop_challenges").update({ status }).eq("id", challengeId);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: status === "passed" ? t("challenge_marked_passed") : t("challenge_marked_failed") });
      loadData();
    }
  }

  async function handleEdit(challengeId: string, data: Partial<Challenge>) {
    const { error } = await supabase.from("prop_challenges").update(data).eq("id", challengeId);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: t("challenge_edit_success") });
      loadData();
    }
  }

  /**
   * La cle etrangere trades.challenge_id est en RESTRICT : un compte qui porte
   * des trades ne peut pas etre supprime. Sans traduction, l'utilisateur recoit
   * le message brut de Postgres, en anglais et incomprehensible.
   */
  function deleteErrorMessage(message: string): string {
    return /trades_challenge_id_fkey|foreign key constraint/i.test(message)
      ? t("challenge_delete_has_trades")
      : message;
  }

  /**
   * Supprime un compte ET ses trades, comme la modale le promet. Renvoie null
   * si tout est parti, sinon le message a montrer a l'utilisateur.
   *
   * Le detour par le detachement n'est pas decoratif. La FK trades.challenge_id
   * est en RESTRICT (verifie en base le 2026-08-06 : code 23503), donc
   * supprimer le compte en premier echoue toujours des qu'il porte un trade.
   * Supprimer les trades en premier marcherait, mais si le compte resistait
   * ensuite, l'utilisateur aurait perdu son historique pour rien, sans recours.
   *
   * D'ou l'ordre : on detache, on supprime le compte, et ce n'est qu'une fois
   * le compte reellement parti qu'on supprime les trades. Si le compte resiste,
   * on rerattache et rien n'est perdu.
   *
   * Le `.select()` sur chaque suppression n'est pas non plus decoratif : sans
   * policy RLS DELETE, PostgREST ne renvoie aucune erreur, il supprime zero
   * ligne. Compter les lignes rendues est le seul moyen de distinguer « c'est
   * fait » de « le serveur a refuse en silence » (cf. la migration
   * 20260730_prop_challenges_delete_policy.sql, ecrite pour ce meme piege).
   */
  async function deleteAccountCascade(challengeId: string): Promise<string | null> {
    // Les identifiants sont lus AVANT d'y toucher, et par pages.
    //
    // La version precedente detachait d'abord et se servait des lignes rendues
    // par le `.update()` comme liste de travail. Piege : l'UPDATE modifie bien
    // toutes les lignes cote serveur, mais PostgREST n'en RETOURNE que 1 000
    // (voir lib/supabase-paginate.ts). Sur un compte de 1 500 trades, 500
    // seraient partis en orphelins, ni rattaches ni supprimes, sans un mot. Et
    // une fois detaches, plus rien ne permettait de les retrouver.
    const attached = await fetchAllRows<{ id: string }>((from, to) =>
      supabase
        .from("trades")
        .select("id")
        .eq("challenge_id", challengeId)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (attached === null) return t("challenge_delete_refused");
    const tradeIds = attached.map((row) => row.id);

    for (const part of chunk(tradeIds, ID_CHUNK)) {
      const { error: detachError } = await supabase
        .from("trades")
        .update({ challenge_id: null })
        .in("id", part);
      if (detachError) return deleteErrorMessage(detachError.message);
    }

    const { data: deleted, error } = await supabase
      .from("prop_challenges")
      .delete()
      .eq("id", challengeId)
      .select("id");

    const accountGone = !error && (deleted?.length ?? 0) > 0;

    if (!accountGone) {
      // Marche arriere : les trades retrouvent leur compte, l'utilisateur n'a
      // rien perdu et peut reessayer.
      for (const part of chunk(tradeIds, ID_CHUNK)) {
        const { error: retourError } = await supabase.from("trades").update({ challenge_id: challengeId }).in("id", part);
        // Si la marche arriere elle-meme echoue, les trades restent detaches.
        // On ne peut plus rien faire ici, mais ca doit laisser une trace.
        if (retourError) console.error("[compte] rattachement de secours refuse :", retourError.message);
      }
      return error ? deleteErrorMessage(error.message) : t("challenge_delete_refused");
    }

    // Le compte est parti. Ses trades doivent partir avec.
    //
    // Sans lire `error`, cette boucle pouvait echouer en entier et la fonction
    // rendait quand meme `null`, c'est-a-dire « tout s'est bien passe » : les
    // trades restaient en base, detaches de tout compte, invisibles a l'ecran
    // et comptes dans les statistiques globales. Des orphelins que personne
    // n'aurait pu retrouver, puisque le lien vers le compte venait d'etre
    // efface.
    for (const part of chunk(tradeIds, ID_CHUNK)) {
      const { error: purgeError } = await supabase.from("trades").delete().in("id", part);
      if (purgeError) {
        console.error("[compte] trades du compte supprime non purges :", purgeError.message);
        return deleteErrorMessage(purgeError.message);
      }
    }
    return null;
  }

  async function handleDeleteAccount(challengeId: string): Promise<string | null> {
    const error = await deleteAccountCascade(challengeId);
    if (error) return error;

    setMessage({ type: "success", text: t("challenge_delete_success") });
    loadData();
    return null;
  }

  async function handleDeleteHistory(id: string): Promise<string | null> {
    const error = await deleteAccountCascade(id);
    if (error) return error;

    setDeleteModal({ open: false, id: null });
    setHistory((prev) => prev.filter((c) => c.id !== id));
    setMessage({ type: "success", text: t("challenge_delete_success") });
    return null;
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("challenge_title")}</h1>
        <p className="text-muted mt-2 text-sm">{t("challenge_loading_sub")}</p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-7 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Portfolio aggregate across all active accounts (for the overview panel).
  //
  // Les montants sont ventilés par devise : un compte en euros et un compte en
  // dollars ne s'additionnent pas, et afficher un total unique donnerait un
  // chiffre faux quel que soit le symbole choisi. Le nombre de trades et le
  // winrate, eux, restent agrégeables.
  const portfolio = activeAccounts.reduce(
    (acc, ac) => {
      const s = accountStatsMap[ac.id];
      if (s) {
        const cur = accountCurrency(ac);
        const bucket = acc.byCurrency.get(cur) ?? { capital: 0, pnl: 0 };
        bucket.capital += s.balance || 0;
        bucket.pnl += s.currentPnl || 0;
        acc.byCurrency.set(cur, bucket);
        acc.trades += s.tradeCount || 0;
        acc.weightedWr += (s.winrate || 0) * (s.tradeCount || 0);
      }
      return acc;
    },
    { byCurrency: new Map<string, { capital: number; pnl: number }>(), trades: 0, weightedWr: 0 }
  );
  const portfolioByCurrency = Array.from(portfolio.byCurrency.entries()).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  const portfolioWinrate = portfolio.trades > 0 ? portfolio.weightedWr / portfolio.trades : 0;
  const hasAccounts = activeAccounts.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">{t("challenge_title")}</h1>
      <p className="text-muted mt-1">{t("challenge_subtitle")}</p>

      <div className={hasAccounts ? "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start mt-2" : ""}>
        <div className="min-w-0">

      {/* ACTIVE ACCOUNTS */}
      {activeAccounts.length > 0 && (
        <div className="mt-8 space-y-6">
          {activeAccounts.map((ac) => {
            const s = accountStatsMap[ac.id] || { balance: ac.balance, currentPnl: 0, todayPnl: 0, equityCurveData: [], tradePnls: [], tradeCount: 0, winrate: 0, fromBroker: false, live: false, equity: null, openPositions: 0, curveBaseline: ac.account_size };
            return (
              <AccountCard
                key={ac.id}
                ac={ac}
                stats={s}
                isSelected={ac.id === selectedAccountId}
                onSelect={() => setSelectedAccountId(ac.id)}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onDelete={handleDeleteAccount}
                onExportPdf={() => {
                  setDemoWatermark(demoMode ? t("demo_pdf_watermark") : null);
                  import("@/lib/export-pdf").then(({ exportAccountPdf }) => {
                    exportAccountPdf({
                      firm: ac.firm,
                      accountNumber: ac.account_number,
                      accountSize: ac.account_size,
                      balance: s.balance,
                      totalPnl: s.currentPnl,
                      todayPnl: s.todayPnl,
                      startDate: ac.start_date,
                      tradeCount: s.tradeCount,
                      winrate: s.winrate,
                      tradePnls: s.tradePnls,
                      equityCurve: s.equityCurveData,
                      type: ac.type ?? "prop",
                      profitTargetPct: ac.profit_target_pct,
                      maxDailyDdPct: ac.max_daily_dd_pct,
                      maxTotalDdPct: ac.max_total_dd_pct,
                      currency: accountCurrency(ac),
                      lang,
                    });
                  });
                }}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* CREATE NEW */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          {activeAccounts.length > 0 ? t("challenge_create_new") : t("challenge_create")}
        </h2>
        <div className="h-px bg-border mt-2 mb-4" />

        {maxAccounts !== null && activeAccounts.length >= maxAccounts && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 mb-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm text-foreground">{t("plan_max_accounts_reached")}</p>
            <a href="/dashboard/upgrade" className="ml-auto text-sm text-accent font-medium hover:underline shrink-0">{t("plan_upgrade_btn")}</a>
          </div>
        )}

        <div className="space-y-4" style={maxAccounts !== null && activeAccounts.length >= maxAccounts ? { opacity: 0.4, pointerEvents: "none" as const } : {}}>
          {/* Account type selector */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("challenge_account_type")}</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setAccountType("prop"); setFirm(PROP_FIRMS[0]); setCustomFirm(""); }}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === "prop" ? "bg-accent/10 border-accent text-accent" : "bg-surface border-border text-muted hover:text-foreground"}`}>
                {t("challenge_type_prop")}
              </button>
              <button type="button" onClick={() => { setAccountType("personal"); setFirm(BROKERS[0]); setCustomFirm(""); }}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === "personal" ? "bg-accent/10 border-accent text-accent" : "bg-surface border-border text-muted hover:text-foreground"}`}>
                {t("challenge_type_personal")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{accountType === "prop" ? t("challenge_label_prop_firm") : t("challenge_label_broker")}</label>
              <select
                value={firm}
                onChange={(e) => { setFirm(e.target.value); setCustomFirm(""); }}
                className={inputClass}
              >
                {firmList.map((f) => (<option key={f} value={f}>{f}</option>))}
                <option value={CUSTOM_VALUE}>— {accountType === "prop" ? "Autre prop firm" : "Autre broker"}</option>
              </select>
              {firm === CUSTOM_VALUE && (
                <input
                  type="text"
                  value={customFirm}
                  onChange={(e) => setCustomFirm(e.target.value)}
                  placeholder={accountType === "prop" ? "Nom de la prop firm" : "Nom du broker"}
                  className={`${inputClass} mt-2`}
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("challenge_account_number")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value); if (formErrors.accountNumber) setFormErrors((p) => ({ ...p, accountNumber: false })); }}
                placeholder={t("challenge_account_number_placeholder")}
                className={formErrors.accountNumber ? inputErrorClass : inputClass}
              />
              {formErrors.accountNumber && (
                <p className="text-red-500 text-xs mt-1">{t("challenge_field_required")}</p>
              )}
            </div>
            <div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">
                    {t("challenge_account_size")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={accountSize}
                    onChange={(e) => { setAccountSize(e.target.value); if (formErrors.accountSize) setFormErrors((p) => ({ ...p, accountSize: false })); }}
                    placeholder="50000"
                    className={formErrors.accountSize ? inputErrorClass : inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_currency")}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputClass}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted mt-1">{t("challenge_account_size_hint")}</p>
              {formErrors.accountSize && (
                <p className="text-red-500 text-xs mt-1">{t("challenge_field_required")}</p>
              )}
            </div>
          </div>

          {/* Market type */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("challenge_market_type")}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMarketType("cfd")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${marketType === "cfd" ? "bg-accent text-on-accent border-accent" : "border-border text-muted hover:border-accent/50"}`}
              >
                {t("challenge_market_cfd")}
              </button>
              <button
                type="button"
                onClick={() => setMarketType("futures")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${marketType === "futures" ? "bg-accent text-on-accent border-accent" : "border-border text-muted hover:border-accent/50"}`}
              >
                {t("challenge_market_futures")}
              </button>
            </div>
          </div>

          {/* Prop firm specific fields */}
          {accountType === "prop" && (
            <>
              <div>
                <label className="block text-sm text-muted mb-2">{t("challenge_templates")}</label>
                <div className="flex flex-wrap gap-2">
                  {PROP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setFirm(tpl.name);
                        setCustomFirm("");
                        setProfitTarget(String(tpl.profit));
                        setMaxDailyDd(String(tpl.daily));
                        setMaxTotalDd(String(tpl.total));
                        setTrailingDrawdown(tpl.trailing);
                        setMarketType(tpl.market);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:border-accent/50 hover:text-foreground transition-colors"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1">{t("challenge_templates_help")}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_profit_target_pct")}</label>
                  <input type="number" step="0.1" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_daily_dd_pct")}</label>
                  <input type="number" step="0.1" value={maxDailyDd} onChange={(e) => setMaxDailyDd(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_total_dd_pct")}</label>
                  <input type="number" step="0.1" value={maxTotalDd} onChange={(e) => setMaxTotalDd(e.target.value)} className={inputClass} />
                </div>
              </div>
              <TrailingDdToggle value={trailingDrawdown} onChange={setTrailingDrawdown} t={t} />
              {/* Discipline limit — personal stop-trading rule, optional */}
              <div>
                <label className="block text-sm text-muted mb-1">{t("challenge_max_daily_loss_pct")}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(e.target.value)}
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
                <p className="text-xs text-muted mt-1">{t("challenge_max_daily_loss_pct_help")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">
                    {t("challenge_start_date")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); if (formErrors.startDate) setFormErrors((p) => ({ ...p, startDate: false })); }}
                    className={formErrors.startDate ? inputErrorClass : inputClass}
                  />
                  {formErrors.startDate && (
                    <p className="text-red-500 text-xs mt-1">{t("challenge_field_required")}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t("challenge_end_date")}</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            </>
          )}

          {/* Personal account: just start date */}
          {accountType === "personal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">
                  {t("challenge_start_date")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); if (formErrors.startDate) setFormErrors((p) => ({ ...p, startDate: false })); }}
                  className={formErrors.startDate ? inputErrorClass : inputClass}
                />
                {formErrors.startDate && (
                  <p className="text-red-500 text-xs mt-1">{t("challenge_field_required")}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {message && (
          <p className={`text-sm mt-3 ${message.type === "success" ? "text-profit" : "text-loss"}`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={saving || !isFormValid}
          className={`mt-4 px-6 py-2.5 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 ${!isFormValid ? "cursor-not-allowed" : ""}`}
        >
          {saving ? t("challenge_creating") : t("challenge_create_btn")}
        </button>
      </section>

      {/* HISTORY */}
      <section className="mt-10 mb-8">
        <h2 className="text-lg font-semibold text-foreground">{t("challenge_history")}</h2>
        <div className="h-px bg-border mt-2 mb-4" />

        {history.length === 0 ? (
          <p className="text-muted text-sm">{t("challenge_no_history")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((c) => {
              const pnl = c.balance - c.account_size;
              const showPnlTooltip = c.status === "passed" && pnl < 0;
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between relative">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">
                        {c.firm} · {money(c.account_size, accountCurrency(c))}
                      </span>
                      {c.account_number && (
                        <span className="text-muted text-xs">#{c.account_number}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === "passed" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                        {c.status === "passed" ? t("challenge_status_passed") : t("challenge_status_failed")}
                      </span>
                      {showPnlTooltip && (
                        <span className="relative inline-block">
                          <button
                            className="text-muted hover:text-foreground transition-colors"
                            onMouseEnter={() => setTooltipId(c.id)}
                            onMouseLeave={() => setTooltipId(null)}
                            aria-label="Info"
                          >
                            ℹ️
                          </button>
                          {tooltipId === c.id && (
                            <span className="absolute left-0 top-6 z-20 w-64 bg-card border border-border rounded-lg p-3 text-xs text-muted shadow-xl">
                              {t("challenge_pnl_negative_tooltip")}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-sm mt-1">
                      {new Date(c.start_date).toLocaleDateString("fr-FR")}
                      {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {money(pnl, accountCurrency(c), { signed: true })}
                      </p>
                      <p className="text-muted text-sm">
                        {t("challenge_final_balance")} {money(c.balance, accountCurrency(c))}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteModal({ open: true, id: c.id })}
                      className="text-muted hover:text-loss transition-colors p-1 rounded"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

        </div>{/* end left column */}

        {/* Right column — portfolio overview across all active accounts */}
        {hasAccounts && (
          <aside className="mt-8 lg:mt-0 lg:sticky lg:top-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("challenge_portfolio_title")}</h3>
              <div className="space-y-3">
                <div className="rounded-lg bg-surface border border-border p-3">
                  <p className="text-[11px] text-muted uppercase tracking-wider">{t("challenge_portfolio_capital")}</p>
                  {portfolioByCurrency.map(([curCode, sums]) => (
                    <p key={curCode} className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                      {money(sums.capital, curCode)}
                    </p>
                  ))}
                </div>
                <div className="rounded-lg bg-surface border border-border p-3">
                  <p className="text-[11px] text-muted uppercase tracking-wider">{t("challenge_portfolio_pnl")}</p>
                  {portfolioByCurrency.map(([curCode, sums]) => (
                    <p
                      key={curCode}
                      className={`text-xl font-bold tabular-nums mt-0.5 ${sums.pnl >= 0 ? "text-profit" : "text-loss"}`}
                    >
                      {money(sums.pnl, curCode, { signed: true })}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-surface border border-border p-3">
                    <p className="text-[11px] text-muted uppercase tracking-wider">{t("challenge_portfolio_accounts")}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{activeAccounts.length}</p>
                  </div>
                  <div className="rounded-lg bg-surface border border-border p-3">
                    <p className="text-[11px] text-muted uppercase tracking-wider">{t("trades_winrate")}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                      {portfolio.trades > 0 ? `${portfolioWinrate.toFixed(0)}%` : "—"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-surface border border-border p-3">
                  <p className="text-[11px] text-muted uppercase tracking-wider">{t("trades_total")}</p>
                  <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{portfolio.trades}</p>
                </div>
              </div>
            </div>

            {/* Comparatif par compte — classé par P&L, clic = sélectionner */}
            {activeAccounts.length > 1 && (
              <div className="bg-card border border-border rounded-xl p-4 mt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t("challenge_compare_title")}</h3>
                <div className="space-y-1.5">
                  {[...activeAccounts]
                    .sort((a, b) => (accountStatsMap[b.id]?.currentPnl ?? 0) - (accountStatsMap[a.id]?.currentPnl ?? 0))
                    .map((ac, rank) => {
                      const s = accountStatsMap[ac.id];
                      const pnl = s?.currentPnl ?? 0;
                      const isSelected = ac.id === selectedAccountId;
                      const isBest = rank === 0 && pnl > 0;
                      return (
                        <button
                          key={ac.id}
                          onClick={() => setSelectedAccountId(ac.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "border-accent/40 bg-accent/5"
                              : "border-border bg-surface/40 hover:border-accent/25"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {isBest && <span aria-hidden>🏆 </span>}
                              {ac.firm}
                            </p>
                            <p className="text-[10px] text-muted tabular-nums">
                              {s?.tradeCount ?? 0} trades
                              {s && s.tradeCount > 0 ? ` · WR ${s.winrate.toFixed(0)}%` : ""}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold tabular-nums shrink-0 ${
                              pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted"
                            }`}
                          >
                            {money(pnl, accountCurrency(ac), { signed: true })}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>{/* end 2-col grid */}

      {/* DELETE MODAL */}
      {deleteModal.open && deleteModal.id && (
        <DeleteModal
          onConfirm={() => handleDeleteHistory(deleteModal.id!)}
          onCancel={() => setDeleteModal({ open: false, id: null })}
          t={t}
        />
      )}
    </div>
  );
}
