"use client";

import { useState } from "react";

interface Props {
  title: string;
  desc: string;
  downloadHref: string;
  downloadLabel: string;
  tokenNote: string;
  guideTitle: string;
  steps: string[];
  tip?: string;
}

/**
 * Collapsible card for a token-based push-sync platform (cTrader cBot,
 * NinjaTrader add-on). The platform reuses the universal sync token shown in
 * the MetaTrader section, so this card only offers the download + a guide.
 */
export default function SyncPlatformCard({
  title,
  desc,
  downloadHref,
  downloadLabel,
  tokenNote,
  guideTitle,
  steps,
  tip,
}: Props) {
  const [open, setOpen] = useState(false);

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

      <div className="mt-4 bg-surface border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        >
          <span className="text-foreground font-medium text-sm">{guideTitle}</span>
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
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {tip && (
              <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-sm text-muted leading-relaxed">{tip}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
