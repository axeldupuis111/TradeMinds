"use client";

import ExportGuideModal from "@/components/trades/ExportGuideModal";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { applyManualMapping, parseCSV, parseXlsx, type ParsedTrade } from "@/lib/csv-parser";
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

// ─── Supported platforms badge list ──────────────────────────────────────────

const PLATFORMS = [
  "MetaTrader 5", "MetaTrader 4", "cTrader", "TradeLocker",
  "Bybit", "Binance", "Bitget", "OKX", "KuCoin", "MEXC",
  "Exness", "Blofin", "TradingView",
];

// ─── Column mapping field definitions ────────────────────────────────────────

type MappableField = "open_time" | "close_time" | "pair" | "direction" | "lot_size" | "entry_price" | "exit_price" | "pnl" | "sl" | "tp" | "commission" | "swap";

const MAPPING_FIELDS: { key: MappableField; labelKey: string; required: boolean }[] = [
  { key: "pair",        labelKey: "csv_col_pair",        required: true },
  { key: "direction",   labelKey: "csv_col_direction",   required: true },
  { key: "pnl",        labelKey: "csv_col_pnl",         required: true },
  { key: "open_time",  labelKey: "csv_col_open_time",   required: false },
  { key: "close_time", labelKey: "csv_col_close_time",  required: false },
  { key: "lot_size",   labelKey: "csv_col_lot",         required: false },
  { key: "entry_price",labelKey: "csv_col_entry",       required: false },
  { key: "exit_price", labelKey: "csv_col_exit",        required: false },
  { key: "sl",         labelKey: "csv_col_sl",          required: false },
  { key: "tp",         labelKey: "csv_col_tp",          required: false },
  { key: "commission", labelKey: "csv_col_commission",  required: false },
  { key: "swap",       labelKey: "csv_col_swap",        required: false },
];

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const header = "Date,Pair,Direction,Lot,Entry,Exit,SL,TP,PnL,Commission,Notes";
  const example = "2024-01-15 10:00,EURUSD,long,0.10,1.1000,1.1050,1.0950,1.1100,50,,";
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "TradeDiscipline_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Column Mapping Modal ─────────────────────────────────────────────────────

