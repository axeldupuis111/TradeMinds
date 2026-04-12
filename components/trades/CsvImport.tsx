"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { parseCSV, type ParsedTrade } from "@/lib/csv-parser";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

interface ActiveAccount {
  id: string;
  firm: string;
  account_number: string | null;
  account_size: number;
}

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

  // Account matching state
  const [detectedAccountNumber, setDetectedAccountNumber] = useState<string | null>(null);
  const [matchedChallengeId, setMatchedChallengeId] = useState<string | null>(null);
  const [matchedLabel, setMatchedLabel] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [activeAccounts, setActiveAccounts] = useState<ActiveAccount[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

  // Load active accounts on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("prop_challenges")
        .select("id, firm, account_number, account_size")
        .eq("user_id", user.id)
        .eq("status", "active");
      setActiveAccounts(data || []);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback(async (file: File) => {
    setMessage(null);
    setDetectedAccountNumber(null);
    setMatchedChallengeId(null);
    setMatchedLabel(null);
    setAccountNotFound(false);
    setSelectedChallengeId(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);

      if (result.trades.length === 0) {
        setMessage({ type: "error", text: t("csv_no_trades") });
        return;
      }

      setPreview(result.trades);

      // Auto-match account number (client-side partial matching)
      if (result.accountNumber) {
        setDetectedAccountNumber(result.accountNumber);
        const csvNum = result.accountNumber.replace(/\D/g, "");

        console.log("[CsvImport] CSV account number (cleaned):", JSON.stringify(csvNum));
        console.log("[CsvImport] Active accounts:", activeAccounts.map(a => ({ id: a.id, firm: a.firm, account_number: a.account_number })));

        // Partial match: CSV number contains stored number, or stored number contains CSV number
        const matched = activeAccounts.find((a) => {
          if (!a.account_number) return false;
          const storedNum = a.account_number.replace(/\D/g, "");
          return storedNum === csvNum || csvNum.includes(storedNum) || storedNum.includes(csvNum);
        });

        console.log("[CsvImport] Match result:", matched ? `${matched.firm} — ${matched.account_number}` : "no match");

        if (matched) {
          setMatchedChallengeId(matched.id);
          setMatchedLabel(`${matched.firm} — ${matched.account_number}`);
        } else {
          setAccountNotFound(true);
        }
      }
    };
    reader.readAsText(file);
  }, [t, activeAccounts]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: "error", text: t("not_connected") });
      setImporting(false);
      return;
    }

    // Determine which challenge_id to use
    const challengeId = matchedChallengeId || selectedChallengeId || null;

    const rows = preview.map((tr) => ({
      user_id: user.id,
      strategy_id: strategyId,
      challenge_id: challengeId,
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
      setDetectedAccountNumber(null);
      setMatchedChallengeId(null);
      setMatchedLabel(null);
      setAccountNotFound(false);
      setSelectedChallengeId(null);
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
          {/* Account matching info */}
          {detectedAccountNumber && (
            <div className="mb-4 p-3 rounded-lg border border-[#2a2a2a] bg-[#141414]">
              <p className="text-sm text-muted">
                {t("csv_account_detected")} <span className="text-foreground font-medium">{detectedAccountNumber}</span>
              </p>
              {matchedLabel && (
                <p className="text-sm text-profit mt-1">
                  {t("csv_account_matched")} <span className="font-medium">{matchedLabel}</span>
                </p>
              )}
              {accountNotFound && (
                <p className="text-sm text-orange-400 mt-1">
                  {t("csv_account_not_found")} {detectedAccountNumber}. {t("csv_account_not_found_hint")}
                </p>
              )}
            </div>
          )}

          {/* Manual account selector (when no account detected from CSV) */}
          {!detectedAccountNumber && activeAccounts.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-muted mb-1">{t("csv_select_account")}</label>
              <select
                value={selectedChallengeId || ""}
                onChange={(e) => setSelectedChallengeId(e.target.value || null)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                <option value="">{t("csv_no_account")}</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firm} — {a.account_number || a.account_size.toLocaleString() + "€"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview table */}
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
              onClick={() => { setPreview([]); setDetectedAccountNumber(null); setMatchedChallengeId(null); setAccountNotFound(false); }}
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
