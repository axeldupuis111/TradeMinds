"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useState } from "react";

type Platform = "mt5" | "mt4" | "ctrader" | "binance" | "bybit" | "tradingview" | "other";

interface PlatformConfig {
  id: Platform;
  label: string;
  steps: number;
  /** show the "no conversion needed" green note */
  showNote?: boolean;
}

const PLATFORMS: PlatformConfig[] = [
  { id: "mt5",         label: "MT5",          steps: 4, showNote: true },
  { id: "mt4",         label: "MT4",          steps: 4 },
  { id: "ctrader",     label: "cTrader",      steps: 3 },
  { id: "binance",     label: "Binance",      steps: 3 },
  { id: "bybit",       label: "Bybit",        steps: 3 },
  { id: "tradingview", label: "TradingView",  steps: 3 },
  { id: "other",       label: "Autre",        steps: 4 },
];

interface Props {
  onClose: () => void;
}

export default function ExportGuideModal({ onClose }: Props) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState<Platform>("mt5");

  const current = PLATFORMS.find((p) => p.id === platform)!;
  const steps = Array.from({ length: current.steps }, (_, i) => t(`guide_${platform}_step${i + 1}`));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("guide_title")}</h2>
            <p className="text-muted text-sm mt-1">{t("guide_subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors ml-4 shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform tabs — 2 rows of scrollable badges */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                platform === p.id
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface border-border text-muted hover:text-foreground hover:border-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <ol className="space-y-3">
          {steps.map((text, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm text-foreground leading-relaxed pt-0.5">{text}</p>
            </li>
          ))}
        </ol>

        {/* Green note (MT5 only) */}
        {current.showNote && (
          <div className="mt-5 p-3 rounded-lg bg-profit/5 border border-profit/20 flex items-start gap-2">
            <svg className="w-5 h-5 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-profit">{t("guide_no_convert")}</p>
          </div>
        )}

        {/* Template hint (Other platform) */}
        {platform === "other" && (
          <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-2">
            <svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-accent">{t("csv_template_hint")}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {t("guide_got_it")}
        </button>
      </div>
    </div>
  );
}
