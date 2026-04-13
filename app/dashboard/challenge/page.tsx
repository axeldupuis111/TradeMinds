"use client";

import EquityCurve from "@/components/charts/EquityCurve";
import { useLanguage } from "@/lib/LanguageContext";
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

const PROP_FIRMS = ["FTMO", "The5ers", "FundedNext", "MyFundedFX", "TFT", "MyForexFunds", "Autre"];
const BROKERS = ["IC Markets", "Pepperstone", "XM", "Exness", "OANDA", "Interactive Brokers", "eToro", "XTB", "Admiral Markets", "Vantage", "FP Markets", "Fusion Markets", "Autre"];

const inputClass =
  "w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

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
      <div className="h-3 bg-[#1e1e1e] rounded-full overflow-hidden">
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

function AccountCard({
  ac,
  stats,
  onStatusChange,
  t,
}: {
  ac: Challenge;
  stats: AccountStats;
  onStatusChange: (id: string, status: "passed" | "failed") => void;
  t: (key: string) => string;
}) {
  const balance = stats.balance;
  const currentPnl = stats.currentPnl;
  const todayPnl = stats.todayPnl;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {ac.firm} — {ac.account_size.toLocaleString()}€
          </h2>
          <p className="text-muted text-sm">
            {ac.account_number && <span className="text-foreground">#{ac.account_number} · </span>}
            {t("challenge_started")} {new Date(ac.start_date).toLocaleDateString()}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
          {isProp ? t("challenge_type_prop") : t("challenge_type_personal")}
        </span>
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
        <div className="bg-[#0f0f0f] rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_balance")}</p>
          <p className="text-lg font-bold text-foreground">
            {balance.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€
          </p>
          <p className="text-xs text-muted mt-0.5">{t("challenge_from_trades")}</p>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_total_pnl")}</p>
          <p className={`text-lg font-bold ${currentPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {currentPnl >= 0 ? "+" : ""}{currentPnl.toFixed(2)}€
          </p>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-3">
          <p className="text-xs text-muted">{t("challenge_today_pnl")}</p>
          <p className={`text-lg font-bold ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)}€
          </p>
        </div>
        {isProp && (
          <div className="bg-[#0f0f0f] rounded-lg p-3">
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

      {/* Status buttons */}
      <div className="flex gap-3 mt-6">
        {isProp ? (
          <>
            <button onClick={() => onStatusChange(ac.id, "passed")} className="flex-1 py-2 bg-profit/10 border border-profit/20 text-profit rounded-lg text-sm font-medium hover:bg-profit/20 transition-colors">
              {t("challenge_passed")}
            </button>
            <button onClick={() => onStatusChange(ac.id, "failed")} className="flex-1 py-2 bg-loss/10 border border-loss/20 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors">
              {t("challenge_failed")}
            </button>
          </>
        ) : (
          <button
            onClick={() => onStatusChange(ac.id, "passed")}
            className="flex-1 py-2 bg-white/5 border border-white/10 text-foreground rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
          >
            {t("challenge_closed")}
          </button>
        )}
      </div>

      {/* Equity curve */}
      <div className="mt-6">
        <EquityCurve data={stats.equityCurveData} initialBalance={ac.account_size} />
      </div>
    </div>
  );
}

export default function ChallengePage() {
  const { t } = useLanguage();
  const supabase = createClient();

  // Form state
  const [accountType, setAccountType] = useState<"prop" | "personal">("prop");
  const firmList = accountType === "prop" ? PROP_FIRMS : BROKERS;
  const [firm, setFirm] = useState(PROP_FIRMS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountSize, setAccountSize] = useState("50000");
  const [profitTarget, setProfitTarget] = useState("8");
  const [maxDailyDd, setMaxDailyDd] = useState("5");
  const [maxTotalDd, setMaxTotalDd] = useState("10");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data state
  const [activeAccounts, setActiveAccounts] = useState<Challenge[]>([]);
  const [accountStatsMap, setAccountStatsMap] = useState<Record<string, AccountStats>>({});
  const [history, setHistory] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    if (!accountNumber.trim()) {
      setMessage({ type: "error", text: t("challenge_account_number_required") });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage({ type: "error", text: t("not_connected") }); setSaving(false); return; }

    const size = parseFloat(accountSize) || 50000;
    const { error } = await supabase.from("prop_challenges").insert({
      user_id: user.id,
      type: accountType,
      firm,
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
        <div className="h-px bg-[#1e1e1e] mt-2 mb-4" />

        <div className="space-y-4">
          {/* Account type selector */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("challenge_account_type")}</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setAccountType("prop"); setFirm(PROP_FIRMS[0]); }}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === "prop" ? "bg-accent/10 border-accent text-accent" : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"}`}>
                {t("challenge_type_prop")}
              </button>
              <button type="button" onClick={() => { setAccountType("personal"); setFirm(BROKERS[0]); }}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${accountType === "personal" ? "bg-accent/10 border-accent text-accent" : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"}`}>
                {t("challenge_type_personal")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{accountType === "prop" ? t("challenge_label_prop_firm") : t("challenge_label_broker")}</label>
              <select value={firm} onChange={(e) => setFirm(e.target.value)} className={inputClass}>
                {firmList.map((f) => (<option key={f} value={f}>{f}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_account_number")} *</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={t("challenge_account_number_placeholder")} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("challenge_account_size")}</label>
              <input type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)}
                placeholder="50000" className={inputClass} />
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
                  <label className="block text-sm text-muted mb-1">{t("challenge_start_date")}</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
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
                <label className="block text-sm text-muted mb-1">{t("challenge_start_date")}</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>

        {message && (
          <p className={`text-sm mt-3 ${message.type === "success" ? "text-profit" : "text-loss"}`}>
            {message.text}
          </p>
        )}

        <button onClick={handleCreate} disabled={saving}
          className="mt-4 px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
          {saving ? t("challenge_creating") : t("challenge_create_btn")}
        </button>
      </section>

      {/* HISTORY */}
      <section className="mt-10 mb-8">
        <h2 className="text-lg font-semibold text-foreground">{t("challenge_history")}</h2>
        <div className="h-px bg-[#1e1e1e] mt-2 mb-4" />

        {history.length === 0 ? (
          <p className="text-muted text-sm">{t("challenge_no_history")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((c) => {
              const pnl = c.balance - c.account_size;
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
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
                    </div>
                    <p className="text-muted text-sm mt-1">
                      {new Date(c.start_date).toLocaleDateString("fr-FR")}
                      {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}€
                    </p>
                    <p className="text-muted text-sm">
                      {t("challenge_final_balance")} {c.balance.toLocaleString()}€
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
