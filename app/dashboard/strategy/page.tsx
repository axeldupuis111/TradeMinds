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

interface StrategyTagAI {
  value: string;
  label_fr: string;
  label_en: string;
  label_de: string;
  label_es: string;
}

interface StrategyTagsFromAI {
  setups?: StrategyTagAI[];
  entry_zones?: StrategyTagAI[];
  targets?: StrategyTagAI[];
  timing?: StrategyTagAI[];
  checklist?: StrategyTagAI[];
}

interface ParsedRules {
  pairs: string[];
  sessions: string[];
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
  setup_rules: string[];
  strategy_tags?: StrategyTagsFromAI;
}

interface Toast {
  type: "success" | "error";
  text: string;
}

const TAG_CATEGORY_COLORS: Record<string, string> = {
  setups: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  entry_zones: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  targets: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  timing: "bg-green-500/20 text-green-400 border border-green-500/30",
  checklist: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

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

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setExistingId(data.id);
      setName(data.name || "");
      setRawText(data.raw_text || "");

      // Load existing strategy_tags from DB to display even before re-analysis
      let existingTags: StrategyTagsFromAI | undefined;
      const { data: tagsData, error: tagsError } = await supabase
        .from("strategy_tags")
        .select("*")
        .eq("strategy_id", data.id)
        .order("sort_order");

      if (!tagsError && tagsData && tagsData.length > 0) {
        const groupTag = (type: string): StrategyTagAI[] =>
          tagsData!
            .filter((t) => t.tag_type === type)
            .map((t) => ({ value: t.value, label_fr: t.label_fr, label_en: t.label_en, label_de: t.label_de, label_es: t.label_es }));
        existingTags = {
          setups: groupTag("setup"),
          entry_zones: groupTag("entry_zone"),
          targets: groupTag("target"),
          timing: groupTag("timing"),
          checklist: groupTag("checklist"),
        };
      }

      setParsed({
        pairs: data.pairs || [],
        sessions: data.sessions || [],
        risk_reward: data.risk_reward,
        max_sl_pips: data.max_sl_pips,
        max_daily_loss: data.max_daily_loss,
        max_trades_per_day: data.max_trades_per_day,
        max_consecutive_losses: data.max_consecutive_losses,
        setup_rules: data.setup_rules || [],
        strategy_tags: existingTags,
      });
    }
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!rawText.trim()) { showToast("error", t("strategy_write_first")); return; }
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

    const { data: { user } } = await supabase.auth.getUser();
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

    let strategyId = existingId;
    let error;

    if (existingId) {
      ({ error } = await supabase.from("strategies").update(payload).eq("id", existingId));
    } else {
      const res = await supabase.from("strategies").insert(payload).select("id").single();
      error = res.error;
      if (res.data) { strategyId = res.data.id; setExistingId(res.data.id); }
    }

    // Save strategy_tags if present and we have a strategy ID
    if (!error && strategyId && parsed.strategy_tags) {
      await supabase.from("strategy_tags").delete().eq("strategy_id", strategyId).eq("user_id", user.id);

      const tagRows: Record<string, unknown>[] = [];
      const mapping: [keyof StrategyTagsFromAI, string][] = [
        ["setups", "setup"],
        ["entry_zones", "entry_zone"],
        ["targets", "target"],
        ["timing", "timing"],
        ["checklist", "checklist"],
      ];
      mapping.forEach(([key, tag_type]) => {
        (parsed.strategy_tags![key] || []).forEach((item, i) => {
          tagRows.push({
            user_id: user.id,
            strategy_id: strategyId,
            tag_type,
            value: item.value,
            label_fr: item.label_fr,
            label_en: item.label_en,
            label_de: item.label_de,
            label_es: item.label_es,
            sort_order: i,
          });
        });
      });

      if (tagRows.length > 0) {
        await supabase.from("strategy_tags").insert(tagRows);
      }
    }

    setSaving(false);
    if (error) {
      showToast("error", t("strategy_toast_error"));
    } else {
      showToast("success", t("strategy_toast_success"));
      setIsDirty(false);
    }
  }

  function markDirty() { setIsDirty(true); }

  function updateParsedField<K extends keyof ParsedRules>(field: K, value: ParsedRules[K]) {
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
    setParsed({ ...parsed, setup_rules: parsed.setup_rules.filter((_, i) => i !== index) });
    markDirty();
  }

  function addRule() {
    if (!parsed) return;
    setParsed({ ...parsed, setup_rules: [...parsed.setup_rules, ""] });
    markDirty();
  }

  function getTagLabel(tag: StrategyTagAI): string {
    const key = `label_${lang}` as keyof StrategyTagAI;
    return (tag[key] as string) || tag.label_fr || tag.value;
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

  const displayTags = parsed?.strategy_tags;
  const hasTags = displayTags && (
    (displayTags.setups?.length || 0) +
    (displayTags.entry_zones?.length || 0) +
    (displayTags.targets?.length || 0) +
    (displayTags.timing?.length || 0) +
    (displayTags.checklist?.length || 0)
  ) > 0;

  const tagCategories: { key: keyof StrategyTagsFromAI; labelKey: string }[] = [
    { key: "setups", labelKey: "strategy_tags_setups" },
    { key: "entry_zones", labelKey: "strategy_tags_entry_zones" },
    { key: "targets", labelKey: "strategy_tags_targets" },
    { key: "timing", labelKey: "strategy_tags_timing" },
    { key: "checklist", labelKey: "strategy_tags_checklist" },
  ];

  return (
    <div className="max-w-2xl pb-24">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-green-800" : "bg-red-700"}`}>
          {toast.text}
        </div>
      )}

      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="text-foreground text-sm">{t("strategy_unsaved_warning")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowUnsavedModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-surface transition-colors">
                {t("strategy_stay")}
              </button>
              <button
                onClick={() => {
                  setShowUnsavedModal(false);
                  setIsDirty(false);
                  if (pendingNavRef.current) window.location.href = pendingNavRef.current;
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

      <div className="mt-4">
        <label className="block text-sm text-muted mb-1">{t("strategy_describe")}</label>
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); markDirty(); }}
          rows={10}
          className={`${inputClass} min-h-[300px] resize-y`}
          placeholder={t("strategy_placeholder")}
        />
        <p className="text-right text-xs text-muted mt-1">{rawText.length} {t("strategy_chars")}</p>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing || !rawText.trim()}
        className="mt-4 px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {analyzing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {analyzing ? t("strategy_analyzing") : t("strategy_analyze")}
      </button>

      {parsed && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">{t("strategy_rules_extracted")}</h2>
            <span className="text-muted text-sm">{t("strategy_editable")}</span>
          </div>

          {/* Pairs */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">{t("strategy_pairs")}</label>
            <div className="flex flex-wrap gap-2">
              {parsed.pairs.map((pair) => (
                <span key={pair} className="px-3 py-1 rounded-full text-sm bg-accent/20 border border-accent text-accent flex items-center gap-1">
                  {pair}
                  <button onClick={() => removePair(pair)} className="ml-1 hover:text-loss transition-colors">×</button>
                </span>
              ))}
              {parsed.pairs.length === 0 && <span className="text-muted text-sm">{t("strategy_all_pairs")}</span>}
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
                <input type="number" step="0.1" value={parsed.risk_reward ?? ""} onChange={(e) => updateParsedField("risk_reward", e.target.value ? parseFloat(e.target.value) : null)} placeholder={t("strategy_not_set")} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_sl_max")}</label>
                <input type="number" value={parsed.max_sl_pips ?? ""} onChange={(e) => updateParsedField("max_sl_pips", e.target.value ? parseFloat(e.target.value) : null)} placeholder={t("strategy_not_set")} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_daily_loss")}</label>
                <input type="number" step="0.1" value={parsed.max_daily_loss ?? ""} onChange={(e) => updateParsedField("max_daily_loss", e.target.value ? parseFloat(e.target.value) : null)} placeholder={t("strategy_not_set")} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_max_trades")}</label>
                <input type="number" value={parsed.max_trades_per_day ?? ""} onChange={(e) => updateParsedField("max_trades_per_day", e.target.value ? parseInt(e.target.value) : null)} placeholder={t("strategy_not_set")} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t("strategy_consec_losses")}</label>
                <input type="number" value={parsed.max_consecutive_losses ?? ""} onChange={(e) => updateParsedField("max_consecutive_losses", e.target.value ? parseInt(e.target.value) : null)} placeholder={t("strategy_not_set")} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Setup rules */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">{t("strategy_setup_rules")}</label>
            <div className="space-y-2">
              {parsed.setup_rules.map((rule, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <textarea value={rule} title={rule} onChange={(e) => updateRule(i, e.target.value)} rows={2} className={`${inputClass} flex-1 resize-y`} />
                  <button onClick={() => removeRule(i)} className="px-3 py-2 text-muted hover:text-loss transition-colors mt-1 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRule} className="mt-2 text-sm text-accent hover:text-blue-400 transition-colors">{t("strategy_add_rule")}</button>
          </div>

          {/* Generated strategy tags */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t("strategy_generated_tags")}</h3>
            <p className="text-xs text-muted mb-4">{t("strategy_tags_subtitle")}</p>

            {hasTags ? (
              <div className="space-y-3">
                {tagCategories.map(({ key, labelKey }) => {
                  const items = displayTags?.[key] || [];
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted mb-1.5">{t(labelKey)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((tag) => (
                          <span key={tag.value} className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAG_CATEGORY_COLORS[key]}`}>
                            {getTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted/70 italic">{t("strategy_tags_empty")}</p>
            )}
          </div>
        </div>
      )}

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
