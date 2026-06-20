"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, ThumbsUp, Target, Compass } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Stats { trades: number; winRate: number; totalPnl: number; sessions: number; avgDisciplineScore: number | null; tradingDays: number }
interface Deltas { trades: number; winRate: number; sessions: number; avgDisciplineScore: number | null; tradingDays: number }
interface Extras {
  best: { date: string; pnl: number } | null;
  worst: { date: string; pnl: number } | null;
  topPair: { pair: string; count: number } | null;
  equity: number[];
  prepRate: number | null;
}
interface Review { headline: string; strength: string; improvement: string; focus: string }

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short" });
}
function fmtMoney(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = max - min || 1;
  const w = 100, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = data[data.length - 1];
  const color = last >= 0 ? "rgb(var(--profit))" : "rgb(var(--loss))";
  const zeroY = h - ((0 - min) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10">
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgb(var(--border))" strokeWidth="0.5" strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MonthlyReviewPage() {
  const { t, lang } = useLanguage();
  const { plan } = usePlan();
  const isPaid = plan === "plus" || plan === "premium";
  const [loadingStats, setLoadingStats] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deltas, setDeltas] = useState<Deltas | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rawSummary, setRawSummary] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!isPaid) { setLoadingStats(false); return; }
    try {
      const res = await fetch("/api/monthly-review");
      if (res.ok) {
        const d = await res.json();
        setStats(d.stats ?? null); setDeltas(d.deltas ?? null); setExtras(d.extras ?? null);
      }
    } finally { setLoadingStats(false); }
  }, [isPaid]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function generate() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/monthly-review", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: lang }),
      });
      const d = await res.json();
      setReview(d.review ?? null); setRawSummary(d.rawSummary ?? null);
    } finally { setAiLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("review_title")}</h1>
      <p className="text-muted mt-1">{t("review_subtitle")}</p>

      {!isPaid ? (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-foreground font-medium">{t("review_locked")}</p>
          <Link href="/dashboard/upgrade" className="inline-block mt-3 text-sm text-accent hover:underline">{t("upsell_banner_cta")}</Link>
        </div>
      ) : loadingStats ? (
        <div className="skeleton h-48 rounded-xl mt-6" />
      ) : stats && stats.trades === 0 && stats.sessions === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted text-sm">{t("review_empty")}</p>
        </div>
      ) : stats ? (
        <>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Kpi label={t("review_kpi_trades")} value={`${stats.trades}`} delta={deltas?.trades} />
            <Kpi label={t("review_kpi_days")} value={`${stats.tradingDays}`} delta={deltas?.tradingDays} />
            <Kpi label={t("review_kpi_winrate")} value={`${stats.winRate}%`} delta={deltas?.winRate} suffix="pts" />
            <Kpi label={t("review_kpi_sessions")} value={`${stats.sessions}`} delta={deltas?.sessions} />
            <Kpi label={t("review_kpi_score")} value={stats.avgDisciplineScore != null ? `${stats.avgDisciplineScore}/100` : "—"} delta={deltas?.avgDisciplineScore ?? undefined} suffix="pts" />
            {extras?.prepRate != null && <Kpi label={t("review_kpi_prep")} value={`${extras.prepRate}%`} />}
          </div>

          {/* Courbe d'équité du mois */}
          {extras && extras.equity.length >= 2 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted mb-1">{t("review_equity_title")}</p>
              <Sparkline data={extras.equity} />
            </div>
          )}

          {/* Faits marquants */}
          {extras && (extras.best || extras.topPair) && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {extras.best && (
                <Highlight label={t("review_best_day")} value={fmtMoney(extras.best.pnl)} sub={fmtDate(extras.best.date, lang)} positive />
              )}
              {extras.worst && extras.worst.pnl < 0 && (
                <Highlight label={t("review_worst_day")} value={fmtMoney(extras.worst.pnl)} sub={fmtDate(extras.worst.date, lang)} />
              )}
              {extras.topPair && (
                <Highlight label={t("review_top_pair")} value={extras.topPair.pair} sub={`${extras.topPair.count} ${t("review_kpi_trades").toLowerCase()}`} />
              )}
            </div>
          )}

          {/* Bilan IA */}
          {review ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                <p className="text-base font-semibold text-foreground">{review.headline}</p>
              </div>
              <ReviewCard icon={<ThumbsUp className="w-4 h-4 text-profit" />} title={t("review_strength")} body={review.strength} />
              <ReviewCard icon={<Target className="w-4 h-4 text-warning" />} title={t("review_improvement")} body={review.improvement} />
              <ReviewCard icon={<Compass className="w-4 h-4 text-accent" />} title={t("review_focus")} body={review.focus} accent />
              <button onClick={generate} disabled={aiLoading} className="text-sm text-muted hover:text-accent transition-colors disabled:opacity-50 underline underline-offset-2">
                {aiLoading ? t("review_generating") : t("review_regenerate")}
              </button>
            </div>
          ) : rawSummary ? (
            <div className="mt-5 rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{rawSummary.replace(/\*\*/g, "")}</p>
            </div>
          ) : (
            <button onClick={generate} disabled={aiLoading}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {aiLoading ? t("review_generating") : t("review_generate")}
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, delta, suffix }: { label: string; value: string; delta?: number; suffix?: string }) {
  const showDelta = typeof delta === "number" && delta !== 0;
  const positive = (delta ?? 0) > 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-xl font-bold text-foreground">{value}</p>
        {showDelta ? (
          <span className={`inline-flex items-center text-xs font-medium ${positive ? "text-profit" : "text-loss"}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta as number)}{suffix ? ` ${suffix}` : ""}
          </span>
        ) : (typeof delta === "number" && <Minus className="w-3 h-3 text-muted/40" />)}
      </div>
    </div>
  );
}

function Highlight({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-base font-bold mt-1 ${positive ? "text-profit" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted/70">{sub}</p>
    </div>
  );
}

function ReviewCard({ icon, title, body, accent }: { icon: React.ReactNode; title: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-accent/30 bg-accent/[0.03]" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}
