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

const DAILY_QUOTES = [
  "Le meilleur trade est souvent celui que tu ne prends pas.",
  "La discipline bat le talent quand le talent manque de discipline.",
  "Un trader rentable ne cherche pas à avoir raison, il cherche à perdre peu.",
  "La patience est la compétence la plus sous-estimée en trading.",
  "Protège ton capital d'abord. Les profits viennent d'eux-mêmes.",
  "Respecter son plan, c'est respecter son futur.",
  "Le marché est là chaque jour. Ta discipline, elle, se construit maintenant.",
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

interface SessionHistory {
  id: string;
  created_at: string;
  emotion_before: string | null;
  checklist_completed: boolean | null;
  ended_at: string | null;
  pnl?: number;
}

const EMOTIONS = [
  { key: "confident", emoji: "\u{1F60E}", risky: false },
  { key: "neutral", emoji: "\u{1F610}", risky: false },
  { key: "anxious", emoji: "\u{1F630}", risky: true },
  { key: "frustrated", emoji: "\u{1F624}", risky: true },
  { key: "fomo", emoji: "\u{1F911}", risky: true },
  { key: "revenge", emoji: "\u{1F621}", risky: true },
];

const dailyQuote = DAILY_QUOTES[new Date().getDay() % DAILY_QUOTES.length];

export default function SessionPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [newItemText, setNewItemText] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const [{ data: strats }, { data: session }, { data: history }, { data: recentTrades }] = await Promise.all([
      supabase.from("strategies").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase
        .from("sessions")
        .select("id, created_at, emotion_before, checklist_completed")
        .eq("user_id", user.id)
        .eq("active", true)
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, created_at, emotion_before, checklist_completed, ended_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("trades")
        .select("pnl, commission, swap, open_time")
        .eq("user_id", user.id)
        .gte("open_time", sevenDaysAgoStr),
    ]);

    const stratList = strats || [];
    setStrategies(stratList);

    const firstStrat = stratList[0] ?? null;
    if (firstStrat) {
      setStrategy(firstStrat);
      const customChecklist = firstStrat.pretrade_checklist && firstStrat.pretrade_checklist.length > 0
        ? firstStrat.pretrade_checklist
        : DEFAULT_CHECKLIST.map((k) => t(k));
      setChecklist(customChecklist);
    } else {
      setChecklist(DEFAULT_CHECKLIST.map((k) => t(k)));
    }

    // Compute P&L per day from recent trades
    const pnlByDay: Record<string, number> = {};
    for (const tr of recentTrades || []) {
      const day = (tr.open_time || "").split("T")[0];
      if (!day) continue;
      pnlByDay[day] = (pnlByDay[day] || 0) + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
    }

    // Attach P&L to each session history entry by date
    const historyWithPnl = (history || []).map((s) => ({
      ...s,
      pnl: pnlByDay[s.created_at.split("T")[0]] ?? undefined,
    }));

    if (session) setActiveSession(session);
    setSessionHistory(historyWithPnl);

    setLoading(false);
  }

  function handleStrategyChange(stratId: string) {
    const s = strategies.find((st) => st.id === stratId) ?? null;
    setStrategy(s);
    setCheckedItems(new Set());
    if (s) {
      const cl = s.pretrade_checklist && s.pretrade_checklist.length > 0
        ? s.pretrade_checklist
        : DEFAULT_CHECKLIST.map((k) => t(k));
      setChecklist(cl);
    } else {
      setChecklist(DEFAULT_CHECKLIST.map((k) => t(k)));
    }
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
    <div>
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

      {/* 2-column layout on desktop */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* LEFT column — 60% — Checklist + Emotion + Start */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* A — Checklist */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-0.5">{t("session_checklist_title")}</h2>
                <p className="text-xs text-accent">{t("session_checklist_subtitle")}</p>
              </div>
              {/* Strategy selector */}
              {strategies.length > 1 && (
                <select
                  value={strategy?.id || ""}
                  onChange={(e) => handleStrategyChange(e.target.value)}
                  className="px-2 py-1 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
                >
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-muted text-sm mb-4">{t("session_checklist_desc")}</p>

            {/* Strategy rules reminder */}
            {strategy && strategy.setup_rules && strategy.setup_rules.length > 0 && (
              <div className="mb-4 rounded-lg bg-background border border-border overflow-hidden">
                <button
                  onClick={() => setRulesOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted font-medium hover:text-foreground transition-colors"
                >
                  <span>📋 {rulesOpen ? t("session_hide_rules") : t("session_show_rules")}{strategy && ` — ${strategy.name}`}</span>
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

            {strategies.length === 0 && (
              <div className="mb-4 p-3 rounded-lg bg-surface border border-border text-sm text-muted flex items-center justify-between">
                <span>Aucune stratégie définie</span>
                <Link href="/dashboard/strategy" className="text-accent hover:underline">Définir ma stratégie →</Link>
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

            {/* Strategy checklist link */}
            <div className="mt-4 pt-3 border-t border-border">
              <Link href="/dashboard/trades" className="text-xs text-muted hover:text-accent transition-colors">
                {strategy ? `Voir checklist technique — ${strategy.name} →` : t("session_ict_link") + " →"}
              </Link>
            </div>
          </section>

          {/* C — Emotional state */}
          <section className="bg-card border border-border rounded-xl p-5">
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

        {/* RIGHT column — 40% — DayStatus + History + Quote */}
        <div className="lg:w-[40%] shrink-0 space-y-5">

          {/* Day status */}
          <DayStatus />

          {/* Session history */}
          {sessionHistory.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-base font-semibold text-foreground mb-3">📅 Historique des sessions</h2>
              <div className="space-y-2">
                {sessionHistory.map((s) => {
                  const emotion = EMOTIONS.find((e) => e.key === s.emotion_before);
                  const date = new Date(s.created_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <div key={s.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                      <span className="text-lg shrink-0">{emotion?.emoji ?? "—"}</span>
                      <span className="text-sm text-foreground font-medium capitalize shrink-0">{date}</span>
                      <span className="text-xs text-muted">
                        · Checklist : {s.checklist_completed ? <span className="text-profit">complète</span> : <span className="text-orange-400">incomplète</span>}
                      </span>
                      <span className="ml-auto shrink-0">
                        {s.pnl !== undefined ? (
                          <span className={`text-xs font-medium tabular-nums ${s.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                            {s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(2)}€
                          </span>
                        ) : s.ended_at ? (
                          <span className="text-xs text-muted">{new Date(s.ended_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                        ) : (
                          <span className="text-xs text-profit">En cours</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Daily quote */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">💡 Conseil du jour</p>
            <p className="text-sm text-foreground leading-relaxed italic">&ldquo;{dailyQuote}&rdquo;</p>
          </div>
        </div>
      </div>
    </div>
  );
}
