"use client";

import { detectKillzone, ICT_CHECKLIST_ITEMS, ICT_EMOTIONS, ICT_ENTRY_ZONES, ICT_KILLZONES, ICT_LIQUIDITY_TARGETS, ICT_SETUPS, ICT_TIMEFRAMES } from "@/lib/ict-constants";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/translations";
import { useState } from "react";

interface Props {
  pairs: string[];
  strategyId: string | null;
  onClose: () => void;
  onSaved: () => void;
  initialChecklist?: Record<string, boolean>;
}

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

// Selected state: filled background
const EMOTION_SELECTED_COLORS: Record<string, string> = {
  positive: "bg-profit border-profit text-white",
  negative: "bg-loss border-loss text-white",
  warning: "bg-orange-500 border-orange-500 text-white",
  neutral: "bg-muted border-muted text-white",
};

// Unselected state: tinted border to indicate category
const EMOTION_UNSELECTED_COLORS: Record<string, string> = {
  positive: "border-profit/50 text-profit hover:bg-profit/10",
  negative: "border-loss/50 text-loss hover:bg-loss/10",
  warning: "border-orange-500/50 text-orange-400 hover:bg-orange-500/10",
  neutral: "border-muted/50 text-muted hover:bg-surface",
};

export default function ManualTradeModal({ pairs, strategyId, onClose, onSaved, initialChecklist }: Props) {
  const { t, lang } = useLanguage();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    open_time: "",
    close_time: "",
    pair: pairs[0] || "",
    direction: "long" as "long" | "short",
    lot_size: "",
    entry_price: "",
    exit_price: "",
    sl: "",
    tp: "",
    pnl: "",
    notes: "",
    // ICT fields
    ict_setup: "",
    ict_entry_zone: "",
    ict_liquidity_target: "",
    ict_killzone: "",
    ict_timeframe: "",
    emotion: "",
  });

  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    initialChecklist || ICT_CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>)
  );

  function update(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-detect killzone from open_time
      if (field === "open_time" && value && !prev.ict_killzone) {
        next.ict_killzone = detectKillzone(value);
      }
      return next;
    });
  }

  function toggleChecklist(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setError(null);

    if (!form.pair || !form.entry_price || !form.pnl) {
      setError(t("manual_required"));
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(t("not_connected"));
      setSaving(false);
      return;
    }

    const checkedCount = ICT_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;

    const { error: dbError } = await supabase.from("trades").insert({
      user_id: user.id,
      strategy_id: strategyId,
      open_time: form.open_time || null,
      close_time: form.close_time || null,
      pair: form.pair,
      direction: form.direction,
      lot_size: parseFloat(form.lot_size) || 0,
      entry_price: parseFloat(form.entry_price) || 0,
      exit_price: parseFloat(form.exit_price) || 0,
      sl: parseFloat(form.sl) || null,
      tp: parseFloat(form.tp) || null,
      pnl: parseFloat(form.pnl) || 0,
      notes: form.notes || null,
      // ICT fields
      ict_setup: form.ict_setup || null,
      ict_entry_zone: form.ict_entry_zone || null,
      ict_liquidity_target: form.ict_liquidity_target || null,
      ict_killzone: form.ict_killzone || null,
      ict_timeframe: form.ict_timeframe || null,
      ict_confluence_score: checkedCount,
      ict_checklist: checklist,
      emotion: form.emotion || null,
    });

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onSaved();
      onClose();
    }
  }

  const l = lang as Lang;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t("manual_title")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_open")}</label>
              <input type="datetime-local" value={form.open_time} onChange={(e) => update("open_time", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_close")}</label>
              <input type="datetime-local" value={form.close_time} onChange={(e) => update("close_time", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_pair")}</label>
              <select value={form.pair} onChange={(e) => update("pair", e.target.value)} className={inputClass}>
                {pairs.length > 0 ? (
                  pairs.map((p) => <option key={p} value={p}>{p}</option>)
                ) : (
                  <>
                    <option value="XAUUSD">XAUUSD</option>
                    <option value="EURUSD">EURUSD</option>
                    <option value="GBPUSD">GBPUSD</option>
                    <option value="USDJPY">USDJPY</option>
                    <option value="NAS100">NAS100</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_direction")}</label>
              <select value={form.direction} onChange={(e) => update("direction", e.target.value)} className={inputClass}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_lot")}</label>
              <input type="number" step="0.01" value={form.lot_size} onChange={(e) => update("lot_size", e.target.value)} placeholder="0.10" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_entry")}</label>
              <input type="number" step="any" value={form.entry_price} onChange={(e) => update("entry_price", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_exit")}</label>
              <input type="number" step="any" value={form.exit_price} onChange={(e) => update("exit_price", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_sl")}</label>
              <input type="number" step="any" value={form.sl} onChange={(e) => update("sl", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_tp")}</label>
              <input type="number" step="any" value={form.tp} onChange={(e) => update("tp", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("manual_pnl")}</label>
              <input type="number" step="any" value={form.pnl} onChange={(e) => update("pnl", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">{t("manual_notes")}</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} placeholder={t("manual_notes_placeholder")} className={inputClass} />
          </div>

          {/* ─── ICT Analysis Section ─── */}
          <div className="border-l-4 border-accent pl-4 mt-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">{t("ict_analysis_section")}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">{t("ict_setup")}</label>
                <select value={form.ict_setup} onChange={(e) => update("ict_setup", e.target.value)} className={inputClass}>
                  <option value="">{t("ict_select_setup")}</option>
                  {ICT_SETUPS.map((s) => <option key={s.value} value={s.value}>{s.label[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">{t("ict_entry_zone")}</label>
                <select value={form.ict_entry_zone} onChange={(e) => update("ict_entry_zone", e.target.value)} className={inputClass}>
                  <option value="">{t("ict_select_zone")}</option>
                  {ICT_ENTRY_ZONES.map((z) => <option key={z.value} value={z.value}>{z.label[l]}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">{t("ict_liquidity_target")}</label>
                <select value={form.ict_liquidity_target} onChange={(e) => update("ict_liquidity_target", e.target.value)} className={inputClass}>
                  <option value="">{t("ict_select_liquidity")}</option>
                  {ICT_LIQUIDITY_TARGETS.map((lt) => <option key={lt.value} value={lt.value}>{lt.label[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">{t("ict_killzone")}</label>
                <select value={form.ict_killzone} onChange={(e) => update("ict_killzone", e.target.value)} className={inputClass}>
                  <option value="">{t("ict_select_killzone")}</option>
                  {ICT_KILLZONES.map((kz) => <option key={kz.value} value={kz.value}>{kz.label[l]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">{t("ict_timeframe")}</label>
              <select value={form.ict_timeframe} onChange={(e) => update("ict_timeframe", e.target.value)} className={`${inputClass} w-1/2`}>
                <option value="">{t("ict_select_timeframe")}</option>
                {ICT_TIMEFRAMES.map((tf) => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
              </select>
            </div>

            {/* Emotion buttons */}
            <div>
              <label className="block text-sm text-muted mb-2">{t("ict_emotion")}</label>
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

            {/* ICT Checklist */}
            <div>
              <label className="block text-sm text-muted mb-1">
                {t("ict_checklist_title")} — {ICT_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length}/7
              </label>
              {/* Progress bar */}
              {(() => {
                const checked = ICT_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
                const pct = (checked / 7) * 100;
                const barColor = checked <= 3 ? "bg-loss" : checked <= 5 ? "bg-warning" : "bg-profit";
                return (
                  <div className="h-1 w-full bg-surface rounded-full mb-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                );
              })()}
              <div className="space-y-2">
                {ICT_CHECKLIST_ITEMS.map((item) => (
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
          </div>
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

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
