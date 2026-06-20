"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, ThumbsUp, Target, Compass } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Stats {
  trades: number;
  winRate: number;
  totalPnl: number;
  sessions: number;
  avgDisciplineScore: number | null;
  tradingDays: number;
}
interface Deltas {
  trades: number;
  winRate: number;
  sessions: number;
  avgDisciplineScore: number | null;
  tradingDays: number;
}
interface Review {
  headline: string;
  strength: string;
  improvement: string;
  focus: string;
}

export default function MonthlyReviewPage() {
  const { t, lang } = useLanguage();
  const { plan } = usePlan();
  const isPaid = plan === "plus" || plan === "premium";
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deltas, setDeltas] = useState<Deltas | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rawSummary, setRawSummary] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/monthly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      const data = await res.json();
      setStats(data.stats ?? null);
      setDeltas(data.deltas ?? null);
      setReview(data.review ?? null);
      setRawSummary(data.rawSummary ?? null);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">{t("review_title")}</h1>
      <p className="text-muted mt-1">{t("review_subtitle")}</p>

      {!isPaid ? (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-foreground font-medium">{t("review_locked")}</p>
          <Link href="/dashboard/upgrade" className="inline-block mt-3 text-sm text-accent hover:underline">
            {t("upsell_banner_cta")}
          </Link>
        </div>
      ) : (
        <>
          {!generated && (
            <button
              onClick={generate}
              disabled={loading}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" strokeWidth={2} />
              {loading ? t("review_generating") : t("review_generate")}
            </button>
          )}

          {stats && (
            <>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Kpi label={t("review_kpi_trades")} value={`${stats.trades}`} delta={deltas?.trades} />
                <Kpi label={t("review_kpi_days")} value={`${stats.tradingDays}`} delta={deltas?.tradingDays} />
                <Kpi label={t("review_kpi_winrate")} value={`${stats.winRate}%`} delta={deltas?.winRate} suffix="pts" />
                <Kpi label={t("review_kpi_sessions")} value={`${stats.sessions}`} delta={deltas?.sessions} />
                <Kpi
                  label={t("review_kpi_score")}
                  value={stats.avgDisciplineScore != null ? `${stats.avgDisciplineScore}/100` : "—"}
                  delta={deltas?.avgDisciplineScore ?? undefined}
                  suffix="pts"
                />
              </div>

              {/* Bilan IA structuré */}
              {review ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                    <p className="text-base font-semibold text-foreground">{review.headline}</p>
                  </div>
                  <ReviewCard icon={<ThumbsUp className="w-4 h-4 text-profit" />} title={t("review_strength")} body={review.strength} />
                  <ReviewCard icon={<Target className="w-4 h-4 text-warning" />} title={t("review_improvement")} body={review.improvement} />
                  <ReviewCard icon={<Compass className="w-4 h-4 text-accent" />} title={t("review_focus")} body={review.focus} accent />
                </div>
              ) : rawSummary ? (
                <div className="mt-5 rounded-xl border border-border bg-card p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-2">{t("review_ai_title")}</h2>
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{rawSummary.replace(/\*\*/g, "")}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-border bg-card p-5">
                  <p className="text-sm text-muted">{t("review_ai_unavailable")}</p>
                </div>
              )}

              <button
                onClick={generate}
                disabled={loading}
                className="mt-4 text-sm text-muted hover:text-accent transition-colors disabled:opacity-50 underline underline-offset-2"
              >
                {loading ? t("review_generating") : t("review_regenerate")}
              </button>
            </>
          )}
        </>
      )}
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
        ) : (
          typeof delta === "number" && <Minus className="w-3 h-3 text-muted/40" />
        )}
      </div>
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
