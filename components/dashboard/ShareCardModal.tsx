"use client";

/**
 * ShareCardModal — carte de performance hebdo exportable en image PNG.
 *
 * Rendu avec des couleurs hex inline (indépendant du thème) pour un export
 * html2canvas fiable. Téléchargement PNG @2x + copie presse-papiers.
 * Toggle confidentialité pour masquer les montants en euros.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { Activity, Check, Copy, Download, Eye, EyeOff, X } from "lucide-react";
import { useRef, useState } from "react";

export interface ShareStats {
  pnl: number;
  count: number;
  winrate: number | null;
  profitFactor: number | null;
  best: { pnl: number; pair: string } | null;
}

function fmtEur(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "0€";
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}€`;
}

/** Lundi de la semaine courante (heure locale). */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

const GREEN = "#34d399";
const RED = "#f87171";
const MUTED = "#8b98ad";
const FG = "#eef2f8";

export default function ShareCardModal({ stats, onClose }: { stats: ShareStats; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const monday = mondayOf(new Date());
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const dateRange = `${monday.toLocaleDateString(lang, { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })}`;

  const pnlPositive = stats.pnl >= 0;
  const pnlDisplay = hideAmounts ? "•••" : fmtEur(stats.pnl);

  async function renderCanvas(): Promise<HTMLCanvasElement | null> {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: null,
      logging: false,
    });
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `tradediscipline-week-${monday.toISOString().split("T")[0]}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers image non supporté (Safari/permissions) — fallback silencieux
    } finally {
      setBusy(false);
    }
  }

  const miniStats: { label: string; value: string }[] = [
    { label: t("recap_trades"), value: String(stats.count) },
    { label: t("recap_winrate"), value: stats.winrate !== null ? `${Math.round(stats.winrate)}%` : "—" },
    { label: t("recap_profit_factor"), value: stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[640px] bg-card border border-border rounded-2xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t("share_modal_title")}</h3>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label={t("cmdk_hint_close")}
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Carte exportée — couleurs hex inline, indépendantes du thème */}
        <div className="overflow-x-auto rounded-2xl">
          <div
            ref={cardRef}
            style={{
              width: 560,
              padding: 32,
              background: "linear-gradient(155deg, #0a0e18 0%, #0e1626 55%, #0a1220 100%)",
              border: "1px solid #1e293b",
              borderRadius: 20,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {/* Brand + dates */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 7, background: "rgba(0,229,208,0.14)",
                  }}
                >
                  <Activity style={{ width: 14, height: 14, color: "#00e5d0" }} strokeWidth={2} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: FG, letterSpacing: "-0.01em" }}>
                  TradeDiscipline
                </span>
              </div>
              <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{dateRange}</span>
            </div>

            {/* P&L principal */}
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", margin: 0 }}>
              {t("recap_pnl")} — {t("recap_title")}
            </p>
            <p
              style={{
                fontSize: 46, fontWeight: 900, lineHeight: 1.15, margin: "6px 0 22px",
                color: pnlPositive ? GREEN : RED, fontVariantNumeric: "tabular-nums",
                textShadow: pnlPositive ? "0 0 32px rgba(52,211,153,0.35)" : "0 0 32px rgba(248,113,113,0.3)",
              }}
            >
              {pnlDisplay}
            </p>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {miniStats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 12,
                    background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", margin: 0 }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: FG, margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Best trade + watermark */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: MUTED }}>
                {stats.best && (
                  <>
                    {t("recap_best_trade")}{" "}
                    <span style={{ color: FG, fontWeight: 600 }}>{stats.best.pair}</span>{" "}
                    <span style={{ color: stats.best.pnl >= 0 ? GREEN : RED, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {hideAmounts ? "•••" : fmtEur(stats.best.pnl)}
                    </span>
                  </>
                )}
              </span>
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>tradediscipline.app</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("share_download")}
          </button>
          <button
            onClick={handleCopy}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-surface border border-border text-foreground text-xs font-medium hover:bg-border/60 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-profit" strokeWidth={1.75} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />}
            {copied ? t("share_copied") : t("share_copy")}
          </button>
          <button
            onClick={() => setHideAmounts((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-foreground-muted hover:text-foreground transition-colors ml-auto"
          >
            {hideAmounts ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />}
            {t("share_hide_amounts")}
          </button>
        </div>
      </div>
    </div>
  );
}
