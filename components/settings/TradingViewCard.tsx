"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useState } from "react";

interface Props {
  /** Token push universel (mt_sync_token) — null tant que non généré. */
  token: string | null;
}

/**
 * Carte Réglages → TradingView : synchro par webhook d'alerte. Contrairement
 * aux autres plateformes push (fichier à installer), TradingView appelle notre
 * API directement — la carte fournit l'URL de webhook (token inclus) et le
 * snippet Pine à coller dans la stratégie.
 */
export default function TradingViewCard({ token }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = token
    ? `https://tradediscipline.app/api/sync/tradingview?token=${token}`
    : null;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-1">{t("sync_tv_title")}</h2>
      <p className="text-muted text-sm mb-4">{t("sync_tv_desc")}</p>

      {webhookUrl ? (
        <div>
          <label className="block text-xs text-muted mb-1.5">{t("sync_tv_url_label")}</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs font-mono"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-2 rounded-lg border border-accent/30 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors shrink-0"
            >
              {copied ? "✓" : t("sync_mt_copy")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("sync_tv_no_token")}</p>
      )}

      <a
        href="/TradeDiscipline_TradingView.pine"
        download
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {t("sync_tv_download")}
      </a>

      <div className="mt-4 bg-surface border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        >
          <span className="text-foreground font-medium text-sm">{t("sync_tv_guide_title")}</span>
          <svg
            className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="px-4 pb-4">
            <ol className="space-y-2.5 text-sm text-muted leading-relaxed list-decimal list-inside">
              <li>{t("sync_tv_step1")}</li>
              <li>{t("sync_tv_step2")}</li>
              <li>{t("sync_tv_step3")}</li>
              <li>{t("sync_tv_step4")}</li>
            </ol>
            <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-sm text-muted leading-relaxed">{t("sync_tv_tip")}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
