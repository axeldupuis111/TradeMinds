"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface Props {
  pairs: string[];
  strategyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

export default function ManualTradeModal({
  pairs,
  strategyId,
  onClose,
  onSaved,
}: Props) {
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
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError(null);

    if (!form.pair || !form.entry_price || !form.pnl) {
      setError("Paire, prix d'entrée et P&L sont requis.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Non connecté.");
      setSaving(false);
      return;
    }

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
    });

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Ajouter un trade
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">Ouverture</label>
              <input
                type="datetime-local"
                value={form.open_time}
                onChange={(e) => update("open_time", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Fermeture</label>
              <input
                type="datetime-local"
                value={form.close_time}
                onChange={(e) => update("close_time", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">Paire</label>
              <select
                value={form.pair}
                onChange={(e) => update("pair", e.target.value)}
                className={inputClass}
              >
                {pairs.length > 0 ? (
                  pairs.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))
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
              <label className="block text-sm text-muted mb-1">Direction</label>
              <select
                value={form.direction}
                onChange={(e) => update("direction", e.target.value)}
                className={inputClass}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">Lot</label>
              <input
                type="number"
                step="0.01"
                value={form.lot_size}
                onChange={(e) => update("lot_size", e.target.value)}
                placeholder="0.10"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Entrée</label>
              <input
                type="number"
                step="any"
                value={form.entry_price}
                onChange={(e) => update("entry_price", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Sortie</label>
              <input
                type="number"
                step="any"
                value={form.exit_price}
                onChange={(e) => update("exit_price", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1">SL</label>
              <input
                type="number"
                step="any"
                value={form.sl}
                onChange={(e) => update("sl", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">TP</label>
              <input
                type="number"
                step="any"
                value={form.tp}
                onChange={(e) => update("tp", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">P&L</label>
              <input
                type="number"
                step="any"
                value={form.pnl}
                onChange={(e) => update("pnl", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Contexte du trade, émotions, respect de la stratégie…"
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-foreground rounded-lg hover:bg-[#2a2a2a] transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