function ColumnMappingModal({
  rawHeaders,
  rawRows,
  onApply,
  onCancel,
  t,
}: {
  rawHeaders: string[];
  rawRows: Record<string, string>[];
  onApply: (trades: ParsedTrade[]) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [mapping, setMapping] = useState<Partial<Record<MappableField, string>>>({});

  const mandatoryMapped = MAPPING_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  function handleApply() {
    const trades = applyManualMapping(rawHeaders, rawRows, mapping);
    onApply(trades);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-card border border-border rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold text-foreground">{t("csv_mapping_title")}</h2>
          <button onClick={onCancel} className="text-muted hover:text-foreground ml-4 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-muted text-xs mb-4">{t("csv_mapping_subtitle")}</p>

        <div className="space-y-2.5">
          {MAPPING_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <label className={`text-xs w-44 shrink-0 ${f.required ? "text-foreground font-medium" : "text-muted"}`}>
                {t(f.labelKey)}
              </label>
              <select
                value={mapping[f.key] || ""}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                className="flex-1 px-2 py-1.5 bg-surface border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                <option value="">{t("csv_col_ignore")}</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Preview first row */}
        {rawRows.length > 0 && (
          <div className="mt-4 p-3 bg-background rounded-lg border border-border">
            <p className="text-[10px] text-muted mb-1.5">Aperçu ligne 1 :</p>
            <div className="text-[10px] text-foreground space-y-0.5 overflow-hidden">
              {Object.entries(rawRows[0]).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted shrink-0 w-28 truncate">{k}</span>
                  <span className="truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleApply}
            disabled={!mandatoryMapped}
            className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-40"
          >
            {t("csv_mapping_apply")}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-surface border border-border text-muted rounded-lg text-sm hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CsvImport component ─────────────────────────────────────────────────

export default function CsvImport({ strategyId, onImported }: Props) {
  const { t, lang } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
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

  // Daily summary
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Export guide modal
  const [showGuide, setShowGuide] = useState(false);

  // Manual column mapping modal
  const [mappingData, setMappingData] = useState<{ rawHeaders: string[]; rawRows: Record<string, string>[] } | null>(null);

  // Load active accounts + last import date on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setImportCooldownLoading(false); return; }

      const [{ data: accounts }, { data: profile }] = await Promise.all([
        supabase.from("prop_challenges").select("id, firm, account_number, account_size").eq("user_id", user.id).eq("status", "active"),
        supabase.from("profiles").select("last_import_at").eq("id", user.id).single(),
      ]);

      setActiveAccounts(accounts || []);
      setLastImportAt(profile?.last_import_at || null);
      setImportCooldownLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const lastImportDate = lastImportAt ? new Date(lastImportAt) : null;
  const cooldownEnd = lastImportDate ? new Date(lastImportDate.getTime() + 24 * 60 * 60 * 1000) : null;
  const isCooldownActive = !planLoading && plan === "free" && cooldownEnd !== null && cooldownEnd > now;
  const nextImportDate = cooldownEnd
    ? cooldownEnd.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  const applyResult = useCallback((result: { trades: ParsedTrade[]; accountNumber: string | null; needsMapping?: boolean; rawHeaders?: string[]; rawRows?: Record<string, string>[] }) => {
    // Needs manual mapping?
    if (result.needsMapping && result.rawHeaders && result.rawRows) {
      setMappingData({ rawHeaders: result.rawHeaders, rawRows: result.rawRows });
      return;
    }

    if (result.trades.length === 0) {
      setMessage({ type: "error", text: t("csv_no_trades") });
      return;
    }

    setPreview(result.trades);

    if (result.accountNumber) {
      setDetectedAccountNumber(result.accountNumber);
      const csvNum = result.accountNumber.replace(/\D/g, "");
      const matched = activeAccounts.find((a) => {
        if (!a.account_number) return false;
        const storedNum = a.account_number.replace(/\D/g, "");
        return storedNum === csvNum || csvNum.includes(storedNum) || storedNum.includes(csvNum);
      });
      if (matched) {
        setMatchedChallengeId(matched.id);
        setSelectedChallengeId(matched.id);
        setMatchedLabel(`${matched.firm} — ${matched.account_number}`);
      } else {
        setAccountNotFound(true);
      }
    }
  }, [t, activeAccounts]);

  const handleFile = useCallback(async (file: File) => {
    setMessage(null);
    setDetectedAccountNumber(null);
    setMatchedChallengeId(null);
    setMatchedLabel(null);
    setAccountNotFound(false);
    setSelectedChallengeId(null);
    setMappingData(null);

    const isXlsx = /\.xlsx$/i.test(file.name);
    if (isXlsx) {
      try {
        const buf = await file.arrayBuffer();
        const result = await parseXlsx(buf);
        applyResult(result);
      } catch (err) {
        console.error("[CsvImport] XLSX parse error", err);
        setMessage({ type: "error", text: t("csv_no_trades") });
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = parseCSV(text);
        applyResult(result);
      };
      reader.readAsText(file);
    }
  }, [t, applyResult]);

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

  function handleMappingApply(trades: ParsedTrade[]) {
    setMappingData(null);
    if (trades.length === 0) {
      setMessage({ type: "error", text: t("csv_no_trades") });
      return;
    }
    setPreview(trades);
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
      const importedTrades = preview.map((tr) => ({
        open_time: tr.open_time,
        pair: tr.pair,
        direction: tr.direction,
        pnl: tr.pnl,
        commission: tr.commission,
        swap: tr.swap,
      }));

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

      // Generate daily summary for Plus
      if (plan === "plus" || plan === "premium") {
        setSummaryLoading(true);
        try {
          const { data: strat } = await supabase.from("strategies").select("name").eq("user_id", user.id).limit(1).single();
          const res = await fetch("/api/daily-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trades: importedTrades, strategyName: strat?.name || null, language: lang }),
          });
          const data = await res.json();
          if (res.ok && data.summary) setDailySummary(data.summary);
        } catch {
          // Silent fail
        } finally {
          setSummaryLoading(false);
        }
      }
    }
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">{t("csv_title")}</h2>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="text-sm text-accent hover:underline inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("csv_guide_btn")}
        </button>
      </div>
      <div className="h-px bg-border mt-2 mb-4" />

      {showGuide && <ExportGuideModal onClose={() => setShowGuide(false)} />}

      {/* Manual column mapping modal */}
      {mappingData && (
        <ColumnMappingModal
          rawHeaders={mappingData.rawHeaders}
          rawRows={mappingData.rawRows}
          onApply={handleMappingApply}
          onCancel={() => setMappingData(null)}
          t={t}
        />
      )}

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
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { if (!isCooldownActive) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { if (!isCooldownActive) handleDrop(e); else e.preventDefault(); }}
            onClick={() => { if (!isCooldownActive) fileRef.current?.click(); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isCooldownActive
                ? "border-border opacity-50 cursor-not-allowed"
                : dragOver
                  ? "border-accent bg-accent/5 cursor-pointer"
                  : "border-border hover:border-accent/50 cursor-pointer"
            }`}
          >
            <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-foreground font-medium">{t("csv_drop_title")}</p>
            <p className="text-muted text-sm mt-1">{t("csv_drop_sub")}</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleFileInput} disabled={isCooldownActive} className="hidden" />
          </div>

          {/* Supported platforms */}
          <div>
            <p className="text-xs text-muted mb-2">{t("csv_compatible_with")}</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-muted border border-border bg-surface whitespace-nowrap"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Template download */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("csv_download_template")}
            </button>
            <span className="text-[#333] select-none">·</span>
            <span className="text-xs text-muted">{t("csv_template_hint")}</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Account matching info */}
          {detectedAccountNumber && (
            <div className="mb-4 p-3 rounded-lg border border-border bg-surface">
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

          {/* Account selector */}
          {activeAccounts.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-muted mb-1">{t("csv_select_account")}</label>
              <select
                value={selectedChallengeId || ""}
                onChange={(e) => setSelectedChallengeId(e.target.value || null)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-muted text-left">
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
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-surface"}>
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
              className="px-5 py-2 bg-surface border border-border text-foreground rounded-lg hover:bg-border transition-colors"
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

      {/* Daily summary */}
      {summaryLoading && (
        <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">{t("summary_generating")}</p>
        </div>
      )}
      {dailySummary && !summaryLoading && (
        <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium text-accent">{t("summary_title")}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{dailySummary}</p>
          <button onClick={() => setDailySummary(null)} className="text-xs text-muted hover:text-foreground mt-2 transition-colors">
            {t("summary_dismiss")}
          </button>
        </div>
      )}
    </section>
  );
}
