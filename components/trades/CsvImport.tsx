"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
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
  const { plan } = usePlan();
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

  // Free plan import cooldown
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [importCooldownLoading, setImportCooldownLoading] = useState(true);

  // Load active accounts + last import date on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setImportCooldownLoading(false); return; }

      const [{ data: accounts }, { data: profile }] = await Promise.all([
        supabase
          .from("prop_challenges")
          .select("id, firm, account_number, account_size")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("last_import_at")
          .eq("id", user.id)
          .single(),
      ]);

      setActiveAccounts(accounts || []);
      setLastImportAt(profile?.last_import_at || null);
      setImportCooldownLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute cooldown for free plan
  const now = new Date();
  const lastImportDate = lastImportAt ? new Date(lastImportAt) : null;
  const cooldownEnd = lastImportDate ? new Date(lastImportDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const isCooldownActive = plan === "free" && cooldownEnd !== null && cooldownEnd > now;
  const nextImportDate = cooldownEnd
    ? cooldownEnd.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

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
          setSelectedChallengeId(matched.id);
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

    const challengeId = selectedChallengeId || null;

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
      // Update last_import_at for free plan cooldown
      const nowIso = new Date().toISOString();
      await supabase.from("profiles").upsert({ id: user.id, last_import_at: nowIso });
      setLastImportAt(nowIso);

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

      {/* Free plan cooldown banner */}
      {!importCooldownLoading && isCooldownActive && (
        <div className="mb-4 p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 flex items-start gap-3">
          <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-foreground">{t("csv_free_cooldown").replace("{date}", nextImportDate || "")}</p>
            <a href="/dashboard/upgrade" className="text-sm text-accent font-medium hover:underline mt-1 inline-block">{t("plan_upgrade_btn")}</a>
          </div>
        </div>
      )}

      {preview.length === 0 ? (
        <div
          onDragOver={(e) => { if (!isCooldownActive) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { if (!isCooldownActive) handleDrop(e); else e.preventDefault(); }}
          onClick={() => { if (!isCooldownActive) fileRef.current?.click(); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isCooldownActive
              ? "border-[#2a2a2a] opacity-50 cursor-not-allowed"
              : dragOver
                ? "border-accent bg-accent/5 cursor-pointer"
                : "border-[#2a2a2a] hover:border-accent/50 cursor-pointer"
          }`}
        >
          <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-foreground font-medium">{t("csv_drop_title")}</p>
          <p className="text-muted text-sm mt-1">{t("csv_drop_sub")}</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileInput} disabled={isCooldownActive} className="hidden" />
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

          {/* Account selector (always shown when accounts exist) */}
          {activeAccounts.length > 0 && (
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
              {!selectedChallengeId && !matchedChallengeId && (
                <p className="text-sm text-orange-400 mt-1">{t("csv_select_account_hint")}</p>
              )}
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
              disabled={importing || (activeAccounts.length > 0 && !selectedChallengeId)}
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
