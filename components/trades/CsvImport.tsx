"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { parseCSV, type ParsedTrade } from "@/lib/csv-parser";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useRef, useState } from "react";

interface Props {
  strategyId: string | null;
  onImported: () => void;
}

export default function CsvImport({ strategyId, onImported }: Props) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<ParsedTrade[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFile = useCallback((file: File) => {
    setMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const trades = parseCSV(text);
      if (trades.length === 0) {
        setMessage({ type: "error", text: t("csv_no_trades") });
        return;
      }
      setPreview(trades);
    };
    reader.readAsText(file);
  }, [t]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    setImporting(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: "error", text: t("not_connected") });
      setImporting(false);
      return;
    }

    const rows = preview.map((tr) => ({
      user_id: user.id,
      strategy_id: strategyId,
      open_time: tr.open_time || null,
      close_time: tr.close_time || null,
      pair: tr.pair,
      direction: tr.direction,
      lot_size: tr.lot_size,
      entry_price: tr.entry_price,
      exit_price: tr.exit_price,
      sl: tr.sl,
      tp: tr.tp,
      commission: tr.commission,
      swap: tr.swap,
      pnl: tr.pnl,
    }));

    const { error } = await supabase.from("trades").insert(rows);
    setImporting(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: `${rows.length} ${t("csv_imported")}` });
      setPreview([]);
      onImported();
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{t("csv_title")}</h2>
      <div className="h-px bg-[#1e1e1e] mt-2 mb-4" />

      {preview.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-accent bg-accent/5" : "border-[#2a2a2a] hover:border-accent/50"
          }`}
        >
          <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-foreground font-medium">{t("csv_drop_title")}</p>
          <p className="text-muted text-sm mt-1">{t("csv_drop_sub")}</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileInput} className="hidden" />
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto rounded-lg border border-[#1e1e1e]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#141414] text-muted text-left">
                  <th className="px-3 py-2 font-medium">{t("trades_col_date")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_pair")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_dir")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_lot")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_entry")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_exit")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_pnl")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((tr, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#141414]"}>
                    <td className="px-3 py-2 text-foreground">{tr.open_time}</td>
                    <td className="px-3 py-2 text-foreground">{tr.pair}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tr.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                        {tr.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{tr.lot_size}</td>
                    <td className="px-3 py-2 text-foreground">{tr.entry_price}</td>
                    <td className="px-3 py-2 text-foreground">{tr.exit_price}</td>
                    {(() => {
                      const net = tr.pnl + (tr.commission || 0) + (tr.swap || 0);
                      return (
                        <td className={`px-3 py-2 font-medium ${net >= 0 ? "text-profit" : "text-loss"}`}>
                          {net >= 0 ? "+" : ""}{net.toFixed(2)}
                        </td>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {importing ? t("csv_importing") : `${t("csv_import_btn")} ${preview.length} trades`}
            </button>
            <button
              onClick={() => setPreview([])}
              className="px-5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-foreground rounded-lg hover:bg-[#2a2a2a] transition-colors"
            >
              {t("csv_cancel")}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm mt-3 ${message.type === "success" ? "text-profit" : "text-loss"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
