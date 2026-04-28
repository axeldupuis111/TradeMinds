"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
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
  start_date: string;
  end_date: string | null;
  balance: number;
  status: "active" | "passed" | "failed";
  created_at: string;
}

interface AccountStats {
  balance: number;
  currentPnl: number;
  todayPnl: number;
  equityCurveData: { date: string; balance: number }[];
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

function ProgressBar({
  value,
  max,
  color,
  label,
  alert,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
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
          {value.toFixed(0)}€ / {max.toFixed(0)}€ — {pct.toFixed(1)}%
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

function RenameModal({
  currentName,
  onConfirm,
  onCancel,
  t,
}: {
  currentName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [name, setName] = useState(currentName);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-foreground font-semibold mb-4">{t("challenge_rename_title")}</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent mb-4"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); }}
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors">
            {t("csv_cancel")}
          </button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            {t("challenge_rename_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  ac,
  stats,
  onStatusChange,
  onRename,
  t,
}: {
  ac: Challenge;
  stats: AccountStats;
  onStatusChange: (id: string, status: "passed" | "failed") => void;
  onRename: (id: string, name: string) => void;
  t: (key: string) => string;
}) {
  const [showRename, setShowRename] = useState(false);
  const balance = stats.balance;
  const currentPnl = stats.currentPnl;
  const todayPnl = stats.todayPnl;
  const hasNoTrades = stats.equityCurveData.length === 0;
  const profitTargetAmount = ac.account_size * (ac.profit_target_pct / 100);
  const maxTotalDdAmount = ac.account_size * (ac.max_total_dd_pct / 100);
  const maxDailyDdAmount = ac.account_size * (ac.max_daily_dd_pct / 100);
  const totalDdUsed = Math.max(0, ac.account_size - balance);
  const dailyDdUsed = Math.max(0, -todayPnl);
  const isProp = (ac.type ?? "prop") === "prop";

  const daysElapsed = Math.floor(
    (Date.now() - new Date(ac.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = ac.end_date
    ? Math.max(0, Math.floor((new Date(ac.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {showRename && (
        <RenameModal
          currentName={ac.firm}
          onConfirm={(name) => { onRename(ac.id, name); setShowRename(false); }}
          onCancel={() => setShowRename(false)}
          t={t}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {ac.firm} — {ac.account_size.toLocaleString()}€
            </h2>
            <button
              onClick={() => setShowRename(true)}
              className="text-muted hover:text-foreground transition-colors"
              title={t("challenge_rename_title")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 15H9v-2z" />
              </svg>
            </button>
          </div>
          <p className="text-muted text-sm">
            {ac.account_number && <span className="text-foreground">#{ac.account_number} · </span>}
            {t("challenge_started")} {new Date(ac.start_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
            {isProp ? t("challenge_type_prop") : t("challenge_type_personal")}
          </span>
          <StatusBadge status={ac.status} t={t} />
        </div>
      </div>

      {/* Progress bars — only for prop firm */}
      {isProp && (
        <div className="space-y-4">
          <ProgressBar value={Math.max(0, currentPnl)} max={profitTargetAmount} color="bg-profit" label={t("challenge_profit_target")} />
          <ProgressBar value={totalDdUsed} max={maxTotalDdAmount} color="bg-loss" label={t("challenge_total_dd")} alert />
          <ProgressBar value={dailyDdUsed} max={maxDailyDdAmount} color="bg-loss" label={t("challenge_daily_dd")} alert />
        </div>
      )}

      {/* Stats grid */}
      <div className={`grid grid-cols-2 ${isProp ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3 mt-6`}>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_balance")}</p>
          <p className="text-lg font-bold text-foreground">
            {balance.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€
          </p>
          <p className="text-xs text-muted mt-0.5">{t("challenge_from_trades")}</p>
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_total_pnl")}</p>
          {hasNoTrades ? (
            <p className="text-sm text-muted italic mt-1">{t("challenge_no_trades")}</p>
          ) : (
            <p className={`text-lg font-bold ${currentPnl >= 0 ? "text-profit" : "text-loss"}`}>
              {currentPnl >= 0 ? "+" : ""}{currentPnl.toFixed(2)}€
            </p>
          )}
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_today_pnl")}</p>
          <p className={`text-lg font-bold ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)}€
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

      {/* Equity curve */}
      <div className="mt-6">
        <EquityCurve data={stats.equityCurveData} initialBalance={ac.account_size} />
      </div>
    </div>
  );
}

function DeleteModal({
  onConfirm,
  onCancel,
  t,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-foreground text-sm leading-relaxed">{t("challenge_delete_history_confirm")}</p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors"
          >
            {t("csv_cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-loss/10 border border-loss/20 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors"
          >
            {t("challenge_delete_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChallengePage() {
  const { t } = useLanguage();
  const { maxAccounts } = usePlan();
  const supabase = createClient();

  // Form state
  const [accountType, setAccountType] = useState<"prop" | "personal">("prop");
  const firmList = accountType === "prop" ? PROP_FIRMS : BROKERS;
  const [firm, setFirm] = useState(PROP_FIRMS[0]);
  const [customFirm, setCustomFirm] = useState("");
  const effectiveFirm = firm === CUSTOM_VALUE ? customFirm.trim() : firm;
  const [accountNumber, setAccountNumber] = useState("");
  const [accountSize, setAccountSize] = useState("50000");
  const [profitTarget, setProfitTarget] = useState("8");
  const [maxDailyDd, setMaxDailyDd] = useState("5");
  const [maxTotalDd, setMaxTotalDd] = useState("10");
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

  const loadData = useCallback(async () => {
    setLoading(true);
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

      const totalPnl = (challengeTrades || []).reduce(
        (sum, t) => sum + (t.pnl || 0) + (t.commission || 0) + (t.swap || 0), 0
      );
      const newBalance = ac.account_size + totalPnl;

      // Update balance in Supabase if changed
      if (Math.abs(newBalance - ac.balance) > 0.01) {
        await supabase.from("prop_challenges").update({ balance: newBalance }).eq("id", ac.id);
      }

      let running = ac.account_size;
      const eqData = (challengeTrades || []).map((t) => {
        const net = (t.pnl || 0) + (t.commission || 0) + (t.swap || 0);
        running += net;
        return {
          date: t.open_time ? new Date(t.open_time).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—",
          balance: Math.round(running * 100) / 100,
        };
      });

      const todayTotal = (todayTrades || []).reduce(
        (sum, t) => sum + (t.pnl || 0) + (t.commission || 0) + (t.swap || 0), 0
      );

      statsMap[ac.id] = {
        balance: newBalance,
        currentPnl: totalPnl,
        todayPnl: todayTotal,
        equityCurveData: eqData,
      };
    }

    setAccountStatsMap(statsMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      profit_target_pct: accountType === "prop" ? (parseFloat(profitTarget) || 8) : 0,
      max_daily_dd_pct: accountType === "prop" ? (parseFloat(maxDailyDd) || 5) : 0,
      max_total_dd_pct: accountType === "prop" ? (parseFloat(maxTotalDd) || 10) : 0,
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

  async function handleRename(challengeId: string, name: string) {
    const { error } = await supabase.from("prop_challenges").update({ firm: name }).eq("id", challengeId);
    if (!error) loadData();
  }

  async function handleDeleteHistory(id: string) {
    const { error } = await supabase.from("prop_challenges").delete().eq("id", id);
    setDeleteModal({ open: false, id: null });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setHistory((prev) => prev.filter((c) => c.id !== id));
      setMessage({ type: "success", text: t("challenge_delete_success") });
    }
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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{t("challenge_title")}</h1>
      <p className="text-muted mt-1">{t("challenge_subtitle")}</p>

      {/* ACTIVE ACCOUNTS */}
      {activeAccounts.length > 0 && (
        <div className="mt-8 space-y-6">
          {activeAccounts.map((ac) => (
            <AccountCard
              key={ac.id}
              ac={ac}
              stats={accountStatsMap[ac.id] || { balance: ac.balance, currentPnl: 0, todayPnl: 0, equityCurveData: [] }}
              onStatusChange={handleStatusChange}
              onRename={handleRename}
              t={t}
            />
          ))}
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
              {formErrors.accountSize && (
                <p className="text-red-500 text-xs mt-1">{t("challenge_field_required")}</p>
              )}
            </div>
          </div>

          {/* Prop firm specific fields */}
          {accountType === "prop" && (
            <>
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
          className={`mt-4 px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 ${!isFormValid ? "cursor-not-allowed" : ""}`}
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
                        {c.firm} — {c.account_size.toLocaleString()}€
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
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}€
                      </p>
                      <p className="text-muted text-sm">
                        {t("challenge_final_balance")} {c.balance.toLocaleString()}€
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
