"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { computeDisciplineScore } from "@/lib/discipline-score";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

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
            stroke="rgb(var(--border))"
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
  const { t, lang } = useLanguage();
  const { canUseAI, aiRemaining, plan, incrementAIUsage, loading: planLoading } = usePlan();
  const supabase = createClient();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedReview[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tradeCount, setTradeCount] = useState(0);
  const [hasStrategy, setHasStrategy] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);

  // ICT discipline score
  const [ictDisciplineResult, setIctDisciplineResult] = useState<ReturnType<typeof computeDisciplineScore> | null>(null);

  // Chat coach state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDailyCount, setChatDailyCount] = useState(0);
  const [showOlderChat, setShowOlderChat] = useState(false);
  const [hasOlderChat, setHasOlderChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI analysis history
  const [aiHistory, setAIHistory] = useState<{ id: string; question: string; answer: string; created_at: string }[]>([]);
  const [aiHistoryLoading, setAIHistoryLoading] = useState(true);

  const chatLimit = plan === "plus" || plan === "premium" ? 10 : 0;
  const chatRemaining = Math.max(0, chatLimit - chatDailyCount);
  const canChat = plan === "plus" || plan === "premium";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load chat daily count + persisted chat history
  useEffect(() => {
    async function loadChatCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("daily_chat_count, daily_chat_reset")
        .eq("id", user.id)
        .single();
      if (data) {
        const today = new Date().toISOString().split("T")[0];
        if (data.daily_chat_reset === today) {
          setChatDailyCount(data.daily_chat_count || 0);
        }
      }
    }
    async function loadChatHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      // Load today's messages (chronological) — up to 50
      const { data: todayRows } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .gte("created_at", today)
        .order("created_at", { ascending: true })
        .limit(50);
      if (todayRows) {
        setChatMessages(todayRows as ChatMessage[]);
      }
      // Check if older messages exist
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lt("created_at", today);
      setHasOlderChat((count || 0) > 0);
    }
    loadChatCount();
    loadChatHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlderChat = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      // data is newest first — reverse to chronological
      setChatMessages((data as ChatMessage[]).slice().reverse());
      setShowOlderChat(true);
    }
  }, [supabase]);

  const clearChatHistory = useCallback(async () => {
    if (!confirm(t("coach_clear_confirm"))) return;
    setClearingChat(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClearingChat(false); return; }
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setChatMessages([]);
    setHasOlderChat(false);
    setShowOlderChat(false);
    setClearingChat(false);
  }, [supabase, t]);

  const sendChatMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    if (chatRemaining !== null && chatRemaining <= 0) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      // Build trades context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const [{ data: trades }, { data: strategy }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, close_time, pair, direction, lot_size, entry_price, exit_price, sl, tp, pnl, commission, swap, emotion, setup_quality, tags, ict_setup, ict_entry_zone, ict_liquidity_target, ict_killzone, ict_timeframe, ict_confluence_score, ict_checklist")
          .eq("user_id", user.id)
          .order("open_time", { ascending: false })
          .limit(60),
        supabase
          .from("strategies")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .single(),
      ]);

      const tradesContext = (trades || []).map((t) => {
        const net = t.pnl + (t.commission || 0) + (t.swap || 0);
        const ictParts = [];
        if (t.ict_setup) ictParts.push(`Setup:${t.ict_setup}`);
        if (t.ict_entry_zone) ictParts.push(`Zone:${t.ict_entry_zone}`);
        if (t.ict_killzone) ictParts.push(`Killzone:${t.ict_killzone}`);
        if (t.ict_timeframe) ictParts.push(`TF:${t.ict_timeframe}`);
        if (t.ict_confluence_score != null) ictParts.push(`Checklist:${t.ict_confluence_score}/7`);
        const ictStr = ictParts.length > 0 ? ` | ${ictParts.join(" | ")}` : "";
        return `${t.open_time} | ${t.pair} | ${t.direction} | lot=${t.lot_size} | P&L=${net.toFixed(2)} | emotion=${t.emotion || "N/A"} | quality=${t.setup_quality || "N/A"} | tags=${(t.tags || []).join(",")}${ictStr}`;
      }).join("\n");

      const strategyContext = strategy
        ? `Nom: ${strategy.name || "N/A"}, Paires: ${(strategy.pairs || []).join(",")}, Sessions: ${(strategy.sessions || []).join(",")}, RR min: ${strategy.risk_reward ?? "N/A"}, Règles: ${(strategy.setup_rules || []).join("; ")}`
        : "Aucune stratégie définie";

      const res = await fetch("/api/chat-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.slice(-10), // keep last 10 messages for context
          tradesContext,
          strategyContext,
          language: lang,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);

      // Persist both messages
      await supabase.from("chat_messages").insert([
        { user_id: user.id, role: "user", content: msg },
        { user_id: user.id, role: "assistant", content: data.reply },
      ]);

      // Save Q&A pair to history
      await supabase.from("ai_analysis_history").insert({
        user_id: user.id,
        question: msg,
        answer: data.reply,
      });
      loadAIHistory();

      // Increment daily chat count
      const newCount = chatDailyCount + 1;
      setChatDailyCount(newCount);
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("profiles")
        .update({ daily_chat_count: newCount, daily_chat_reset: today })
        .eq("id", user.id);
    } catch (err) {
      setChatMessages([...newMessages, { role: "assistant", content: `Erreur : ${err instanceof Error ? err.message : "Erreur inconnue"}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatMessages, chatLoading, chatDailyCount, chatRemaining, supabase, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPrerequisites();
    loadHistory();
    loadIctScore();
    loadAIHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAIHistory() {
    setAIHistoryLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAIHistoryLoading(false); return; }
    const { data } = await supabase
      .from("ai_analysis_history")
      .select("id, question, answer, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setAIHistory(data || []);
    setAIHistoryLoading(false);
  }

  async function loadIctScore() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: trades } = await supabase
      .from("trades")
      .select("ict_setup, ict_killzone, ict_checklist, emotion, sl, tp, entry_price, direction")
      .eq("user_id", user.id);
    if (trades) {
      setIctDisciplineResult(computeDisciplineScore(trades));
    }
  }

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
        body: JSON.stringify({ strategy, trades, language: lang }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur.");

      setAnalysis(data);

      // Auto-save to history
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { error: saveErr } = await supabase.from("session_reviews").insert({
          user_id: authUser.id,
          discipline_score: data.discipline_score,
          total_trades: data.total_trades,
          conforming_trades: data.conforming_trades,
          analysis: data,
        });
        if (!saveErr) {
          setSaveMessage(t("analysis_saved"));
          loadHistory();
        }
      }

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

        {/* Free demo of AI analysis */}
        <div className="mt-8 relative">
          <div className="bg-card border border-border rounded-xl p-6 opacity-70 select-none pointer-events-none">
            <div className="absolute top-4 right-4 px-3 py-1 bg-muted/20 border border-border rounded text-xs font-bold text-muted tracking-widest">
              {t("ict_demo_overlay")}
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-3">{t("ict_demo_title")}</h2>
            <p className="text-foreground/80 text-sm leading-relaxed">{t("ict_demo_text")}</p>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/dashboard/upgrade"
              className="px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm"
            >
              {t("ict_demo_cta")} → {t("ict_demo_cta_sub")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const aiLimitReached = aiRemaining === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("analysis_title")}</h1>
      <p className="text-muted mt-1">{t("analysis_subtitle")}</p>

      <div className="mt-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* ── LEFT COLUMN (60%) ── */}
        <div className="flex-1 min-w-0 space-y-6">

        {/* Launch button */}
        <div>
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
              {plan === "free" ? t("plan_ai_limit_reached_weekly") : t("plan_ai_limit_reached")}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={runAnalysis}
              disabled={loading || !hasStrategy || tradeCount === 0 || aiLimitReached}
              className={`px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 btn-scale ${aiLimitReached ? "cursor-not-allowed pointer-events-none" : ""}`}
            >
              {loading ? t("analysis_running") : aiLimitReached ? t("analysis_run_limit") : t("analysis_run")}
            </button>
            {tradeCount > 0 && (
              <span className="text-muted text-sm">
                {tradeCount} {tradeCount === 1 ? t("analysis_trade_count_one") : t("analysis_trades_count")}
              </span>
            )}
            {aiRemaining !== null && !aiLimitReached && aiRemaining > 0 && (
              <span className="text-muted text-sm">
                ({aiRemaining} {plan === "free"
                  ? (aiRemaining === 1 ? t("plan_ai_remaining_week_one") : t("plan_ai_remaining_week"))
                  : (aiRemaining === 1 ? t("plan_ai_remaining_one") : t("plan_ai_remaining"))
                })
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-muted">{t("analysis_loading")}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-loss text-sm">{error}</p>
        )}

        {/* Results */}
        {displayedAnalysis && !loading && (
          <div className="space-y-8">
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

          {/* Score (compact, shown in left on mobile) */}
          <div className="lg:hidden bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreCircle score={displayedAnalysis.discipline_score} label={t("dash_discipline")} />
            <div>
              <p className="text-foreground text-lg font-semibold">
                {displayedAnalysis.conforming_trades} / {displayedAnalysis.total_trades} {t("analysis_conforming")}
              </p>
              <p className="text-muted text-sm mt-1">
                {displayedAnalysis.violations.length} {displayedAnalysis.violations.length === 1 ? t("analysis_violation_detected_one") : t("analysis_violations_detected")}
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

          {/* Auto-save confirmation */}
          {!viewingHistory && saveMessage && (
            <p className="text-sm text-profit">{saveMessage}</p>
          )}
          </div>
        )}

        {/* Coach IA Chat */}
        <section>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("coach_title")}</h2>
              <p className="text-muted text-sm mt-1">{t("coach_subtitle")}</p>
              <p className="text-xs text-muted/60 mt-0.5 mb-4 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                {t("ai_coach_disclaimer")}
              </p>
            </div>
            {canChat && chatMessages.length > 0 && (
              <button
                onClick={clearChatHistory}
                disabled={clearingChat}
                className="text-xs text-muted hover:text-loss transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22m-6 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                </svg>
                {clearingChat ? "..." : t("coach_clear_history")}
              </button>
            )}
          </div>

          {!canChat ? (
            <UpgradeBanner message={t("coach_locked")} />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Messages */}
              <div className="min-h-[500px] max-h-[600px] overflow-y-auto p-4 space-y-4">
              {hasOlderChat && !showOlderChat && (
                <div className="flex justify-center">
                  <button
                    onClick={loadOlderChat}
                    className="text-xs text-accent hover:underline"
                  >
                    {t("coach_show_older")}
                  </button>
                </div>
              )}
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted text-sm">{t("coach_empty")}</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {[t("coach_suggestion_1"), t("coach_suggestion_2"), t("coach_suggestion_3")].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setChatInput(s); }}
                        className="px-3 py-1.5 text-xs bg-surface border border-border rounded-full text-muted hover:text-foreground hover:border-accent/50 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    <div className={`rounded-xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-surface border border-border text-foreground rounded-bl-sm"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>li]:mb-0.5 [&>strong]:font-semibold [&>em]:italic">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.created_at && (
                      <p className={`text-[10px] text-muted/60 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                        {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-foreground/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-border rounded-xl px-4 py-2.5 rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder={t("coach_placeholder")}
                disabled={chatLoading || (chatRemaining !== null && chatRemaining <= 0)}
                className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim() || (chatRemaining !== null && chatRemaining <= 0)}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>

            {/* Remaining messages */}
            {chatRemaining !== null && (
              <div className="px-3 pb-2">
                <p className="text-xs text-muted">
                  {chatRemaining > 0
                    ? (chatRemaining === 1 ? t("coach_remaining_one") : t("coach_remaining")).replace("{n}", String(chatRemaining))
                    : t("coach_no_messages")}
                </p>
              </div>
            )}
          </div>
          )}
        </section>
        </div>{/* end left column */}

        {/* ── RIGHT COLUMN (40%) ── hidden on mobile */}
        <div className="hidden lg:flex lg:w-[360px] shrink-0 flex-col gap-4 sticky top-6">
          {/* Score card */}
          {displayedAnalysis ? (
            <div className="bg-card border border-border rounded-xl p-6 card-shadow flex flex-col items-center text-center">
              <ScoreCircle score={displayedAnalysis.discipline_score} label={t("dash_discipline")} />
              <p className="text-foreground text-sm font-semibold mt-4">
                {displayedAnalysis.conforming_trades} / {displayedAnalysis.total_trades} {t("analysis_conforming")}
              </p>
              <p className="text-muted text-sm mt-1">
                {displayedAnalysis.violations.length} {displayedAnalysis.violations.length === 1 ? t("analysis_violation_detected_one") : t("analysis_violations_detected")}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 card-shadow flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <p className="text-muted text-sm">{t("analysis_score_empty")}</p>
            </div>
          )}

          {/* ICT Discipline Score card */}
          <div className="bg-card border border-border rounded-xl p-6 card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t("ict_discipline_score")}</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent">ICT</span>
            </div>
            {ictDisciplineResult === null ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-3 rounded w-full" />)}
              </div>
            ) : ictDisciplineResult.insufficient ? (
              <div>
                <p className="text-muted text-xs mb-3">{t("ict_score_insufficient")}</p>
                <Link href="/dashboard/trades" className="text-xs text-accent hover:underline">
                  {t("ict_goto_trades")} →
                </Link>
              </div>
            ) : (
              <div>
                {/* Circular gauge */}
                <div className="flex justify-center mb-4">
                  {(() => {
                    const score = ictDisciplineResult.score;
                    const radius = 40;
                    const circ = 2 * Math.PI * radius;
                    const offset = circ - (score / 100) * circ;
                    const strokeColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
                    const textColor = score >= 70 ? "text-profit" : score >= 40 ? "text-orange-400" : "text-loss";
                    return (
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(var(--border))" strokeWidth="8" />
                          <circle cx="50" cy="50" r={radius} fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-bold ${textColor}`}>{score}</span>
                          <span className="text-muted text-[10px]">/100</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* Sub-scores */}
                <div className="space-y-1.5">
                  {[
                    { key: "ict_sub_checklist", val: ictDisciplineResult.subScores.checklist },
                    { key: "ict_sub_killzones", val: ictDisciplineResult.subScores.killzones },
                    { key: "ict_sub_rr", val: ictDisciplineResult.subScores.riskReward },
                    { key: "ict_sub_emotions", val: ictDisciplineResult.subScores.emotions },
                    { key: "ict_sub_setup", val: ictDisciplineResult.subScores.setupTagged },
                  ].map(({ key, val }) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted">{t(key)}</span>
                        <span className="text-foreground font-medium">{val}%</span>
                      </div>
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: val >= 70 ? "#22c55e" : val >= 40 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted mt-3">
                  {t("ict_score_based_on")} {ictDisciplineResult.taggedCount} {t("ict_score_tagged_trades")}
                </p>
              </div>
            )}
          </div>

          {/* AI Coach Q&A History */}
          {canChat && (
            <div className="bg-card border border-border rounded-xl p-4 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-3">{t("coach_history_title")}</h2>
              {aiHistoryLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="skeleton h-12 rounded w-full" />)}
                </div>
              ) : aiHistory.length === 0 ? (
                <p className="text-muted text-xs">{t("coach_history_empty")}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {aiHistory.map((item) => (
                    <div key={item.id} className="border border-border rounded-lg p-2.5">
                      <p className="text-xs text-accent font-medium truncate">Q: {item.question}</p>
                      <p className="text-[11px] text-muted mt-1 line-clamp-2">{item.answer}</p>
                      <p className="text-[10px] text-muted/50 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="bg-card border border-border rounded-xl p-4 card-shadow">
            <h2 className="text-sm font-semibold text-foreground mb-3">{t("analysis_history")}</h2>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="flex-1" />
                    <div className="skeleton h-5 w-10 rounded" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-muted text-xs">{t("analysis_no_history")}</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => viewHistoryItem(r)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center justify-between transition-colors hover:bg-border/50 ${
                      viewingHistory === r.id ? "bg-accent/10 border border-accent/30" : "border border-transparent"
                    }`}
                  >
                    <div>
                      <p className="text-foreground text-xs font-medium">
                        {new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-muted text-[11px]">
                        {r.conforming_trades}/{r.total_trades} trades
                      </p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${r.discipline_score >= 75 ? "text-profit" : r.discipline_score >= 50 ? "text-orange-400" : "text-loss"}`}>
                      {r.discipline_score}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>{/* end right column */}

      </div>{/* end flex row */}

      {/* Mobile history (visible only on mobile) */}
      <section className="lg:hidden mt-8 mb-8">
        <h2 className="text-lg font-semibold text-foreground">{t("analysis_history")}</h2>
        <div className="h-px bg-border mt-2 mb-4" />
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
                className={`w-full text-left bg-card border rounded-lg p-4 flex items-center justify-between transition-colors hover:bg-border/50 ${viewingHistory === r.id ? "border-accent" : "border-border"}`}
              >
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-muted text-sm">{r.conforming_trades}/{r.total_trades} trades</p>
                </div>
                <span className={`text-2xl font-bold ${r.discipline_score >= 75 ? "text-profit" : r.discipline_score >= 50 ? "text-orange-400" : "text-loss"}`}>
                  {r.discipline_score}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
