"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Violation {
  trade_date: string;
  pair: string;
  rule_violated: string;
  explanation: string;
}

interface Pattern {
  type: string;
  description: string;
  severity: "high" | "medium" | "low";
}

interface Analysis {
  discipline_score: number;
  total_trades: number;
  conforming_trades: number;
  violations: Violation[];
  patterns: Pattern[];
  strengths: string[];
  recommendations: string[];
}

interface SavedReview {
  id: string;
  created_at: string;
  discipline_score: number;
  total_trades: number;
  conforming_trades: number;
  analysis: Analysis;
}

const severityColors: Record<string, { bg: string; text: string; labelKey: string }> = {
  high: { bg: "bg-loss/10", text: "text-loss", labelKey: "severity_high" },
  medium: { bg: "bg-orange-500/10", text: "text-orange-400", labelKey: "severity_medium" },
  low: { bg: "bg-yellow-500/10", text: "text-yellow-400", labelKey: "severity_low" },
};

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 75 ? "text-profit" : score >= 50 ? "text-orange-400" : "text-loss";
  const strokeColor =
    score >= 75 ? "#22c55e" : score >= 50 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#1e1e1e"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <p className="text-muted text-sm mt-2">{label}</p>
    </div>
  );
}

export default function AnalysisPage() {
  const { t } = useLanguage();
  const { canUseAI, aiRemaining, plan, incrementAIUsage, loading: planLoading } = usePlan();
  const supabase = createClient();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedReview[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tradeCount, setTradeCount] = useState(0);
  const [hasStrategy, setHasStrategy] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);

  useEffect(() => {
    loadPrerequisites();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPrerequisites() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ count }, { data: strat }] = await Promise.all([
      supabase
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("strategies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single(),
    ]);

    setTradeCount(count || 0);
    setHasStrategy(!!strat);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setHistoryLoading(false);
      return;
    }

    const { data } = await supabase
      .from("session_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setHistory(data || []);
    setHistoryLoading(false);
  }

  async function runAnalysis() {
    setError(null);
    setAnalysis(null);
    setSaveMessage(null);
    setViewingHistory(null);
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté.");

      const [{ data: strategy }, { data: trades }] = await Promise.all([
        supabase
          .from("strategies")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .single(),
        supabase
          .from("trades")
          .select("open_time, close_time, pair, direction, lot_size, entry_price, exit_price, sl, tp, pnl, commission, swap")
          .eq("user_id", user.id)
          .order("open_time", { ascending: true }),
      ]);

      if (!strategy) throw new Error("Aucune stratégie définie.");
      if (!trades || trades.length === 0) throw new Error("Aucun trade à analyser.");

      console.log("[Analyse IA] Envoi de", trades.length, "trades vers /api/analyze (POST)");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, trades }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur.");

      setAnalysis(data);
      // Increment AI usage counter for Plus plan
      if (plan === "plus") {
        await incrementAIUsage();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function saveAnalysis() {
    if (!analysis) return;
    setSaving(true);
    setSaveMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveMessage(t("not_connected"));
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("session_reviews").insert({
      user_id: user.id,
      discipline_score: analysis.discipline_score,
      total_trades: analysis.total_trades,
      conforming_trades: analysis.conforming_trades,
      analysis,
    });

    setSaving(false);
    if (error) {
      setSaveMessage(error.message);
    } else {
      setSaveMessage(t("analysis_saved"));
      loadHistory();
    }
  }

  function viewHistoryItem(review: SavedReview) {
    setAnalysis(review.analysis);
    setViewingHistory(review.id);
    setSaveMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const displayedAnalysis = analysis;

  if (planLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">{t("analysis_title")}</h1>
        <p className="text-muted mt-2 text-sm">{t("analysis_subtitle")}</p>
        <div className="mt-6 skeleton h-10 w-48 rounded-lg" />
      </div>
    );
  }

  if (!canUseAI) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">{t("analysis_title")}</h1>
        <p className="text-muted mt-1">{t("analysis_subtitle")}</p>
        <div className="mt-6">
          <UpgradeBanner message={t("plan_analysis_locked")} />
        </div>
      </div>
    );
  }

  const aiLimitReached = plan === "plus" && aiRemaining === 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{t("analysis_title")}</h1>
      <p className="text-muted mt-1">{t("analysis_subtitle")}</p>

      {/* Launch button */}
      <div className="mt-6">
        {!hasStrategy && (
          <p className="text-loss text-sm mb-3">
            {t("analysis_no_strategy")}
          </p>
        )}
        {tradeCount === 0 && (
          <p className="text-loss text-sm mb-3">
            {t("analysis_no_trades")}
          </p>
        )}
        {aiLimitReached && (
          <p className="text-orange-400 text-sm mb-3">
            {t("plan_ai_limit_reached")}
          </p>
        )}
        <button
          onClick={runAnalysis}
          disabled={loading || !hasStrategy || tradeCount === 0 || aiLimitReached}
          className="px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {loading ? t("analysis_running") : t("analysis_run")}
        </button>
        {tradeCount > 0 && (
          <span className="text-muted text-sm ml-3">
            {tradeCount} {t("analysis_trades_count")}
          </span>
        )}
        {plan === "plus" && aiRemaining !== null && !aiLimitReached && (
          <span className="text-muted text-sm ml-3">
            ({aiRemaining} {t("plan_ai_remaining")})
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted">{t("analysis_loading")}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 text-loss text-sm">{error}</p>
      )}

      {/* Results */}
      {displayedAnalysis && !loading && (
        <div className="mt-8 space-y-8">
          {viewingHistory && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-2 text-sm text-accent">
              {t("analysis_viewing_history")}
              <button
                onClick={() => {
                  setAnalysis(null);
                  setViewingHistory(null);
                }}
                className="ml-2 underline hover:no-underline"
              >
                {t("analysis_close")}
              </button>
            </div>
          )}

          {/* Score */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreCircle score={displayedAnalysis.discipline_score} label={t("dash_discipline")} />
            <div>
              <p className="text-foreground text-lg font-semibold">
                {displayedAnalysis.conforming_trades} / {displayedAnalysis.total_trades} {t("analysis_conforming")}
              </p>
              <p className="text-muted text-sm mt-1">
                {displayedAnalysis.violations.length} {t("analysis_violations_detected")}
              </p>
            </div>
          </div>

          {/* Violations */}
          {displayedAnalysis.violations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_violations")}</h2>
              <div className="space-y-2">
                {displayedAnalysis.violations.map((v, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-lg p-4 flex gap-3"
                  >
                    <svg
                      className="w-5 h-5 text-loss shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {v.pair} — {v.trade_date}
                      </p>
                      <p className="text-loss text-sm">{v.rule_violated}</p>
                      <p className="text-muted text-sm mt-1">{v.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Patterns */}
          {displayedAnalysis.patterns.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_patterns")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedAnalysis.patterns.map((p, i) => {
                  const sev = severityColors[p.severity] || severityColors.low;
                  return (
                    <div
                      key={i}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${sev.bg} ${sev.text}`}
                        >
                          {t(sev.labelKey)}
                        </span>
                        <span className="text-foreground text-sm font-medium">
                          {p.type}
                        </span>
                      </div>
                      <p className="text-muted text-sm">{p.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Strengths */}
          {displayedAnalysis.strengths.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_strengths")}</h2>
              <div className="space-y-2">
                {displayedAnalysis.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-profit shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <p className="text-foreground text-sm">{s}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {displayedAnalysis.recommendations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_recommendations")}</h2>
              <div className="space-y-2">
                {displayedAnalysis.recommendations.map((r, i) => (
                  <div
                    key={i}
                    className="bg-accent/5 border border-accent/20 rounded-lg p-4 flex gap-3"
                  >
                    <span className="text-accent font-bold text-sm shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-foreground text-sm">{r}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Save button */}
          {!viewingHistory && (
            <div className="flex items-center gap-3">
              <button
                onClick={saveAnalysis}
                disabled={saving}
                className="px-5 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
              >
                {saving ? t("analysis_saving") : t("analysis_save")}
              </button>
              {saveMessage && (
                <span className="text-sm text-profit">{saveMessage}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <section className="mt-12 mb-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("analysis_history")}
        </h2>
        <div className="h-px bg-[#1e1e1e] mt-2 mb-4" />

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-5 w-12 rounded-full" />
                <div className="flex-1" />
                <div className="skeleton h-3 w-14" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-muted text-sm">{t("analysis_no_history")}</p>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <button
                key={r.id}
                onClick={() => viewHistoryItem(r)}
                className={`w-full text-left bg-card border rounded-lg p-4 flex items-center justify-between transition-colors hover:bg-border/50 ${
                  viewingHistory === r.id
                    ? "border-accent"
                    : "border-border"
                }`}
              >
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {new Date(r.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-muted text-sm">
                    {r.conforming_trades}/{r.total_trades} trades conformes
                  </p>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    r.discipline_score >= 75
                      ? "text-profit"
                      : r.discipline_score >= 50
                        ? "text-orange-400"
                        : "text-loss"
                  }`}
                >
                  {r.discipline_score}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
