"use client";

import { detectKillzone, ICT_EMOTIONS, ICT_TIMEFRAMES } from "@/lib/ict-constants";
import { INSTRUMENTS, INSTRUMENT_CATEGORIES } from "@/lib/instruments";
import { useStrategyTags } from "@/lib/hooks/useStrategyTags";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/translations";
import { useEffect, useMemo, useState } from "react";

interface Props {
  pairs: string[];
  strategyId: string | null;
  onClose: () => void;
  onSaved: () => void;
  initialChecklist?: Record<string, boolean>;
}

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

const EMOTION_SELECTED_COLORS: Record<string, string> = {
  positive: "bg-profit border-profit text-white",
  negative: "bg-loss border-loss text-white",
  warning: "bg-orange-500 border-orange-500 text-white",
  neutral: "bg-muted border-muted text-white",
};

const EMOTION_UNSELECTED_COLORS: Record<string, string> = {
  positive: "border-profit/50 text-profit hover:bg-profit/10",
  negative: "border-loss/50 text-loss hover:bg-loss/10",
  warning: "border-orange-500/50 text-orange-400 hover:bg-orange-500/10",
  neutral: "border-muted/50 text-muted hover:bg-surface",
};

interface Account {
  id: string;
  firm: string;
  account_number: string | null;
}

function AiBadge({ visible, t }: { visible: boolean; t: (key: string) => string }) {
  if (!visible) return null;
  return (
    <span
      className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium cursor-help"
      title={t("ai_badge_tooltip")}
    >
      {t("ai_badge")}
    </span>
  );
}

