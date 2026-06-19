"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
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

export default function MonthlyReviewPage() {
  const { t, lang } = useLanguage();
  const { plan } = usePlan();
  const isPaid = plan === "plus" || plan === "premium";
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
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
      setSummary(data.summary ?? null);
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
              className="mt-6 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? t("review_generating") : t("review_generate")}
            </button>
          )}

          {stats && (
            <>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Kpi label={t("review_kpi_trades")} value={`${stats.trades}`} />
                <Kpi label={t("review_kpi_days")} value={`${stats.tradingDays}`} />
                <Kpi label={t("review_kpi_winrate")} value={`${stats.winRate}%`} />
                <Kpi label={t("review_kpi_sessions")} value={`${stats.sessions}`} />
                <Kpi label={t("review_kpi_score")} value={stats.avgDisciplineScore != null ? `${stats.avgDisciplineScore}/100` : "—"} />
              </div>

              <div className="mt-4 rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-2">{t("review_ai_title")}</h2>
                {summary ? (
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{summary}</p>
                ) : (
                  <p className="text-sm text-muted">{t("review_ai_unavailable")}</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
