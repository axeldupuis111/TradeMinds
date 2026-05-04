"use client";

import { INSTRUMENTS } from "@/lib/instruments";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent text-sm";

interface Props {
  strategyId: string | null;
  pairs: string[];
  onClose: () => void;
  onSaved: () => void;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function QuickTradeLogger({ strategyId, pairs, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();

  const todayStr = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    pair: pairs[0] || "XAUUSD",
    direction: "long" as "long" | "short",
    open_hour: nowHHMM(),
    entry_price: "",
    sl: "",
    tp: "",
    lot_size: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.pair.trim()) errs.pair = t("manual_err_pair");
    if (!form.entry_price.trim() || isNaN(parseFloat(form.entry_price))) errs.entry_price = t("manual_err_entry");
    if (!form.sl.trim() || isNaN(parseFloat(form.sl))) errs.sl = t("manual_required_sl");
    if (!form.tp.trim() || isNaN(parseFloat(form.tp))) errs.tp = t("manual_required_tp");
    if (!form.lot_size.trim() || parseFloat(form.lot_size) <= 0) errs.lot_size = t("manual_required_lot");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    setSaveError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveError(t("not_connected")); setSaving(false); return; }

    const openTime = `${todayStr}T${form.open_hour}:00`;

    const { error: dbError } = await supabase.from("trades").insert({
      user_id: user.id,
      strategy_id: strategyId,
      open_time: openTime,
      close_time: null,
      pair: form.pair.toUpperCase(),
      direction: form.direction,
      lot_size: parseFloat(form.lot_size),
      entry_price: parseFloat(form.entry_price),
      exit_price: 0,
      sl: parseFloat(form.sl),
      tp: parseFloat(form.tp),
      pnl: 0,
      notes: form.notes || null,
      status: "open",
      closed_manually: false,
    });

    setSaving(false);
    if (dbError) {
      console.error("QuickTradeLogger insert failed:", dbError);
      setSaveError(t("manual_err_save"));
    } else {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{t("session_active_log_trade")}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Pair + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_pair")} <span className="text-loss">*</span></label>
              <input
                type="text"
                list="ql-pairs"
                value={form.pair}
                onChange={(e) => update("pair", e.target.value.toUpperCase())}
                placeholder="XAUUSD"
                className={`${inputClass} ${errors.pair ? "!border-loss" : ""}`}
              />
              <datalist id="ql-pairs">
                {pairs.map((p) => <option key={p} value={p} />)}
                {Object.values(INSTRUMENTS).flat().map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {errors.pair && <p className="text-loss text-xs mt-1">{errors.pair}</p>}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_direction")} <span className="text-loss">*</span></label>
              <select value={form.direction} onChange={(e) => update("direction", e.target.value)} className={inputClass}>
                <option value="long">Long / Buy</option>
                <option value="short">Short / Sell</option>
              </select>
            </div>
          </div>

          {/* Open hour */}
          <div>
            <label className="block text-xs text-muted mb-1">{t("manual_open_time")}</label>
            <input type="time" value={form.open_hour} onChange={(e) => update("open_hour", e.target.value)} className={inputClass} />
          </div>

          {/* Entry + Lot */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_entry")} <span className="text-loss">*</span></label>
              <input type="number" step="any" value={form.entry_price} onChange={(e) => update("entry_price", e.target.value)} className={`${inputClass} ${errors.entry_price ? "!border-loss" : ""}`} />
              {errors.entry_price && <p className="text-loss text-xs mt-1">{errors.entry_price}</p>}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_lot")} <span className="text-loss">*</span></label>
              <input type="number" step="0.01" min="0.01" value={form.lot_size} onChange={(e) => update("lot_size", e.target.value)} placeholder="0.10" className={`${inputClass} ${errors.lot_size ? "!border-loss" : ""}`} />
              {errors.lot_size && <p className="text-loss text-xs mt-1">{errors.lot_size}</p>}
            </div>
          </div>

          {/* SL + TP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_sl")} <span className="text-loss">*</span></label>
              <input type="number" step="any" value={form.sl} onChange={(e) => update("sl", e.target.value)} className={`${inputClass} ${errors.sl ? "!border-loss" : ""}`} />
              {errors.sl && <p className="text-loss text-xs mt-1">{errors.sl}</p>}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">{t("manual_tp")} <span className="text-loss">*</span></label>
              <input type="number" step="any" value={form.tp} onChange={(e) => update("tp", e.target.value)} className={`${inputClass} ${errors.tp ? "!border-loss" : ""}`} />
              {errors.tp && <p className="text-loss text-xs mt-1">{errors.tp}</p>}
            </div>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="block text-xs text-muted mb-1">
              Pourquoi tu prends ce trade ? <span className="text-muted opacity-60">({t("manual_optional")})</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              placeholder="Setup identifié, contexte du marché..."
              className={inputClass}
            />
          </div>
        </div>

        {saveError && <p className="text-loss text-sm mt-3">{saveError}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-accent text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "Logger le trade"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface border border-border text-foreground rounded-lg text-sm hover:bg-border transition-colors"
          >
            {t("manual_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