export default function ManualTradeModal({ pairs, strategyId, onClose, onSaved, initialChecklist }: Props) {
  const { t, lang } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const isFree = !planLoading && plan === "free";
  const supabase = createClient();
  const stratTags = useStrategyTags();
  const [saving, setSaving] = useState(false);
  const [hasStrategy, setHasStrategy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  useEffect(() => {
    async function loadAccounts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("prop_challenges")
        .select("id, firm, account_number")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setAccounts(data);
        setSelectedAccountId(data[0].id);
      }
    }
    loadAccounts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFree) return;
    async function loadStrategy() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("strategies")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasStrategy(!!data);
    }
    loadStrategy();
  }, [isFree]); // eslint-disable-line react-hooks/exhaustive-deps

  const showAnalysis = !isFree && hasStrategy === true;
  const showAiBadge = !isFree && hasStrategy === true;

  const defaultPair = pairs[0] || "XAUUSD";
  const [form, setForm] = useState({
    open_date: "",
    open_hour: "",
    close_date: "",
    close_hour: "",
    pair: defaultPair,
    direction: "long" as "long" | "short",
    lot_size: "",
    entry_price: "",
    exit_price: "",
    sl: "",
    tp: "",
    pnl: "",
    notes: "",
    ict_setup: "",
    ict_entry_zone: "",
    ict_liquidity_target: "",
    ict_killzone: "",
    ict_timeframe: "",
    emotion: "",
  });
  const [closedManually, setClosedManually] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialChecklist || {});

  useEffect(() => {
    if (!initialChecklist && !stratTags.loading && stratTags.checklist.length > 0) {
      setChecklist((prev) => {
        const hasKeys = stratTags.checklist.some((i) => i.key in prev);
        if (hasKeys) return prev;
        return stratTags.checklist.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>);
      });
    }
  }, [stratTags.loading, stratTags.checklist, initialChecklist]);

  // AI completeness score — 13 level-2 fields
  const aiScore = useMemo(() => {
    const checklistHasItem = Object.values(checklist).some(Boolean);
    const filled = [
      !!form.open_hour,
      !!form.close_date,
      !!form.close_hour,
      form.exit_price.trim() !== "" && !isNaN(parseFloat(form.exit_price)),
      form.sl.trim() !== "" && !isNaN(parseFloat(form.sl)),
      form.tp.trim() !== "" && !isNaN(parseFloat(form.tp)),
      !!form.ict_setup,
      !!form.ict_entry_zone,
      !!form.ict_liquidity_target,
      !!form.ict_killzone,
      !!form.ict_timeframe,
      !!form.emotion,
      checklistHasItem,
    ].filter(Boolean).length;
    return { filled, total: 13, pct: Math.round((filled / 13) * 100) };
  }, [form, checklist]);

  function update(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if ((field === "open_date" || field === "open_hour") && !prev.ict_killzone) {
        const date = field === "open_date" ? value : prev.open_date;
        const hour = field === "open_hour" ? value : prev.open_hour;
        if (date && hour) {
          next.ict_killzone = detectKillzone(`${date}T${hour}`);
        }
      }
      return next;
    });
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  function toggleChecklist(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setError(null);
    const errors: Record<string, string> = {};
    if (!form.open_date) errors.open_date = t("manual_err_open_date");
    if (!form.pair) errors.pair = t("manual_err_pair");
    const hasLot = form.lot_size.trim() !== "" && parseFloat(form.lot_size) > 0;
    if (!hasLot) errors.lot_size = t("manual_required_lot");
    const hasEntry = form.entry_price.trim() !== "" && !isNaN(parseFloat(form.entry_price));
    if (!hasEntry) errors.entry_price = t("manual_err_entry");
    if (!closedManually) {
      if (!form.sl.trim() || isNaN(parseFloat(form.sl))) errors.sl = t("manual_required_sl");
      if (!form.tp.trim() || isNaN(parseFloat(form.tp))) errors.tp = t("manual_required_tp");
    }
    const hasPnl = form.pnl.trim() !== "" && !isNaN(parseFloat(form.pnl));
    if (!hasPnl) errors.pnl = t("manual_err_pnl");
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError(t("not_connected")); setSaving(false); return; }

    const openTime = form.open_hour
      ? `${form.open_date}T${form.open_hour}:00`
      : `${form.open_date}T00:00:00`;
    const closeTime = form.close_date
      ? (form.close_hour ? `${form.close_date}T${form.close_hour}:00` : `${form.close_date}T00:00:00`)
      : null;

    const checklistItems = stratTags.checklist;
    const checkedCount = checklistItems.filter((i) => checklist[i.key]).length;

    try {
      const { error: dbError } = await supabase.from("trades").insert({
        user_id: user.id,
        strategy_id: strategyId,
        challenge_id: selectedAccountId || null,
        open_time: openTime,
        close_time: closeTime,
        pair: form.pair,
        direction: form.direction,
        lot_size: parseFloat(form.lot_size),
        entry_price: parseFloat(form.entry_price),
        exit_price: parseFloat(form.exit_price) || 0,
        sl: parseFloat(form.sl) || null,
        tp: parseFloat(form.tp) || null,
        pnl: parseFloat(form.pnl),
        notes: form.notes || null,
        ict_setup: form.ict_setup || null,
        ict_entry_zone: form.ict_entry_zone || null,
        ict_liquidity_target: form.ict_liquidity_target || null,
        ict_killzone: form.ict_killzone || null,
        ict_timeframe: form.ict_timeframe || null,
        ict_confluence_score: checkedCount,
        ict_checklist: checklist,
        emotion: form.emotion || null,
        ai_completeness_score: aiScore.pct,
        closed_manually: closedManually,
      });

      setSaving(false);
      if (dbError) {
        console.error("Trade insert failed:", dbError);
        setError(t("manual_err_save"));
      } else {
        onSaved();
        onClose();
      }
    } catch (e) {
      console.error("Unexpected error:", e);
      setSaving(false);
      setError(t("manual_err_save"));
    }
  }

  const l = lang as Lang;
  const checklistItems = stratTags.checklist;
  const checkedCount = checklistItems.filter((i) => checklist[i.key]).length;
  const checklistTotal = checklistItems.length || 7;
  const sectionTitle = stratTags.isDefault ? t("ict_analysis_section") : t("trade_analysis_section");

  // AI completeness banner
  let aiBanner: { bg: string; text: string; icon: string; label: string; hint?: string };
  if (aiScore.pct >= 80) {
    aiBanner = {
      bg: "bg-profit/10 border-profit/20",
      text: "text-profit",
      icon: "✅",
      label: t("ai_completeness_full"),
    };
  } else if (aiScore.pct >= 40) {
    aiBanner = {
      bg: "bg-orange-500/10 border-orange-500/20",
      text: "text-orange-400",
      icon: "⚠️",
      label: t("ai_completeness_partial"),
      hint: t("ai_completeness_hint_partial"),
    };
  } else {
    aiBanner = {
      bg: "bg-accent/10 border-accent/20",
      text: "text-accent",
      icon: "ℹ️",
      label: t("ai_completeness_low"),
      hint: t("ai_completeness_hint_low"),
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t("manual_title")}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Account selector */}
          {accounts.length > 0 ? (
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_account")}</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className={inputClass}>
                <option value="">{t("manual_no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firm}{a.account_number ? ` (#${a.account_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-orange-300">
                {t("manual_no_account_warning")}{" "}
                <a href="/dashboard/challenge" className="text-accent hover:underline">{t("manual_create_account_link")}</a>
              </p>
            </div>
          )}

          {/* Open date / time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_open_date")} <span className="text-loss">*</span>
              </label>
              <input type="date" value={form.open_date} onChange={(e) => update("open_date", e.target.value)} className={`${inputClass} ${fieldErrors.open_date ? "!border-loss" : ""}`} />
              {fieldErrors.open_date && <p className="text-loss text-xs mt-1">{fieldErrors.open_date}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_open_time")} <AiBadge visible={showAiBadge} t={t} />
              </label>
              <input type="time" value={form.open_hour} onChange={(e) => update("open_hour", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Close date / time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_close_date")} <AiBadge visible={showAiBadge} t={t} />
              </label>
              <input type="date" value={form.close_date} onChange={(e) => update("close_date", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_close_time")} <AiBadge visible={showAiBadge} t={t} />
              </label>
              <input type="time" value={form.close_hour} onChange={(e) => update("close_hour", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Pair / Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_pair")} <span className="text-loss">*</span>
              </label>
              <input
                type="text"
                list="instrument-list"
                value={form.pair}
                onChange={(e) => update("pair", e.target.value.toUpperCase())}
                placeholder="XAUUSD"
                className={`${inputClass} ${fieldErrors.pair ? "!border-loss" : ""}`}
              />
              {fieldErrors.pair && <p className="text-loss text-xs mt-1">{fieldErrors.pair}</p>}
              <datalist id="instrument-list">
                {pairs.length > 0 && pairs.map((p) => <option key={`s-${p}`} value={p} />)}
                {Object.entries(INSTRUMENTS).map(([cat, items]) => (
                  items.map((item) => (
                    <option key={item} value={item} label={`${item} — ${INSTRUMENT_CATEGORIES[cat]}`} />
                  ))
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_direction")} <span className="text-loss">*</span>
              </label>
              <select value={form.direction} onChange={(e) => update("direction", e.target.value)} className={inputClass}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          {/* Lot / Entry / Exit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_lot")} <span className="text-loss">*</span>
              </label>
              <input type="number" step="0.01" min="0.01" value={form.lot_size} onChange={(e) => update("lot_size", e.target.value)} placeholder="0.10" className={`${inputClass} ${fieldErrors.lot_size ? "!border-loss" : ""}`} />
              {fieldErrors.lot_size && <p className="text-loss text-xs mt-1">{fieldErrors.lot_size}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_entry")} <span className="text-loss">*</span>
              </label>
              <input type="number" step="any" value={form.entry_price} onChange={(e) => update("entry_price", e.target.value)} className={`${inputClass} ${fieldErrors.entry_price ? "!border-loss" : ""}`} />
              {fieldErrors.entry_price && <p className="text-loss text-xs mt-1">{fieldErrors.entry_price}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_exit")} <AiBadge visible={showAiBadge} t={t} />
              </label>
              <input type="number" step="any" value={form.exit_price} onChange={(e) => update("exit_price", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Closed manually checkbox */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={closedManually}
              onChange={(e) => {
                setClosedManually(e.target.checked);
                if (e.target.checked) {
                  setFieldErrors((prev) => { const n = { ...prev }; delete n.sl; delete n.tp; return n; });
                }
              }}
              className="rounded"
            />
            <span>{t("trade_closed_manually")}</span>
            <span
              className="text-xs text-gray-500 dark:text-gray-400 cursor-help"
              title={t("trade_closed_manually_tooltip")}
            >
              (?)
            </span>
          </label>

          {/* SL / TP / P&L */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_sl")} {closedManually ? <AiBadge visible={showAiBadge} t={t} /> : <span className="text-loss ml-1">*</span>}
                {closedManually && <span className="text-xs text-muted ml-1">({t("manual_optional")})</span>}
              </label>
              <input type="number" step="any" value={form.sl} onChange={(e) => update("sl", e.target.value)} className={`${inputClass} ${fieldErrors.sl ? "!border-loss" : ""}`} />
              {fieldErrors.sl && <p className="text-loss text-xs mt-1">{fieldErrors.sl}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1 flex items-center">
                {t("manual_tp")} {closedManually ? <AiBadge visible={showAiBadge} t={t} /> : <span className="text-loss ml-1">*</span>}
                {closedManually && <span className="text-xs text-muted ml-1">({t("manual_optional")})</span>}
              </label>
              <input type="number" step="any" value={form.tp} onChange={(e) => update("tp", e.target.value)} className={`${inputClass} ${fieldErrors.tp ? "!border-loss" : ""}`} />
              {fieldErrors.tp && <p className="text-loss text-xs mt-1">{fieldErrors.tp}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("manual_pnl")} <span className="text-loss">*</span>
              </label>
              <input type="number" step="any" value={form.pnl} onChange={(e) => update("pnl", e.target.value)} className={`${inputClass} ${fieldErrors.pnl ? "!border-loss" : ""}`} />
              {fieldErrors.pnl && <p className="text-loss text-xs mt-1">{fieldErrors.pnl}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-muted mb-1">
              {t("manual_notes")} <span className="text-muted text-xs">{t("manual_optional")}</span>
            </label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} placeholder={t("manual_notes_placeholder")} className={inputClass} />
          </div>

          {/* Analysis section — gated by plan + strategy */}
          {isFree ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 my-4 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 text-xl">🔒</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t("analysis_locked_title")}</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{t("analysis_locked_description")}</p>
                  <a href="/dashboard/upgrade" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200">
                    {t("analysis_locked_cta")}
                  </a>
                </div>
              </div>
            </div>
          ) : hasStrategy === false ? (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 my-4 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-start gap-3">
                <span className="text-amber-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">{t("analysis_no_strategy_title")}</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">{t("analysis_no_strategy_description")}</p>
                  <a href="/dashboard/strategy" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200">
                    {t("analysis_no_strategy_cta")}
                  </a>
                </div>
              </div>
            </div>
          ) : showAnalysis ? (
            <div className="border-l-[3px] border-blue-500 pl-4 mt-6 space-y-4">
              <p className="text-sm font-semibold text-foreground">{sectionTitle}</p>

              {stratTags.loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1 flex items-center">
                        {t("ict_setup")} <AiBadge visible={showAiBadge} t={t} />
                      </label>
                      <select value={form.ict_setup} onChange={(e) => update("ict_setup", e.target.value)} className={inputClass}>
                        <option value="">{t("ict_select_setup")}</option>
                        {stratTags.setups.map((s) => <option key={s.value} value={s.value}>{s.label[l]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1 flex items-center">
                        {t("ict_entry_zone")} <AiBadge visible={showAiBadge} t={t} />
                      </label>
                      <select value={form.ict_entry_zone} onChange={(e) => update("ict_entry_zone", e.target.value)} className={inputClass}>
                        <option value="">{t("ict_select_zone")}</option>
                        {stratTags.entry_zones.map((z) => <option key={z.value} value={z.value}>{z.label[l]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1 flex items-center">
                        {t("ict_liquidity_target")} <AiBadge visible={showAiBadge} t={t} />
                      </label>
                      <select value={form.ict_liquidity_target} onChange={(e) => update("ict_liquidity_target", e.target.value)} className={inputClass}>
                        <option value="">{t("ict_select_liquidity")}</option>
                        {stratTags.targets.map((lt) => <option key={lt.value} value={lt.value}>{lt.label[l]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1 flex items-center">
                        {t("ict_killzone")} <AiBadge visible={showAiBadge} t={t} />
                      </label>
                      <select value={form.ict_killzone} onChange={(e) => update("ict_killzone", e.target.value)} className={inputClass}>
                        <option value="">{t("ict_select_killzone")}</option>
                        {stratTags.timing.map((kz) => <option key={kz.value} value={kz.value}>{kz.label[l]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-muted mb-1 flex items-center">
                      {t("ict_timeframe")} <AiBadge visible={showAiBadge} t={t} />
                    </label>
                    <select value={form.ict_timeframe} onChange={(e) => update("ict_timeframe", e.target.value)} className={`${inputClass} w-1/2`}>
                      <option value="">{t("ict_select_timeframe")}</option>
                      {ICT_TIMEFRAMES.map((tf) => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
                    </select>
                  </div>

                  {/* Emotion buttons */}
                  <div>
                    <label className="block text-sm text-muted mb-2 flex items-center">
                      {t("ict_emotion")} <AiBadge visible={showAiBadge} t={t} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ICT_EMOTIONS.map((em) => (
                        <button
                          key={em.value}
                          type="button"
                          onClick={() => update("emotion", form.emotion === em.value ? "" : em.value)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            form.emotion === em.value
                              ? EMOTION_SELECTED_COLORS[em.category]
                              : `bg-surface/50 ${EMOTION_UNSELECTED_COLORS[em.category]}`
                          }`}
                        >
                          {em.label[l]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div>
                    <label className="block text-sm text-muted mb-1 flex items-center">
                      {t("ict_checklist_title")} — {checkedCount}/{checklistTotal} <AiBadge visible={showAiBadge} t={t} />
                    </label>
                    {(() => {
                      const pct = (checkedCount / checklistTotal) * 100;
                      const barColor = checkedCount <= Math.round(checklistTotal * 0.43) ? "bg-loss" : checkedCount <= Math.round(checklistTotal * 0.71) ? "bg-warning" : "bg-profit";
                      return (
                        <div className="h-1 w-full bg-surface rounded-full mb-3 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      );
                    })()}
                    <div className="space-y-2">
                      {checklistItems.map((item) => (
                        <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!checklist[item.key]}
                            onChange={() => toggleChecklist(item.key)}
                            className="w-4 h-4 accent-accent rounded"
                          />
                          <span className={`text-sm transition-colors ${checklist[item.key] ? "text-profit" : "text-muted group-hover:text-foreground"}`}>
                            {item.label[l]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

        {/* AI completeness banner — only for paying users with strategy */}
        {showAnalysis && (
          <div className={`rounded-lg border px-3 py-2 mt-4 ${aiBanner.bg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${aiBanner.text}`}>
                {aiBanner.icon} {aiBanner.label}
              </span>
              <span className={`text-xs tabular-nums ${aiBanner.text}`}>
                {aiScore.filled}/{aiScore.total}
              </span>
            </div>
            {aiBanner.hint && (
              <p className={`text-xs mt-0.5 opacity-80 ${aiBanner.text}`}>{aiBanner.hint}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
            {saving ? t("manual_saving") : t("manual_save")}
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-surface border border-border text-foreground rounded-lg hover:bg-border transition-colors">
            {t("manual_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
