"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEFAULT_CHECKLIST = [
  "pretrade_default_1",
  "pretrade_default_2",
  "pretrade_default_3",
  "pretrade_default_4",
];

interface Strategy {
  id: string;
  name: string;
  setup_rules: string[];
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  pretrade_checklist: string[] | null;
}

const EMOTIONS = [
  { key: "confident", emoji: "\u{1F60E}", risky: false },
  { key: "neutral", emoji: "\u{1F610}", risky: false },
  { key: "anxious", emoji: "\u{1F630}", risky: true },
  { key: "frustrated", emoji: "\u{1F624}", risky: true },
  { key: "fomo", emoji: "\u{1F911}", risky: true },
  { key: "revenge", emoji: "\u{1F621}", risky: true },
];

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function SessionPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [newItemText, setNewItemText] = useState("");
  const [todayPnl, setTodayPnl] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [accountSize, setAccountSize] = useState<number>(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [{ data: strat }, { data: trades }, { data: reviews }, { data: accounts }] = await Promise.all([
      supabase.from("strategies").select("*").eq("user_id", user.id).limit(1).single(),
      supabase.from("trades").select("pnl, commission, swap").eq("user_id", user.id).gte("open_time", today),
      supabase.from("session_reviews").select("created_at, analysis").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("prop_challenges").select("account_size").eq("user_id", user.id).eq("status", "active").limit(1).single(),
    ]);

    if (strat) {
      setStrategy(strat);
      const customChecklist = strat.pretrade_checklist && strat.pretrade_checklist.length > 0
        ? strat.pretrade_checklist
        : DEFAULT_CHECKLIST.map((k) => t(k));
      setChecklist(customChecklist);
    } else {
      setChecklist(DEFAULT_CHECKLIST.map((k) => t(k)));
    }

    if (accounts) setAccountSize(accounts.account_size || 0);

    const todaysTrades = trades || [];
    setTodayCount(todaysTrades.length);
    setTodayPnl(todaysTrades.reduce((s, tr) => s + netPnl(tr), 0));

    // Calculate discipline streak
    const reviewList = reviews || [];
    let streakCount = 0;
    const seenDays = new Set<string>();
    for (const r of reviewList) {
      const day = r.created_at.split("T")[0];
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      const violations = (r.analysis as { violations?: unknown[] })?.violations;
      if (!violations || violations.length === 0) streakCount++;
      else break;
    }
    setStreak(streakCount);

    setLoading(false);
  }

  function toggleCheck(idx: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function addChecklistItem() {
    const item = newItemText.trim();
    if (!item) return;
    const newList = [...checklist, item];
    setChecklist(newList);
    setNewItemText("");
    await saveChecklist(newList);
  }

  async function removeChecklistItem(idx: number) {
    const newList = checklist.filter((_, i) => i !== idx);
    setChecklist(newList);
    setCheckedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i !== idx) next.add(i > idx ? i - 1 : i); });
      return next;
    });
    await saveChecklist(newList);
  }

  async function saveChecklist(list: string[]) {
    if (!strategy) return;
    await supabase.from("strategies").update({ pretrade_checklist: list }).eq("id", strategy.id);
  }

  async function startSession() {
    if (!selectedEmotion) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("sessions").insert({
      user_id: user.id,
      emotion_before: selectedEmotion,
      checklist_completed: checkedItems.size === checklist.length,
    });

    setSessionStarted(true);
    setSaving(false);
  }

  const riskyEmotion = selectedEmotion && EMOTIONS.find((e) => e.key === selectedEmotion)?.risky;
  const allChecked = checklist.length > 0 && checkedItems.size === checklist.length;

  const maxDailyLoss = strategy?.max_daily_loss ?? null; // in %
  const maxLossEuro = maxDailyLoss !== null && accountSize > 0 ? (accountSize * maxDailyLoss) / 100 : null;
  const remainingBudget = maxLossEuro !== null ? Math.max(0, maxLossEuro + todayPnl) : null;
  const budgetPct = maxLossEuro !== null && remainingBudget !== null ? (remainingBudget / maxLossEuro) * 100 : 100;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (sessionStarted) {
    return (
      <div className="max-w-2xl">
        <div className="bg-profit/10 border border-profit/30 rounded-xl p-8 text-center">
          <div className="text-5xl mb-3">{"\u{1F680}"}</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("session_started_title")}</h1>
          <p className="text-muted mb-4">{t("session_started_desc")}</p>
          <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
            {t("session_back_dashboard")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{t("session_title")}</h1>
      <p className="text-muted mt-1 mb-6">{t("session_subtitle")}</p>

      {/* A — Checklist */}
      <section className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("session_checklist_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("session_checklist_desc")}</p>

        {/* Strategy rules reminder */}
        {strategy && strategy.setup_rules && strategy.setup_rules.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[#0f0f0f] border border-[#1e1e1e]">
            <p className="text-xs text-muted mb-2 font-medium">{t("session_your_rules")}</p>
            <ul className="space-y-1">
              {strategy.setup_rules.map((r, i) => (
                <li key={i} className="text-foreground text-sm">&bull; {r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 group">
              <input
                type="checkbox"
                checked={checkedItems.has(idx)}
                onChange={() => toggleCheck(idx)}
                className="accent-accent w-5 h-5 mt-0.5 cursor-pointer shrink-0"
              />
              <label className={`flex-1 text-sm cursor-pointer ${checkedItems.has(idx) ? "line-through text-muted" : "text-foreground"}`} onClick={() => toggleCheck(idx)}>
                {item}
              </label>
              <button
                onClick={() => removeChecklistItem(idx)}
                className="text-muted hover:text-loss transition-colors opacity-0 group-hover:opacity-100"
                title={t("session_remove")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add item */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }}
            placeholder={t("session_add_placeholder")}
            className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
          <button
            onClick={addChecklistItem}
            disabled={!newItemText.trim()}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-foreground rounded-lg text-sm hover:bg-border transition-colors disabled:opacity-50"
          >
            {t("session_add")}
          </button>
        </div>
      </section>

      {/* B — State of the day */}
      <section className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("session_state_title")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted">{t("session_today_pnl")}</p>
            <p className={`text-xl font-bold mt-1 ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
              {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)} &euro;
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("session_today_trades")}</p>
            <p className="text-xl font-bold mt-1 text-foreground">
              {todayCount}{strategy?.max_trades_per_day ? ` / ${strategy.max_trades_per_day}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("session_streak")}</p>
            <p className="text-xl font-bold mt-1 text-foreground">
              {streak > 0 ? "\u{1F525}" : "\u{2744}\u{FE0F}"} {streak}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("session_risk_budget")}</p>
            {maxLossEuro !== null && remainingBudget !== null ? (
              <p className={`text-xl font-bold mt-1 ${budgetPct > 50 ? "text-profit" : budgetPct > 20 ? "text-orange-400" : "text-loss"}`}>
                {remainingBudget.toFixed(0)} &euro;
              </p>
            ) : (
              <p className="text-xl font-bold mt-1 text-muted">&mdash;</p>
            )}
          </div>
        </div>

        {/* Risk budget progress bar */}
        {maxLossEuro !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{t("session_budget_label")}</span>
              <span>{budgetPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${budgetPct > 50 ? "bg-profit" : budgetPct > 20 ? "bg-orange-400" : "bg-loss"}`}
                style={{ width: `${Math.min(100, Math.max(0, budgetPct))}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* C — Emotional state */}
      <section className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("session_emotion_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("session_emotion_desc")}</p>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {EMOTIONS.map((em) => (
            <button
              key={em.key}
              onClick={() => setSelectedEmotion(em.key)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                selectedEmotion === em.key
                  ? "bg-accent/10 border-accent"
                  : "bg-[#0f0f0f] border-[#1e1e1e] hover:border-[#2a2a2a]"
              }`}
            >
              <span className="text-2xl">{em.emoji}</span>
              <span className="text-xs text-muted">{t(`emotion_${em.key}`)}</span>
            </button>
          ))}
        </div>

        {riskyEmotion && (
          <div className="mt-4 p-3 rounded-lg bg-loss/10 border border-loss/30 flex items-start gap-3">
            <svg className="w-5 h-5 text-loss shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
            </svg>
            <p className="text-sm text-loss">{t("session_emotion_warning")}</p>
          </div>
        )}
      </section>

      {/* D — Start button */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={startSession}
          disabled={!allChecked || !selectedEmotion || saving}
          className="w-full sm:w-auto px-8 py-3 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {saving ? "..." : t("session_start_button")}
        </button>
        {!allChecked && (
          <p className="text-xs text-muted">{t("session_check_all_first")}</p>
        )}
        {allChecked && !selectedEmotion && (
          <p className="text-xs text-muted">{t("session_select_emotion_first")}</p>
        )}
      </div>
    </div>
  );
}
