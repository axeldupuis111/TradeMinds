"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { estimatePnl } from "@/lib/pnl-calculator";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

interface OpenTrade {
  id: string;
  pair: string;
  direction: "long" | "short" | "buy" | "sell";
  lot_size: number;
  entry_price: number;
  sl: number | null;
  tp: number | null;
  open_time: string;
  notes: string | null;
}

interface Props {
  tradeId: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent text-sm";

function nowDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeDirection(dir: string): "long" | "short" {
  const d = dir.toLowerCase();
  if (d === "long" || d === "buy") return "long";
  return "short";
}

export default function CloseTradeModal({ tradeId, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();

  const [trade, setTrade] = useState<OpenTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [exitPrice, setExitPrice] = useState("");
  const [closeTime, setCloseTime] = useState<string>(nowDateTimeLocal());
  const [pnl, setPnl] = useState("");
  const [pnlTouched, setPnlTouched] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load trade on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("id, pair, direction, lot_size, entry_price, sl, tp, open_time, notes")
        .eq("id", tradeId)
        .eq("status", "open")
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        setLoadError(t("close_trade_not_found"));
        setLoading(false);
        return;
      }
      setTrade(data as OpenTrade);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [tradeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calc P&L from exit_price (as long as user hasn't manually overridden it)
  const estimated = useMemo(() => {
    if (!trade) return null;
    const exit = parseFloat(exitPrice);
    if (!isFinite(exit)) return null;
    return estimatePnl({
      entry: trade.entry_price,
      exit,
      lot: trade.lot_size,
      direction: trade.direction,
      pair: trade.pair,
    });
  }, [trade, exitPrice]);

  useEffect(() => {
    if (!pnlTouched && estimated !== null) {
      setPnl(String(estimated));
    }
  }, [estimated, pnlTouched]);

  function update(field: string) {
    if (errors[field]) {
      setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  async function handleSave() {
    if (!trade) return;
    const errs: Record<string, string> = {};

    const exitNum = parseFloat(exitPrice);
    if (!exitPrice.trim() || !isFinite(exitNum)) errs.exit = t("close_trade_err_exit");
    const pnlNum = parseFloat(pnl);
    if (!pnl.trim() || !isFinite(pnlNum)) errs.pnl = t("close_trade_err_pnl");
    if (!closeTime) errs.close_time = t("close_trade_err_time");

    // close_time must be after open_time
    if (closeTime && trade.open_time) {
      const closeMs = new Date(closeTime).getTime();
      const openMs = new Date(trade.open_time).getTime();
      if (closeMs < openMs) errs.close_time = t("close_trade_err_time_before_open");
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    setSaveError(null);

    // Build the new notes: append closing notes to existing ones if any
    let mergedNotes: string | null = trade.notes;
    if (closingNotes.trim()) {
      const closingBlock = `--- ${t("close_trade_notes_separator")} ---\n${closingNotes.trim()}`;
      mergedNotes = trade.notes && trade.notes.trim()
        ? `${trade.notes}\n\n${closingBlock}`
        : closingBlock;
    }

    const closeIso = new Date(closeTime).toISOString();

    const { error: dbError } = await supabase
      .from("trades")
      .update({
        status: "closed",
        exit_price: exitNum,
        pnl: pnlNum,
        close_time: closeIso,
        closed_at: closeIso,
        closed_manually: true,
        notes: mergedNotes,
      })
      .eq("id", trade.id)
      .eq("status", "open"); // safety: only update if still open

    setSaving(false);
    if (dbError) {
      console.error("Close trade failed:", dbError);
      setSaveError(t("close_trade_err_save"));
      return;
    }
    onSaved();
    onClose();
  }

  // — RENDER —

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
          <p className="text-muted text-sm">{t("close_trade_loading")}</p>
        </div>
      </div>
    );
  }

  if (loadError || !trade) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">{t("close_trade_title")}</h2>
          <p className="text-loss text-sm">{loadError || t("close_trade_not_found")}</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm hover:bg-border transition-colors">
              {t("close_trade_cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dir = normalizeDirection(trade.direction);
  const dirLabel = dir === "long" ? "LONG" : "SHORT";
  const dirColor = dir === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss";

  const pnlNum = parseFloat(pnl);
  const pnlPositive = isFinite(pnlNum) && pnlNum >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 overflow-y-auto py-8">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("close_trade_title")}</h2>
            <p className="text-xs text-muted mt-0.5">{t("close_trade_subtitle")}</p>
          </div>
          <button onClick={onClose} aria-label={t("detail_close")} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trade summary (read-only) */}
        <div className="bg-surface border border-border rounded-lg p-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-semibold text-foreground">{trade.pair}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${dirColor}`}>{dirLabel}</span>
            <span className="text-sm text-muted">{trade.lot_size} lot @ {trade.entry_price}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>SL : <span className="text-foreground">{trade.sl ?? "—"}</span></span>
            <span>TP : <span className="text-foreground">{trade.tp ?? "—"}</span></span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {/* Exit price */}
          <div>
            <label className="block text-xs text-muted mb-1">
              {t("close_trade_exit_price")} <span className="text-loss">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => { setExitPrice(e.target.value); update("exit"); }}
              placeholder={String(trade.entry_price)}
              className={`${inputClass} ${errors.exit ? "!border-loss" : ""}`}
            />
            {errors.exit && <p className="text-loss text-xs mt-1">{errors.exit}</p>}
          </div>

          {/* Close time */}
          <div>
            <label className="block text-xs text-muted mb-1">
              {t("close_trade_close_time")} <span className="text-loss">*</span>
            </label>
            <input
              type="datetime-local"
              value={closeTime}
              onChange={(e) => { setCloseTime(e.target.value); update("close_time"); }}
              className={`${inputClass} ${errors.close_time ? "!border-loss" : ""}`}
            />
            {errors.close_time && <p className="text-loss text-xs mt-1">{errors.close_time}</p>}
          </div>

          {/* P&L (auto-calculated, editable) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-muted">
                {t("close_trade_pnl")} <span className="text-loss">*</span>
              </label>
              {pnlTouched && estimated !== null && (
                <button
                  type="button"
                  onClick={() => { setPnl(String(estimated)); setPnlTouched(false); }}
                  className="text-[11px] text-accent hover:underline"
                >
                  {t("close_trade_pnl_reset")}
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              value={pnl}
              onChange={(e) => { setPnl(e.target.value); setPnlTouched(true); update("pnl"); }}
              className={`${inputClass} ${errors.pnl ? "!border-loss" : ""} ${isFinite(pnlNum) ? (pnlPositive ? "text-profit" : "text-loss") : ""}`}
            />
            <p className="text-[11px] text-muted mt-1">{t("close_trade_pnl_hint")}</p>
            {errors.pnl && <p className="text-loss text-xs mt-1">{errors.pnl}</p>}
          </div>

          {/* Existing notes (read-only display) */}
          {trade.notes && trade.notes.trim() && (
            <div>
              <p className="text-xs text-muted mb-1">{t("close_trade_existing_notes")}</p>
              <div className="bg-surface border border-border rounded-lg p-2 text-xs text-foreground whitespace-pre-wrap max-h-20 overflow-y-auto">
                {trade.notes}
              </div>
            </div>
          )}

          {/* Closing notes (new) */}
          <div>
            <label className="block text-xs text-muted mb-1">
              {t("close_trade_closing_notes")} <span className="text-muted opacity-60">({t("close_trade_optional")})</span>
            </label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={2}
              placeholder={t("close_trade_closing_notes_placeholder")}
              className={inputClass}
            />
          </div>
        </div>

        {saveError && <p className="text-loss text-sm mt-3">{saveError}</p>}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-accent text-on-accent rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "..." : t("close_trade_confirm")}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 bg-surface border border-border text-foreground rounded-lg text-sm hover:bg-border transition-colors disabled:opacity-50"
          >
            {t("close_trade_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
