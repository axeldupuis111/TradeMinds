"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useState } from "react";

interface Props {
  onClose: () => void;
}

export default function ExportGuideModal({ onClose }: Props) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState<"mt5" | "mt4">("mt5");

  const steps = [1, 2, 3, 4].map((n) => t(`guide_${platform}_step${n}`));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("guide_title")}</h2>
            <p className="text-muted text-sm mt-1">{t("guide_subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform switcher */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setPlatform("mt5")}
            className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
              platform === "mt5"
                ? "bg-accent/10 border-accent text-accent"
                : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"
            }`}
          >
            MT5
          </button>
          <button
            onClick={() => setPlatform("mt4")}
            className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
              platform === "mt4"
                ? "bg-accent/10 border-accent text-accent"
                : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"
            }`}
          >
            MT4
          </button>
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

        {/* Reassuring note */}
        <div className="mt-5 p-3 rounded-lg bg-profit/5 border border-profit/20 flex items-start gap-2">
          <svg className="w-5 h-5 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-profit">{t("guide_no_convert")}</p>
        </div>

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
