"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useState } from "react";
import SyncGuide from "./SyncGuide";

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
  const [copied, setCopied] = useState(false);

  // Toujours www : les EA/cBots postent sur ce même hôte en dur, et une
  // éventuelle redirection de domaine casserait le POST (voir incident 405).
  const webhookUrl = token
    ? `https://www.tradediscipline.app/api/sync/tradingview?token=${token}`
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

      <SyncGuide platform="tradingview" title={t("sync_tv_guide_title")} />
    </section>
  );
}
