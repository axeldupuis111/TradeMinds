"use client";

/**
 * ShareRankModal — carte de rang/palier du classement exportable en PNG.
 *
 * Même approche que ShareCardModal : couleurs hex inline (indépendant du
 * thème) pour un export html2canvas fiable, téléchargement @2x + copie
 * presse-papiers, portal vers document.body.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { Activity, Check, Copy, Download, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ShareRankStats {
  score: number;
  sessions: number;
  streak: number;
  rank: number | null;
  total: number;
  percentile: number | null;
  tierKey: string;
  tierEmoji: string;
  days: number;
}

const MUTED = "#8b98ad";
const FG = "#eef2f8";

function scoreHex(s: number): string {
  if (s >= 85) return "#34d399";
  if (s >= 70) return "#4ade80";
  if (s >= 50) return "#fbbf24";
  return "#f87171";
}

export default function ShareRankModal({ stats, onClose }: { stats: ShareRankStats; onClose: () => void }) {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function renderCanvas(): Promise<HTMLCanvasElement | null> {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, { scale: 2, backgroundColor: null, logging: false });
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `tradediscipline-rank-${new Date().toISOString().split("T")[0]}.png`;
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

  const color = scoreHex(stats.score);
  const miniStats: { label: string; value: string }[] = [
    { label: t("leaderboard_stat_sessions"), value: String(stats.sessions) },
    { label: t("leaderboard_stat_streak"), value: `🔥 ${stats.streak}` },
    { label: t("leaderboard_share_period"), value: t("leaderboard_days").replace("{n}", String(stats.days)) },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[560px] bg-card border border-border rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t("leaderboard_share_title")}</h3>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors" aria-label={t("cmdk_hint_close")}>
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Carte exportée — couleurs hex inline, indépendantes du thème */}
        <div className="overflow-x-auto rounded-2xl">
          <div
            ref={cardRef}
            style={{
              width: 480,
              padding: 32,
              background: "linear-gradient(155deg, #0a0e18 0%, #0e1626 55%, #0a1220 100%)",
              border: "1px solid #1e293b",
              borderRadius: 20,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 7, background: "rgba(0,229,208,0.14)" }}>
                  <Activity style={{ width: 14, height: 14, color: "#00e5d0" }} strokeWidth={2} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: FG, letterSpacing: "-0.01em" }}>TradeDiscipline</span>
              </div>
              <span style={{ fontSize: 11, color: MUTED }}>{new Date().toLocaleDateString()}</span>
            </div>

            {/* Palier + score */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 22 }}>
              <span style={{ fontSize: 54, lineHeight: 1 }}>{stats.tierEmoji}</span>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", margin: 0 }}>
                  {t(`leaderboard_tier_${stats.tierKey}`)} · {t("leaderboard_stat_score")}
                </p>
                <p style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: "4px 0 0", color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 32px ${color}55` }}>
                  {stats.score}<span style={{ fontSize: 20, color: MUTED, fontWeight: 700 }}>/100</span>
                </p>
              </div>
            </div>

            {/* Rang */}
            {stats.rank != null && (
              <p style={{ fontSize: 14, color: FG, fontWeight: 600, margin: "0 0 18px" }}>
                {t("leaderboard_share_rank").replace("{rank}", String(stats.rank)).replace("{total}", String(stats.total))}
                {stats.percentile != null && (
                  <span style={{ color: "#00e5d0", marginLeft: 8 }}>{t("leaderboard_share_top").replace("{p}", String(stats.percentile))}</span>
                )}
              </p>
            )}

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              {miniStats.map((s) => (
                <div key={s.label} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.12)" }}>
                  <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", margin: 0 }}>{s.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: FG, margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>tradediscipline.app</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={handleDownload} disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("share_download")}
          </button>
          <button onClick={handleCopy} disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-surface border border-border text-foreground text-xs font-medium hover:bg-border/60 transition-colors disabled:opacity-50">
            {copied ? <Check className="w-3.5 h-3.5 text-profit" strokeWidth={1.75} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />}
            {copied ? t("share_copied") : t("share_copy")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
