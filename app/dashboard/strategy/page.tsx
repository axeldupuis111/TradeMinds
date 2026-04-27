"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

const SESSION_LABELS: Record<string, string> = {
  london: "London (08:00–12:00 UTC)",
  new_york: "New York (13:00–17:00 UTC)",
  asian: "Asian (00:00–06:00 UTC)",
  london_ny_overlap: "London-NY Overlap (13:00–16:00 UTC)",
};

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

interface ParsedRules {
  pairs: string[];
  sessions: string[];
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
  setup_rules: string[];
}

interface Toast {
  type: "success" | "error";
  text: string;
}

export default function StrategyPage() {
  const { t, lang } = useLanguage();
  const { canUseStrategy, loading: planLoading } = usePlan();
  const supabase = createClient();

  const [rawText, setRawText] = useState("");
  const [name, setName] = useState("");
  const [parsed, setParsed] = useState<ParsedRules | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadStrategy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn on browser close/refresh when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept in-app link navigation when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      try {
        const url = new URL(anchor.href);
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      pendingNavRef.current = anchor.href;
      setShowUnsavedModal(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  function showToast(type: "success" | "error", text: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function loadStrategy() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setExistingId(data.id);
      setName(data.name || "");
      setRawText(data.raw_text || "");
      setParsed({
        pairs: data.pairs || [],
        sessions: data.sessions || [],
        risk_reward: data.risk_reward,
        max_sl_pips: data.max_sl_pips,
        max_daily_loss: data.max_daily_loss,
        max_trades_per_day: data.max_trades_per_day,
        max_consecutive_losses: data.max_consecutive_losses,
        setup_rules: data.setup_rules || [],
      });
    }
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!rawText.trim()) {
      showToast("error", t("strategy_write_first"));
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur.");
      setParsed(data);
      setIsDirty(true);
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!parsed) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showToast("error", t("strategy_not_connected"));
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      name,
      raw_text: rawText,
      pairs: parsed.pairs,
      sessions: parsed.sessions,
      risk_reward: parsed.risk_reward,
      max_sl_pips: parsed.max_sl_pips,
      max_daily_loss: parsed.max_daily_loss,
      max_trades_per_day: parsed.max_trades_per_day,
      max_consecutive_losses: parsed.max_consecutive_losses,
      setup_rules: parsed.setup_rules,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase
        .from("strategies")
        .update(payload)
        .eq("id", existingId));
    } else {
      const res = await supabase
        .from("strategies")
        .insert(payload)
        .select("id")
        .single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }

    setSaving(false);
    if (error) {
      showToast("error", t("strategy_toast_error"));
    } else {
      showToast("success", t("strategy_toast_success"));
      setIsDirty(false);
    }
  }

  function markDirty() {
    setIsDirty(true);
  }

  function updateParsedField<K extends keyof ParsedRules>(
    field: K,
    value: ParsedRules[K]
  ) {
    if (!parsed) return;
    setParsed({ ...parsed, [field]: value });
    markDirty();
  }

  function removePair(pair: string) {
    if (!parsed) return;
    setParsed({ ...parsed, pairs: parsed.pairs.filter((p) => p !== pair) });
    markDirty();
  }

  function toggleSession(id: string) {
    if (!parsed) return;
    const sessions = parsed.sessions.includes(id)
      ? parsed.sessions.filter((s) => s !== id)
      : [...parsed.sessions, id];
    setParsed({ ...parsed, sessions });
    markDirty();
  }

  function updateRule(index: number, value: string) {
    if (!parsed) return;
    const rules = [...parsed.setup_rules];
    rules[index] = value;
    setParsed({ ...parsed, setup_rules: rules });
    markDirty();
  }

  function removeRule(index: number) {
    if (!parsed) return;
    setParsed({
      ...parsed,
      setup_rules: parsed.setup_rules.filter((_, i) => i !== index),
    });
    markDirty();
  }

  function addRule() {
    if (!parsed) return;
    setParsed({ ...parsed, setup_rules: [...parsed.setup_rules, ""] });
    markDirty();
  }

  if (loading || planLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("strategy_title")}</h1>
        <p className="text-muted mt-2 text-sm">{t("strategy_loading_sub")}</p>
        <div className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="skeleton h-4 w-40 mb-4" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!canUseStrategy) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">{t("strategy_title")}</h1>
        <p className="text-muted mt-1">{t("strategy_subtitle")}</p>
        <div className="mt-6">
          <UpgradeBanner message={t("plan_strategy_locked")} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl pb-24">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${
            toast.type === "success" ? "bg-green-800" : "bg-red-700"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Unsaved changes modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="text-foreground text-sm">{t("strategy_unsaved_warning")}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-surface transition-colors"
              >
                {t("strategy_stay")}
              </button>
              <button
                onClick={() => {
                  setShowUnsavedModal(false);
                  setIsDirty(false);
                  if (pendingNavRef.current) {
                    window.location.href = pendingNavRef.current;
                  }
                }}
                className="px-4 py-2 text-sm bg-loss text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                {t("strategy_leave")}
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground">{t("strategy_title")}</h1>
      <p className="text-muted mt-1">{t("strategy_subtitle")}</p>

      {/* Strategy name */}
      <div className="mt-6">
        <label className="block text-sm text-muted mb-1">{t("strategy_name")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          placeholder="ICT Gold Scalping"
          className={inputClass}
        />
      </div>

      {/* Raw text input */}
      <div className="mt-4">
        <label className="block text-sm text-muted mb-1">{t("strategy_describe")}</label>
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); markDirty(); }}
          rows={10}
          className={`${inputClass} min-h-[300px] resize-y`}
          placeholder={t("strategy_placeholder")}
        />
        <p className="text-right text-xs text-muted mt-1">
          {rawText.length} {t("strategy_chars")}
        </p>
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || !rawText.trim()}
        className="mt-4 px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {analyzing && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {analyzing ? t("strategy_analyzing") : t("strategy_analyze")}
      </button>

      {/* Parsed rules */}
      {parsed && (
        <div className="mt-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-profit"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">{t("strategy_rules_extracted")}</h2>
            <span className="text-muted text-sm">{t("strategy_editable")}</span>
          </div>

          {/* Pairs */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">{t("strategy_pairs")}</label>
            <div className="flex flex-wrap gap-2">
              {parsed.pairs.map((pair) => (
                <span
                  key={pair}
                  className="px-3 py-1 rounded-full text-sm bg-accent/20 border border-accent text-accent flex items-center gap-1"
                >
                  {pair}
                  <button
                    onClick={() => removePair(pair)}
                    className="ml-1 hover:text-loss transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
              {parsed.pairs.length === 0 && (
                <span className="text-muted text-sm">{t("strategy_all_pairs")}</span>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">{t("strategy_sessions")}</label>
            <div className="space-y-2">
              {Object.entries(SESSION_LABELS).map(([id, label]) => (
                <label key={id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parsed.sessions.includes(id)}
                    onChange={() => toggleSession(id)}
                    className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent focus:ring-offset-0"
                  />
                  <span className="text-foreground text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Risk management */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-3">{t("strategy_risk")}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_rr")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={parsed.risk_reward ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "risk_reward",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_sl_max")}</label>
                <input
                  type="number"
                  value={parsed.max_sl_pips ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_sl_pips",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_daily_loss")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={parsed.max_daily_loss ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_daily_loss",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_max_trades")}</label>
                <input
                  type="number"
                  value={parsed.max_trades_per_day ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_trades_per_day",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_consec_losses")}</label>
                <input
                  type="number"
                  value={parsed.max_consecutive_losses ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_consecutive_losses",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder={t("strategy_not_set")}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Setup rules */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">{t("strategy_setup_rules")}</label>
            <div className="space-y-2">
              {parsed.setup_rules.map((rule, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <textarea
                    value={rule}
                    title={rule}
                    onChange={(e) => updateRule(i, e.target.value)}
                    rows={2}
                    className={`${inputClass} flex-1 resize-y`}
                  />
                  <button
                    onClick={() => removeRule(i)}
                    className="px-3 py-2 text-muted hover:text-loss transition-colors mt-1 shrink-0"
                  >
                    <svg
                      className="w-4 h-4"
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
                </div>
              ))}
            </div>
            <button
              onClick={addRule}
              className="mt-2 text-sm text-accent hover:text-blue-400 transition-colors"
            >
              {t("strategy_add_rule")}
            </button>
          </div>
        </div>
      )}

      {/* Sticky save button */}
      {parsed && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 bg-profit text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {saving ? t("strategy_saving") : t("strategy_save")}
          </button>
        </div>
      )}
    </div>
  );
}
