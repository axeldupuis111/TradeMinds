"use client";

import SyncGuide from "./SyncGuide";
import type { SyncPlatform } from "@/lib/sync-guides";

interface Props {
  platform: SyncPlatform;
  title: string;
  desc: string;
  downloadHref: string;
  downloadLabel: string;
  tokenNote: string;
  guideTitle: string;
}

/**
 * Card for a token-based push-sync platform (cTrader cBot, NinjaTrader add-on).
 * The platform reuses the universal sync token shown in the MetaTrader section,
 * so this card only offers the download + the step-by-step guide.
 */
export default function SyncPlatformCard({
  platform,
  title,
  desc,
  downloadHref,
  downloadLabel,
  tokenNote,
  guideTitle,
}: Props) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-muted text-sm mb-4">{desc}</p>

      <a
        href={downloadHref}
        download
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {downloadLabel}
      </a>

      <p className="text-xs text-muted mt-3">{tokenNote}</p>

      <SyncGuide platform={platform} title={guideTitle} />
    </section>
  );
}
