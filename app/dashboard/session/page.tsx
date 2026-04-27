"use client";

import DayStatus from "@/components/DayStatus";
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

interface ActiveSession {
  id: string;
  created_at: string;
  emotion_before: string | null;
  checklist_completed: boolean | null;
}

const EMOTIONS = [
  { key: "confident", emoji: "\u{1F60E}", risky: false },
  { key: "neutral", emoji: "\u{1F610}", risky: false },
  { key: "anxious", emoji: "\u{1F630}", risky: true },
  { key: "frustrated", emoji: "\u{1F624}", risky: true },
  { key: "fomo", emoji: "\u{1F911}", risky: true },
  { key: "revenge", emoji: "\u{1F621}", risky: true },
];

export default function SessionPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [newItemText, setNewItemText] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showEmptyChecklistModal, setShowEmptyChecklistModal] = useState(false);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    // Auto-close any session older than today that is still flagged active
    await supabase
      .from("sessions")
      .update({ active: false, ended_at: new Date(today + "T00:00:00").toISOString() })
      .eq("user_id", user.id)
      .eq("active", true)
      .lt("created_at", today);

    const [{ data: strat }, { data: session }] = await Promise.all([
      supabase.from("strategies").select("*").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase
        .from("sessions")
        .select("id, created_at, emotion_before, checklist_completed")
        .eq("user_id", user.id)
        .eq("active", true)
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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

    if (session) setActiveSession(session);

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

  async function handleStartClick() {
    if (!selectedEmotion) return;
    if (checkedItems.size === 0 && checklist.length > 0) {
      setShowEmptyChecklistModal(true);
      return;
    }
    await startSession();
  }

  async function startSession() {
    if (!selectedEmotion) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: inserted } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        emotion_before: selectedEmotion,
        checklist_completed: checkedItems.size === checklist.length,
        active: true,
      })
      .select("id, created_at, emotion_before, checklist_completed")
      .single();

    if (inserted) setActiveSession(inserted);
    setSaving(false);
  }

  async function endSession() {
    if (!activeSession) return;
    setEnding(true);
    await supabase
      .from("sessions")
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq("id", activeSession.id);
    setActiveSession(null);
    setSelectedEmotion(null);
    setCheckedItems(new Set());
    setEnding(false);
  }

  const riskyEmotion = selectedEmotion && EMOTIONS.find((e) => e.key === selectedEmotion)?.risky;
  const allChecked = checklist.length > 0 && checkedItems.size === checklist.length;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  // Active session view
  if (activeSession) {
    const activeEmotion = EMOTIONS.find((e) => e.key === activeSession.emotion_before);
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">{t("session_title")}</h1>
        <p className="text-muted mt-1 mb-6">{t("session_subtitle")}</p>

        <div className="bg-profit/5 border border-profit/30 rounded-xl p-6 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{activeEmotion?.emoji ?? "\u{1F680}"}</div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("session_in_progress")}</h2>
                <p className="text-muted text-sm mt-0.5">
                  {t("day_session_active_since")} {new Date(activeSession.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <button
              onClick={endSession}
              disabled={ending}
              className="px-5 py-2 bg-loss/10 border border-loss/30 text-loss rounded-lg text-sm font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
            >
              {ending ? "..." : t("session_end_button")}
            </button>
          </div>
        </div>

        <div className="mb-5">
          <DayStatus />
        </div>

        <Link href="/dashboard" className="inline-block px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
          {t("session_back_dashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{t("session_title")}</h1>
      <p className="text-muted mt-1 mb-6">{t("session_subtitle")}</p>

      {/* Empty checklist confirmation modal */}
      {showEmptyChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-semibold text-foreground">{t("session_empty_checklist_title")}</h3>
            <p className="text-muted text-sm">{t("session_empty_checklist_body")}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEmptyChecklistModal(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-surface transition-colors"
              >
                {t("session_empty_checklist_cancel")}
              </button>
              <button
                onClick={async () => { setShowEmptyChecklistModal(false); await startSession(); }}
                className="px-4 py-2 text-sm bg-warning/10 border border-warning/30 text-warning rounded-lg hover:bg-warning/20 transition-colors"
              >
                {t("session_empty_checklist_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A — Checklist */}
      <section className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-0.5">{t("session_checklist_title")}</h2>
        <p className="text-xs text-accent mb-1">{t("session_checklist_subtitle")}</p>
        <p className="text-muted text-sm mb-4">{t("session_checklist_desc")}</p>

        {/* Strategy rules reminder */}
        {strategy && strategy.setup_rules && strategy.setup_rules.length > 0 && (
          <div className="mb-4 rounded-lg bg-background border border-border overflow-hidden">
            <button
              onClick={() => setRulesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted font-medium hover:text-foreground transition-colors"
            >
              <span>📋 {rulesOpen ? t("session_hide_rules") : t("session_show_rules")}</span>
              <span>{rulesOpen ? "▲" : "▼"}</span>
            </button>
            {rulesOpen && (
              <ul className="px-3 pb-3 space-y-1">
                {strategy.setup_rules.map((r, i) => (
                  <li key={i} className="text-foreground text-sm">&bull; {r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2">
          {checklist.map((item, idx) => (
            <div key={idx} className={`flex items-start gap-3 group rounded-lg transition-colors ${!checkedItems.has(idx) && !allChecked ? "border border-orange-400/40 px-2 py-1" : "px-2 py-1"}`}>
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
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
          <button
            onClick={addChecklistItem}
            disabled={!newItemText.trim()}
            className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm hover:bg-border transition-colors disabled:opacity-50"
          >
            {t("session_add")}
          </button>
        </div>

        {/* ICT technical checklist link */}
        <div className="mt-4 pt-3 border-t border-border">
          <Link href="/dashboard/trades" className="text-xs text-muted hover:text-accent transition-colors">
            {t("session_ict_link")} →
          </Link>
        </div>
      </section>

      {/* B — State of the day */}
      <div className="mb-5">
        <DayStatus />
      </div>

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
                  ? "border-2 border-blue-500 bg-blue-500/10 scale-110"
                  : "bg-background border-border hover:border-muted"
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
      <div className="flex flex-col items-start gap-2">
        {checklist.length > 0 && (
          <p className={`text-sm font-medium ${allChecked ? "text-profit" : "text-orange-400"}`}>
            {allChecked
              ? t("session_all_ready")
              : (checklist.length - checkedItems.size === 1 ? t("session_item_remaining_one") : t("session_items_remaining")).replace("{N}", String(checklist.length - checkedItems.size))}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={handleStartClick}
            disabled={!selectedEmotion || saving}
            className={`w-full sm:w-auto px-8 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${allChecked ? "bg-accent hover:bg-blue-600" : "bg-accent/80 hover:bg-accent"}`}
          >
            {saving ? "..." : t("session_start_button")}
          </button>
          {!selectedEmotion && (
            <p className="text-xs text-muted">{t("session_select_emotion_first")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
