"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { money } from "@/lib/account-currency";
import { useDisplayCurrency } from "@/lib/hooks/useDisplayCurrency";
import {
  coachActionMeta,
  useCoachChat,
  type ChatMessage,
} from "@/lib/hooks/useCoachChat";
import CoachConfirmBox from "@/components/coach/CoachConfirmBox";
import type { CategoryBreakdown } from "@/lib/discipline-score";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { buildDemoAnalysis, type DemoTradeForAnalysis } from "@/lib/demo-fixtures";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { track } from "@/lib/track";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

// Action posée par le coach (chip affiché sous le message assistant).
/**
 * Trades envoyés au modèle. `close_time` porte le filtre de période, d'où sa
 * présence explicite ; le reste voyage tel quel jusqu'à l'API d'analyse.
 */
interface AnalysisTradeRow extends Record<string, unknown> {
  open_time: string;
  close_time: string;
}

// Vitrine des capacités du coach, affichée quand le chat est vide : chaque carte
// pré-remplit une vraie demande (le trader découvre en essayant). Icônes inline
// (paths façon Feather) pour ne pas alourdir le bundle.
const COACH_CAPABILITIES: { key: string; icon: string; titleKey: string; exampleKey: string }[] = [
  { key: "analyze",   icon: "M3 3v18h18M7 14l3-3 3 3 4-5",                                                              titleKey: "coach_cap_analyze_title",   exampleKey: "coach_cap_analyze_ex" },
  { key: "goals",     icon: "M4 21V4m0 1h11l-2 3 2 3H4",                                                                titleKey: "coach_cap_goals_title",     exampleKey: "coach_cap_goals_ex" },
  { key: "annotate",  icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z", titleKey: "coach_cap_annotate_title",  exampleKey: "coach_cap_annotate_ex" },
  { key: "strategy",  icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",                     titleKey: "coach_cap_strategy_title",  exampleKey: "coach_cap_strategy_ex" },
  { key: "export",    icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",                            titleKey: "coach_cap_export_title",    exampleKey: "coach_cap_export_ex" },
  { key: "challenge", icon: "M8 21h8M12 17v4M6 4h12v4a6 6 0 01-12 0V4z",                                               titleKey: "coach_cap_challenge_title", exampleKey: "coach_cap_challenge_ex" },
];

// Déclenche le téléchargement d'un CSV généré par le coach.

interface Violation {
  category: "strategy" | "behavior" | "execution";
  type: string;
  trade_ids: number[];
  occurrences: number;
  explanation: string;
  /** P&L net cumulé des trades cités (analyses nouvelle génération). */
  cost?: number | null;
}

interface LegacyViolation {
  trade_date?: string;
  pair?: string;
  rule_violated?: string;
  explanation: string;
}

interface Pattern {
  type: string;
  description: string;
  severity: "high" | "medium" | "low";
  /** Preuve chiffrée (analyses nouvelle génération). */
  evidence?: string;
}

interface TradeReview {
  trade_id: number;
  grade: "A" | "B" | "C" | "D";
  comment: string;
  pair: string;
  direction: string;
  open_time: string;
  net_pnl: number;
}

interface ActionItem {
  title: string;
  target: string;
}

interface EdgeHighlight {
  kind: "best" | "worst";
  dimension: "pair" | "hour" | "weekday" | "setup" | "emotion" | "direction";
  key: string;
  netPnl: number;
  winRate: number;
  trades: number;
}

interface CounterfactualPoint {
  t: string;
  real: number;
  clean: number;
}

interface AnalysisInsights {
  total_net_pnl: number;
  win_rate: number;
  profit_factor: number | null;
  expectancy: number;
  violation_trade_count: number;
  violation_cost: number;
  counterfactual: {
    points: CounterfactualPoint[];
    realFinal: number;
    cleanFinal: number;
    gain: number;
  } | null;
  edge: EdgeHighlight[];
}

interface DataFields {
  setup: boolean;
  timing: boolean;
  emotion: boolean;
  rr: boolean;
  checklist: boolean;
}

interface Analysis {
  discipline_score: number;
  total_trades: number;
  conforming_trades?: number;
  headline?: string | null;
  summary?: string | null;
  violations: (Violation | LegacyViolation)[];
  patterns: Pattern[];
  strengths: string[];
  recommendations: string[];
  trade_reviews?: TradeReview[];
  action_plan?: ActionItem[];
  insights?: AnalysisInsights | null;
  score_breakdown?: CategoryBreakdown[];
  data_fields?: DataFields;
}

interface SavedReview {
  id: string;
  created_at: string;
  discipline_score: number;
  total_trades: number;
  conforming_trades?: number;
  analysis: Analysis;
  score_breakdown?: CategoryBreakdown[];
  period?: string;
  period_label?: string;
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
    score >= 90 ? "text-profit" : score >= 75 ? "text-green-400" : score >= 60 ? "text-yellow-400" : score >= 40 ? "text-orange-400" : "text-loss";
  const strokeColor =
    score >= 90 ? "rgb(var(--profit))" :
    score >= 75 ? "rgb(var(--profit))" :
    score >= 60 ? "rgb(var(--warning))" :
    score >= 40 ? "rgb(var(--warning))" :
    "rgb(var(--loss))";

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

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  wrong_pair: "violation_wrong_pair",
  wrong_session: "violation_wrong_session",
  low_rr: "violation_low_rr",
  sl_too_wide: "violation_sl_too_wide",
  max_trades_day: "violation_max_trades_day",
  max_daily_loss: "violation_max_daily_loss",
  consecutive_losses: "violation_consecutive_losses",
  revenge_trading: "violation_revenge_trading",
  overtrading: "violation_overtrading",
  lot_increase_after_loss: "violation_lot_increase",
  fomo: "violation_fomo",
  missing_sl: "violation_missing_sl",
  missing_tp: "violation_missing_tp",
  missing_setup_tag: "violation_missing_setup",
};

function ScoreBreakdownCard({ breakdown, score, t, className }: { breakdown: CategoryBreakdown[]; score: number; t: (k: string) => string; className?: string }) {
  const [open, setOpen] = useState(false);
  const hasDeductions = breakdown.some((b) => b.totalCapped > 0);

  return (
    <div className={`bg-card border border-border rounded-xl p-5 card-shadow ${className || ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold text-foreground">{t("score_breakdown_title")}</h3>
        <svg className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t("score_starting")}</span>
            <span className="text-foreground font-bold">100</span>
          </div>

          {breakdown.map((cat) => {
            if (cat.totalCapped === 0) return null;
            const catColor = cat.category === "strategy" ? "text-loss" : cat.category === "behavior" ? "text-orange-400" : "text-yellow-400";
            return (
              <div key={cat.category} className="border-t border-border pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-medium ${catColor}`}>
                    {t(`violation_cat_${cat.category}`)}
                    {cat.totalRaw > cat.totalCapped && (
                      <span className="text-muted ml-1">({t("score_capped")} -{cat.cap})</span>
                    )}
                  </span>
                  <span className={`font-bold ${catColor}`}>-{cat.totalCapped}</span>
                </div>
                {cat.penalties.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs ml-3 text-muted">
                    <span>{t(VIOLATION_TYPE_LABELS[p.type] || p.type)} {p.occurrences > 1 ? `×${p.occurrences}` : ""}</span>
                    <span>-{p.points}</span>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="border-t border-border pt-2 flex justify-between text-sm">
            <span className="text-foreground font-semibold">{t("score_final")}</span>
            <span className={`font-bold ${score >= 90 ? "text-profit" : score >= 75 ? "text-green-400" : score >= 60 ? "text-yellow-400" : score >= 40 ? "text-orange-400" : "text-loss"}`}>
              {score}/100
            </span>
          </div>

          {!hasDeductions && (
            <p className="text-xs text-profit">{t("score_perfect")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function fmtEuro(n: number, currency: string): string {
  return money(n, currency, { digits: 2, signed: n > 0 }).replace(/,00(?=\D*$)/, "");
}

/** Libellé humain du segment d'edge (14h, lundi, EURUSD…). */
function edgeKeyLabel(h: EdgeHighlight, lang: string): string {
  if (h.dimension === "hour") return `${h.key}h`;
  if (h.dimension === "weekday") {
    // 2024-01-01 est un lundi : jour ISO n → 2024-01-0n.
    const ref = new Date(Date.UTC(2024, 0, Number(h.key)));
    const label = new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(ref);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (h.dimension === "direction") return h.key.toUpperCase();
  return h.key;
}

const GRADE_STYLES: Record<string, string> = {
  A: "bg-profit/15 text-profit",
  B: "bg-green-500/10 text-green-400",
  C: "bg-orange-500/10 text-orange-400",
  D: "bg-loss/15 text-loss",
};

/**
 * Courbe d'équité réelle vs « discipline respectée » (trades en violation
 * retirés). Le graphe qui matérialise ce que l'indiscipline a coûté.
 */
function CounterfactualChart({ points }: { points: CounterfactualPoint[] }) {
  if (points.length < 2) return null;
  const W = 300;
  const H = 110;
  const PAD = 6;
  const values = points.flatMap((p) => [p.real, p.clean]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const line = (get: (p: CounterfactualPoint) => number) =>
    points.map((p, i) => `${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");
  const zeroY = y(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-hidden="true">
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgb(var(--border))" strokeWidth="1" strokeDasharray="2 3" />
      <polyline points={line((p) => p.clean)} fill="none" stroke="rgb(var(--profit))" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={line((p) => p.real)} fill="none" stroke="rgb(var(--muted))" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.9" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].clean)} r="3" fill="rgb(var(--profit))" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].real)} r="3" fill="rgb(var(--muted))" />
    </svg>
  );
}

const DATA_FIELD_LABELS: Record<string, Record<string, string>> = {
  setup: { fr: "Setup", en: "Setup", de: "Setup", es: "Setup" },
  timing: { fr: "Timing", en: "Timing", de: "Timing", es: "Timing" },
  emotion: { fr: "Émotion", en: "Emotion", de: "Emotion", es: "Emoción" },
  rr: { fr: "RR", en: "RR", de: "RR", es: "RR" },
  checklist: { fr: "Checklist", en: "Checklist", de: "Checkliste", es: "Checklist" },
};

function DataFieldsSummary({ fields, lang, t }: { fields?: DataFields; lang: string; t: (k: string) => string }) {
  if (!fields) return null;
  const all = ["setup", "timing", "emotion", "rr", "checklist"];
  const missing = all.filter((k) => !fields[k as keyof DataFields]);
  const provided = all.length - missing.length;

  if (missing.length === 0) {
    return <p className="text-xs text-muted/70 mt-1">{t("score_based_on_all")}</p>;
  }

  const missingLabels = missing.map((k) => DATA_FIELD_LABELS[k][lang] || k).join(", ");
  const base = t("score_based_on_n").replace("{n}", String(provided));
  return <p className="text-xs text-muted/70 mt-1">{base} ({missingLabels})</p>;
}

type PeriodKey = "today" | "yesterday" | "this_week" | "this_month" | "last_7_days" | "last_30_days" | "all";

const PERIOD_OPTIONS: { key: PeriodKey; labelKey: string }[] = [
  { key: "today", labelKey: "period_today" },
  { key: "yesterday", labelKey: "period_yesterday" },
  { key: "this_week", labelKey: "period_this_week" },
  { key: "this_month", labelKey: "period_this_month" },
  { key: "last_7_days", labelKey: "period_last_7_days" },
  { key: "last_30_days", labelKey: "period_last_30_days" },
  { key: "all", labelKey: "period_all" },
];

function getFilteredTrades(trades: { close_time: string }[], period: PeriodKey) {
  if (period === "all") return trades;
  const now = new Date();
  let start: Date;
  let end: Date | null = null;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday": {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      start = y;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case "this_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_7_days":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "last_30_days":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return trades;
  }

  return trades.filter((t) => {
    const d = new Date(t.close_time);
    if (d < start) return false;
    if (end && d >= end) return false;
    return true;
  });
}

export default function AnalysisPage() {
  const { t, lang } = useLanguage();
  // Vue multi-comptes : devise commune aux comptes actifs, euro s'ils la mélangent.
  const displayCurrency = useDisplayCurrency();
  const { canUseAI, aiRemaining, plan, refreshPlan, demoMode, loading: planLoading } = usePlan();
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
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("this_week");
  const [allTrades, setAllTrades] = useState<{ close_time: string }[]>([]);

  // Autorun (?autorun=1) : déclenché après le premier import de trades pour
  // offrir le moment « aha » sans que l'utilisateur ait à chercher le bouton.
  const [pendingAutorun, setPendingAutorun] = useState(false);
  const autoranRef = useRef(false);

  // Plan d'action → objectifs : un clic crée un objectif personnel par
  // engagement (même mécanique que la page Objectifs / l'outil du coach).
  const [goalsFromPlan, setGoalsFromPlan] = useState<"idle" | "saving" | "done" | "error">("idle");

  // Chat coach — logique partagée avec le dock global (lib/hooks/useCoachChat).
  // La page garde seulement ce qui lui est propre : afficher l'historique
  // ancien et l'effacer.
  const chat = useCoachChat({ plan, lang, t, demoMode, onAnswered: () => loadAIHistory() });
  const chatMessages = chat.messages;
  const setChatMessages = chat.setMessages;
  const chatInput = chat.input;
  const setChatInput = chat.setInput;
  const chatLoading = chat.loading;
  const setHasOlderChat = chat.setHasOlderChat;
  // onClick passe un MouseEvent : on ne le laisse pas devenir le texte à envoyer.
  const sendChatMessage = useCallback(() => { void chat.send(); }, [chat]);
  const undoCoachAction = chat.undo;
  const [showOlderChat, setShowOlderChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // AI analysis history
  const [aiHistory, setAIHistory] = useState<{ id: string; question: string; answer: string; created_at: string }[]>([]);
  const [aiHistoryLoading, setAIHistoryLoading] = useState(true);

  const isPaidPlan = chat.isPaidPlan;
  const freeTasterUsed = chat.freeTasterUsed;
  const chatRemaining = chat.remaining;
  const canChat = chat.canChat;
  const hasOlderChat = chat.hasOlderChat;

  // Auto-scroll « collant » : on ne suit le bas que si l'utilisateur y est déjà.
  // Sinon (il a remonté pour relire pendant que le coach écrit), le stream ne
  // confisque plus son défilement. On scrolle le conteneur lui-même (jamais la
  // fenêtre), donc la page ne saute pas non plus.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatMessages]);

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
  }, [supabase, setChatMessages]);

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
  }, [supabase, t, setChatMessages, setHasOlderChat]);

  // sendChatMessage et undoCoachAction vivent désormais dans
  // lib/hooks/useCoachChat, partagés avec le dock global (composants/coach).

  useEffect(() => {
    loadPrerequisites();
    loadHistory();
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

  async function loadPrerequisites() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ count }, { data: strat }, trades] = await Promise.all([
      supabase
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("strategies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      // Lecture paginée : ces dates servent à proposer les périodes analysables.
      // Non bornée, la lecture s'arrête à 1 000 lignes en silence (voir
      // lib/supabase-paginate.ts) et des périodes entières disparaîtraient.
      fetchAllRows<{ close_time: string }>((from, to) =>
        supabase
          .from("trades")
          .select("close_time")
          .eq("user_id", user.id)
          .not("close_time", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    setTradeCount(count || 0);
    setHasStrategy(!!strat);
    setAllTrades(
      (trades ?? [])
        .slice()
        .sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime()),
    );
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

  const filteredTradeCount = getFilteredTrades(allTrades, selectedPeriod).length;
  const periodLabel = t(PERIOD_OPTIONS.find((p) => p.key === selectedPeriod)!.labelKey);

  // Lecture du flag autorun au montage (window.location pour éviter le
  // wrapping Suspense exigé par useSearchParams sur les pages statiques)
  useEffect(() => {
    if (autoranRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autorun") === "1") {
      autoranRef.current = true;
      setSelectedPeriod("all");
      setPendingAutorun(true);
    }
  }, []);

  // Mode démo : l'analyse doit être là d'emblée, sur toute la période. Le
  // visiteur ne doit pas avoir à deviner qu'il faut cliquer, et « cette semaine »
  // ne contient que 4 trades, donc rien de ce que l'analyse raconte.
  useEffect(() => {
    if (autoranRef.current || planLoading || !demoMode) return;
    autoranRef.current = true;
    setSelectedPeriod("all");
    setPendingAutorun(true);
  }, [demoMode, planLoading]);

  // Déclenchement une fois le plan chargé et la période appliquée
  useEffect(() => {
    if (!pendingAutorun || planLoading || loading) return;
    if (!canUseAI || !hasStrategy) return; // la page affichera l'état adapté
    if (selectedPeriod !== "all") return;
    // Free : attendre l'historique — si l'analyse découverte est déjà
    // consommée (ex. auto-analyse post-import), ne pas déclencher un 403.
    if (plan === "free" && !demoMode) {
      if (historyLoading) return;
      if (history.length > 0) { setPendingAutorun(false); return; }
    }
    setPendingAutorun(false);
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutorun, planLoading, loading, canUseAI, hasStrategy, selectedPeriod, plan, historyLoading, history.length, demoMode]);

  async function runAnalysis() {
    setError(null);
    setAnalysis(null);
    setSaveMessage(null);
    setViewingHistory(null);
    setGoalsFromPlan("idle");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("analysis_not_connected"));

      const [{ data: strategy }, trades] = await Promise.all([
        supabase
          .from("strategies")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        // Lecture paginée : ce sont les trades envoyés au modèle. Non bornée,
        // la lecture s'arrête à 1 000 lignes en silence (voir
        // lib/supabase-paginate.ts) et l'analyse porterait sur une partie de
        // l'historique tout en se présentant comme complète — sur une analyse
        // payée en crédit, c'est le pire moment pour mentir.
        fetchAllRows<AnalysisTradeRow>((from, to) =>
          supabase
            .from("trades")
            .select("open_time, close_time, pair, direction, lot_size, entry_price, exit_price, sl, tp, sl_initial, tp_initial, pnl, commission, swap, emotion, ict_setup, ict_entry_zone, ict_liquidity_target, ict_killzone, ict_timeframe, ict_confluence_score, vision_review")
            .eq("user_id", user.id)
            .order("id", { ascending: true })
            .range(from, to),
        ).then((rows) =>
          rows === null
            ? null
            : rows
                .slice()
                .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()),
        ),
      ]);

      if (!strategy) throw new Error(t("session_active_no_strategy"));
      if (!trades || trades.length === 0) throw new Error(t("analysis_no_trades_to_analyze"));

      const filteredTrades = getFilteredTrades(trades, selectedPeriod);
      if (filteredTrades.length === 0) throw new Error(t("period_no_trades"));

      // Mode démo : analyse figée, assemblée depuis les trades démo eux-mêmes
      // (textes dans lib/demo-fixtures.ts, chiffres recalculés). On sort AVANT
      // l'appel au modèle, donc sans coût ni quota, et surtout avant l'insertion
      // dans session_reviews : cette table alimente le classement public, une
      // ligne démo y ferait entrer un compte fictif dans le vrai classement.
      if (demoMode) {
        setAnalysis(buildDemoAnalysis(filteredTrades as DemoTradeForAnalysis[], lang));
        track("analysis_run", { demo: true });
        return;
      }

      // Le total de la checklist vient de la stratégie (le score coché est
      // sur le trade) : il permet à l'IA de lire « 3/5 éléments validés ».
      const checklistTotal = Array.isArray(strategy.setup_rules) ? strategy.setup_rules.length : null;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          trades: filteredTrades.map((tr) => ({ ...tr, checklist_total: checklistTotal })),
          language: lang,
          period: selectedPeriod,
          periodLabel,
        }),
      });

      // Un timeout de plateforme renvoie du HTML, pas du JSON : parser avant de
      // tester res.ok faisait remonter au trader un « Unexpected token < » au
      // lieu du vrai motif d'échec.
      let data: Analysis & { error?: string };
      try {
        data = await res.json();
      } catch {
        if (res.ok) throw new Error(t("analysis_unknown_error"));
        data = {} as Analysis & { error?: string };
      }
      if (!res.ok) {
        if (res.status === 401) throw new Error(t("api_error_unauthorized"));
        if (res.status === 403) throw new Error(t("api_error_forbidden"));
        if (res.status === 413) throw new Error(t("api_error_payload_too_large"));
        if (res.status === 429) throw new Error(t("api_error_rate_limited"));
        throw new Error(data.error || "Erreur serveur.");
      }

      setAnalysis(data);
      track("analysis_run", { auto: false });

      // Auto-save to history
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { error: saveErr } = await supabase.from("session_reviews").insert({
          user_id: authUser.id,
          discipline_score: data.discipline_score,
          total_trades: data.total_trades,
          conforming_trades: data.total_trades - (data.violations?.length || 0),
          analysis: data,
          score_breakdown: data.score_breakdown || null,
          period: selectedPeriod,
          period_label: periodLabel,
        });
        if (!saveErr) {
          setSaveMessage(t("analysis_saved"));
          loadHistory();
        }
      }

      // Refresh plan state — server already incremented the quota
      await refreshPlan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("analysis_unknown_error"));
    } finally {
      setLoading(false);
    }
  }


  const [exportingPdf, setExportingPdf] = useState(false);

  async function exportPdf() {
    const a = displayedAnalysis;
    if (!a || exportingPdf) return;
    setExportingPdf(true);
    try {
      const ins = a.insights;
      // Import dynamique : jsPDF + police embarquée ne chargent qu'au clic.
      const { setDemoWatermark } = await import("@/lib/pdf/kit");
      setDemoWatermark(demoMode ? t("demo_pdf_watermark") : null);
      const { exportAnalysisPdf } = await import("@/lib/analysis-pdf");
      const historyItem = viewingHistory ? history.find((h) => h.id === viewingHistory) : null;
      await exportAnalysisPdf({
        lang: (["fr", "en", "de", "es"].includes(lang) ? lang : "fr") as "fr" | "en" | "de" | "es",
        periodLabel: historyItem?.period_label || periodLabel,
        score: a.discipline_score,
        totalTrades: a.total_trades,
        headline: a.headline,
        summary: a.summary,
        stats: ins
          ? {
              netPnl: ins.total_net_pnl,
              winRate: ins.win_rate,
              profitFactor: ins.profit_factor,
              violationCost: ins.violation_cost,
              violationTradeCount: ins.violation_trade_count,
            }
          : null,
        counterfactual: ins?.counterfactual ?? null,
        violations: a.violations.map((v) =>
          "category" in v
            ? {
                title: t(`violation_${(v as Violation).type}` as Parameters<typeof t>[0]),
                explanation: v.explanation,
                cost: (v as Violation).cost,
              }
            : { title: (v as LegacyViolation).rule_violated || "", explanation: v.explanation },
        ),
        patterns: a.patterns.map((p) => ({
          title: p.type,
          description: p.description,
          evidence: p.evidence,
          severity: p.severity,
        })),
        edge: (ins?.edge ?? []).map((h) => ({
          label: `${t(`edge_dim_${h.dimension}` as Parameters<typeof t>[0])} · ${edgeKeyLabel(h, lang)}`,
          value: `${fmtEuro(h.netPnl, displayCurrency)} · ${t("analysis_edge_stats").replace("{n}", String(h.trades)).replace("{p}", String(h.winRate))}`,
          positive: h.kind === "best",
        })),
        strengths: a.strengths,
        recommendations: a.recommendations,
        tradeReviews: (a.trade_reviews ?? []).map((r) => ({
          grade: r.grade,
          pair: r.pair,
          direction: r.direction,
          date: new Date(r.open_time).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
          pnl: r.net_pnl,
          comment: r.comment,
        })),
        actionPlan: a.action_plan ?? [],
      });
      track("analysis_pdf_export");
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExportingPdf(false);
    }
  }

  async function createGoalsFromPlan(plan_items: ActionItem[]) {
    if (goalsFromPlan === "saving" || goalsFromPlan === "done") return;
    setGoalsFromPlan("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not connected");
      // Un objectif personnel hebdomadaire par engagement : le titre porte
      // l'engagement, le critère de réussite est gardé entre parenthèses.
      const rows = plan_items.slice(0, 3).map((a) => ({
        user_id: user.id,
        kind: "custom",
        title: `${a.title} (${a.target})`.slice(0, 200),
        period: "week",
        done: false,
      }));
      const { error: insertErr } = await supabase.from("goals").insert(rows);
      if (insertErr) throw insertErr;
      setGoalsFromPlan("done");
      track("analysis_plan_goals_created", { count: rows.length });
    } catch {
      setGoalsFromPlan("error");
    }
  }

  function viewHistoryItem(review: SavedReview) {
    if (compareMode) {
      setCompareSelection((prev) => {
        if (prev.includes(review.id)) return prev.filter((id) => id !== review.id);
        if (prev.length >= 2) return [prev[1], review.id];
        return [...prev, review.id];
      });
      return;
    }
    setAnalysis(review.analysis);
    setViewingHistory(review.id);
    setSaveMessage(null);
    setGoalsFromPlan("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCompareMode() {
    setCompareMode((prev) => !prev);
    setCompareSelection([]);
  }

  const compareA = compareSelection.length >= 2 ? history.find((h) => h.id === compareSelection[0]) : null;
  const compareB = compareSelection.length >= 2 ? history.find((h) => h.id === compareSelection[1]) : null;

  const displayedAnalysis = analysis;

  if (planLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">{t("analysis_title")}</h1>
        <p className="text-muted mt-2 text-sm">{t("analysis_subtitle")}</p>
        <div className="mt-6 skeleton h-10 w-48 rounded-lg" />
      </div>
    );
  }


  // Plan free : 1 analyse « découverte » à vie (même mécanique que le coach).
  // Le serveur l'accorde tant que session_reviews est vide — l'historique déjà
  // chargé sert de marqueur côté client. Pendant son chargement on bloque le
  // bouton sans afficher l'encart upgrade (pas de flash).
  const freeAnalysisTasterUsed = plan === "free" && !historyLoading && history.length > 0;
  // En démo, l'analyse est une fixture : elle ne consomme aucun quota, donc
  // aucune limite ne doit bloquer le bouton ni changer son libellé.
  const aiLimitReached = demoMode
    ? false
    : plan === "free"
      ? freeAnalysisTasterUsed
      : aiRemaining === 0;

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
            <div className="flex items-start gap-3 p-4 mb-4 bg-loss/10 border border-loss/30 rounded-xl animate-in fade-in duration-300">
              <span className="text-loss text-xl shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-loss">{t("analysis_no_strategy")}</p>
                <p className="text-xs text-loss/70 mt-1">{t("analysis_no_strategy_description")}</p>
                <Link href="/dashboard/strategy" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-2">
                  {t("analysis_no_strategy_cta")}
                </Link>
              </div>
            </div>
          )}
          {tradeCount === 0 && (
            <div className="flex items-start gap-3 p-4 mb-4 bg-loss/10 border border-loss/30 rounded-xl animate-in fade-in duration-300">
              <span className="text-loss text-xl shrink-0">📊</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-loss">{t("analysis_no_trades")}</p>
                <Link href="/dashboard/trades" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-1">
                  {t("dash_action_import")} →
                </Link>
              </div>
            </div>
          )}
          {aiLimitReached && plan !== "free" && (
            <p className="text-orange-400 text-sm mb-3">{t("plan_ai_limit_reached")}</p>
          )}
          {/* Free : analyse découverte consommée → rendre le manque visible
              avec le pont vers Plus (1 analyse par jour). */}
          {aiLimitReached && plan === "free" && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 mb-4 bg-accent/5 border border-accent/20 rounded-xl animate-in fade-in duration-300">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{t("plan_ai_taster_used_title")}</p>
                <p className="text-xs text-muted mt-1">{t("plan_ai_taster_used_desc")}</p>
              </div>
              <Link
                href="/dashboard/upgrade"
                onClick={() => track("upgrade_cta_clicked", { source: "countdown" })}
                className="shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors text-center"
              >
                {t("plan_ai_upgrade_cta")}
              </Link>
            </div>
          )}
          {/* Period selector */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodKey)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{t(opt.labelKey)}</option>
              ))}
            </select>
            <span className={`text-sm ${filteredTradeCount === 0 ? "text-muted" : "text-foreground"}`}>
              {filteredTradeCount === 0
                ? t("period_no_trades")
                : filteredTradeCount === 1
                  ? t("period_trades_count_one")
                  : t("period_trades_count").replace("{n}", String(filteredTradeCount))}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                if (selectedPeriod === "all" && filteredTradeCount > 200) {
                  alert(t("period_warning_large").replace("{n}", String(filteredTradeCount)));
                }
                runAnalysis();
              }}
              disabled={loading || !hasStrategy || tradeCount === 0 || filteredTradeCount === 0 || aiLimitReached || (plan === "free" && !demoMode && historyLoading)}
              className={`px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 btn-scale ${aiLimitReached ? "cursor-not-allowed pointer-events-none" : ""}`}
            >
              {loading
                ? t("analysis_running")
                : aiLimitReached
                ? plan === "free"
                  ? t("plan_ai_taster_used_title")
                  : t("analysis_run_limit")
                : t("analysis_run")}
            </button>
            {demoMode ? (
              <span className="text-muted text-sm">({t("analysis_demo_free")})</span>
            ) : plan === "free" ? (
              !historyLoading && !aiLimitReached && (
                <span className="text-muted text-sm">({t("plan_ai_taster_available")})</span>
              )
            ) : (
              aiRemaining !== null && !aiLimitReached && aiRemaining > 0 && (
                <span className="text-muted text-sm">
                  ({aiRemaining} {aiRemaining === 1 ? t("plan_ai_remaining_one") : t("plan_ai_remaining")})
                </span>
              )
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-muted">{t("analysis_loading")}</p>
            </div>
            <p className="text-xs text-muted/60 mt-2 ml-8">{t("analysis_loading_hint")}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-loss/10 border border-loss/30 rounded-xl animate-in fade-in duration-300">
            <span className="text-loss text-xl shrink-0">❌</span>
            <div>
              <p className="text-sm font-semibold text-loss">{error}</p>
              <button onClick={() => setError(null)} className="text-xs text-muted hover:text-foreground mt-1">{t("detail_close")}</button>
            </div>
          </div>
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

          {/* Export PDF du rapport */}
          <div className="flex justify-end -mb-4">
            <button
              onClick={exportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-border/40 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {exportingPdf ? t("analysis_export_pdf_running") : t("analysis_export_pdf")}
            </button>
          </div>

          {/* Verdict : LA phrase à retenir + le résumé en 3-4 phrases */}
          {displayedAnalysis.headline && (
            <div className="bg-card border border-accent/30 rounded-xl p-6 card-shadow relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-accent/40 to-transparent" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent mb-2">{t("analysis_verdict_title")}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">{displayedAnalysis.headline}</p>
              {displayedAnalysis.summary && (
                <p className="text-sm text-muted mt-3 leading-relaxed">{displayedAnalysis.summary}</p>
              )}
            </div>
          )}

          {/* Score (compact, shown in left on mobile) */}
          <div className="lg:hidden bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center">
              <ScoreCircle score={displayedAnalysis.discipline_score} label={t("dash_discipline")} />
              <DataFieldsSummary fields={displayedAnalysis.data_fields} lang={lang} t={t} />
            </div>
            <div>
              <p className="text-foreground text-lg font-semibold">
                {displayedAnalysis.total_trades} trades
              </p>
              <p className="text-muted text-sm mt-1">
                {displayedAnalysis.violations.length} {displayedAnalysis.violations.length === 1 ? t("analysis_violation_detected_one") : t("analysis_violations_detected")}
              </p>
            </div>
          </div>

          {/* Score breakdown (mobile) */}
          {displayedAnalysis.score_breakdown && displayedAnalysis.score_breakdown.length > 0 && (
            <ScoreBreakdownCard breakdown={displayedAnalysis.score_breakdown} score={displayedAnalysis.discipline_score} t={t} />
          )}

          {/* Le coût de l'indiscipline : montant + courbe contrefactuelle */}
          {displayedAnalysis.insights?.counterfactual && displayedAnalysis.insights.violation_trade_count > 0 && (() => {
            const ins = displayedAnalysis.insights!;
            const cf = ins.counterfactual!;
            const costly = ins.violation_cost < 0;
            return (
              <section className="bg-card border border-border rounded-xl p-6 card-shadow">
                <h2 className="text-lg font-semibold text-foreground">{t("analysis_cost_title")}</h2>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`text-3xl font-bold tabular-nums ${costly ? "text-loss" : "text-profit"}`}>
                    {fmtEuro(ins.violation_cost, displayCurrency)}
                  </span>
                  <span className="text-sm text-muted">
                    {ins.violation_trade_count === 1
                      ? t("analysis_cost_trades_one")
                      : t("analysis_cost_trades").replace("{n}", String(ins.violation_trade_count))}
                  </span>
                </div>
                <p className="text-sm text-muted mt-2">
                  {costly
                    ? t("analysis_cost_clean_vs")
                        .replace("{clean}", fmtEuro(cf.cleanFinal, displayCurrency))
                        .replace("{real}", fmtEuro(cf.realFinal, displayCurrency))
                    : t("analysis_cost_lucky").replace("{amount}", fmtEuro(ins.violation_cost, displayCurrency))}
                </p>
                <div className="mt-4">
                  <CounterfactualChart points={cf.points} />
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded bg-profit inline-block" />
                      <span className="text-muted">{t("analysis_cost_clean_line")} · <span className="text-profit font-medium tabular-nums">{fmtEuro(cf.cleanFinal, displayCurrency)}</span></span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded bg-muted inline-block" />
                      <span className="text-muted">{t("analysis_cost_real_line")} · <span className="text-foreground font-medium tabular-nums">{fmtEuro(cf.realFinal, displayCurrency)}</span></span>
                    </span>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Violations */}
          {displayedAnalysis.violations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_violations")}</h2>
              <div className="space-y-2">
                {displayedAnalysis.violations.map((v, i) => {
                  const isNew = "category" in v;
                  return (
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
                      <div className="flex-1 min-w-0">
                        {isNew ? (
                          <>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                (v as Violation).category === "strategy" ? "bg-loss/10 text-loss" :
                                (v as Violation).category === "behavior" ? "bg-orange-500/10 text-orange-400" :
                                "bg-yellow-500/10 text-yellow-400"
                              }`}>
                                {t(`violation_cat_${(v as Violation).category}` as Parameters<typeof t>[0])}
                              </span>
                              <span className="text-foreground text-sm font-medium">
                                {t(`violation_${(v as Violation).type}` as Parameters<typeof t>[0])}
                              </span>
                              {(v as Violation).occurrences > 1 && (
                                <span className="text-muted text-xs">×{(v as Violation).occurrences}</span>
                              )}
                              {typeof (v as Violation).cost === "number" && (
                                <span className={`ml-auto px-2 py-0.5 rounded-md text-xs font-bold tabular-nums shrink-0 ${
                                  ((v as Violation).cost as number) < 0 ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit"
                                }`}>
                                  {fmtEuro((v as Violation).cost as number, displayCurrency)}
                                </span>
                              )}
                            </div>
                            <p className="text-muted text-sm">{v.explanation}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-foreground text-sm font-medium">
                              {(v as LegacyViolation).pair} · {(v as LegacyViolation).trade_date}
                            </p>
                            <p className="text-loss text-sm">{(v as LegacyViolation).rule_violated}</p>
                            <p className="text-muted text-sm mt-1">{v.explanation}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                      {p.evidence && (
                        <p className="text-xs mt-2 px-2.5 py-1.5 rounded-md bg-surface border border-border/60 text-foreground/80 font-medium tabular-nums">
                          {t("analysis_pattern_evidence")} {p.evidence}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Ton edge réel : le meilleur et le pire segment statistique */}
          {displayedAnalysis.insights?.edge && displayedAnalysis.insights.edge.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_edge_title")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedAnalysis.insights.edge.map((h, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-4 border ${
                      h.kind === "best" ? "bg-profit/5 border-profit/25" : "bg-loss/5 border-loss/25"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${h.kind === "best" ? "text-profit" : "text-loss"}`}>
                      {h.kind === "best" ? t("analysis_edge_best") : t("analysis_edge_worst")}
                    </p>
                    <p className="text-foreground font-bold mt-1.5">
                      {t(`edge_dim_${h.dimension}` as Parameters<typeof t>[0])} · {edgeKeyLabel(h, lang)}
                    </p>
                    <p className={`text-xl font-bold tabular-nums mt-1 ${h.kind === "best" ? "text-profit" : "text-loss"}`}>
                      {fmtEuro(h.netPnl, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {t("analysis_edge_stats").replace("{n}", String(h.trades)).replace("{p}", String(h.winRate))}
                    </p>
                  </div>
                ))}
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

          {/* Revue trade par trade : les plus instructifs, notés A → D */}
          {displayedAnalysis.trade_reviews && displayedAnalysis.trade_reviews.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{t("analysis_reviews_title")}</h2>
              <div className="space-y-2">
                {displayedAnalysis.trade_reviews.map((r, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3.5 flex gap-3 items-start">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${GRADE_STYLES[r.grade] || GRADE_STYLES.C}`}>
                      {r.grade}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground text-sm font-medium">{r.pair}</span>
                        <span className="text-muted text-xs uppercase">{r.direction}</span>
                        <span className="text-muted/70 text-xs">
                          {new Date(r.open_time).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </span>
                        <span className={`ml-auto text-xs font-bold tabular-nums ${r.net_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {fmtEuro(r.net_pnl, displayCurrency)}
                        </span>
                      </div>
                      <p className="text-muted text-sm mt-1">{r.comment}</p>
                    </div>
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

          {/* Plan d'action : 2-3 engagements mesurables pour la suite */}
          {displayedAnalysis.action_plan && displayedAnalysis.action_plan.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-5 card-shadow">
              <h2 className="text-lg font-semibold text-foreground mb-1">{t("analysis_plan_title")}</h2>
              <p className="text-xs text-muted mb-4">{t("analysis_plan_subtitle")}</p>
              <div className="space-y-3">
                {displayedAnalysis.action_plan.map((a, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="font-semibold text-foreground/70">{t("analysis_plan_target")}</span> {a.target}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 flex-wrap">
                {goalsFromPlan === "done" ? (
                  <>
                    <span className="text-sm text-profit font-medium flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t("analysis_plan_goals_done")}
                    </span>
                    <Link href="/dashboard/goals" className="text-sm text-accent hover:underline">
                      {t("analysis_plan_goals_view")}
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => createGoalsFromPlan(displayedAnalysis.action_plan!)}
                      disabled={goalsFromPlan === "saving"}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 btn-scale"
                    >
                      {goalsFromPlan === "saving" ? t("analysis_plan_goals_saving") : t("analysis_plan_goals_cta")}
                    </button>
                    {goalsFromPlan === "error" && (
                      <span className="text-xs text-loss">{t("analysis_plan_goals_error")}</span>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* Auto-save confirmation */}
          {!viewingHistory && saveMessage && (
            <p className="text-sm text-profit">{saveMessage}</p>
          )}
          </div>
        )}

        {/* Free : sous SA vraie analyse, montrer ce que Plus aurait ajouté.
            C'est le remplaçant de l'ancien écran démo : la démo, c'est
            maintenant sa propre analyse, avec la suite verrouillée. */}
        {displayedAnalysis && !loading && plan === "free" && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">{t("teaser_title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: "coach", title: t("teaser_coach_title"), desc: t("teaser_coach_desc") },
                { key: "debrief", title: t("teaser_debrief_title"), desc: t("teaser_debrief_desc") },
                { key: "weekly", title: t("teaser_weekly_title"), desc: t("teaser_weekly_desc") },
              ].map((c) => (
                <Link
                  key={c.key}
                  href="/dashboard/upgrade"
                  onClick={() => track("upgrade_cta_clicked", { source: `teaser_${c.key}` })}
                  className="group bg-card border border-dashed border-border rounded-xl p-4 hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <p className="text-xs font-semibold text-foreground">{c.title}</p>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{c.desc}</p>
                </Link>
              ))}
            </div>
            <p className="text-[11px] text-muted/70 mt-2">{t("teaser_hint")}</p>
          </section>
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
            {isPaidPlan && chatMessages.length > 0 && (
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
              <div ref={chatScrollRef} className="min-h-[500px] max-h-[600px] overflow-y-auto p-4 space-y-4">
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
                <div className="py-6">
                  <div className="text-center">
                    <span className="inline-flex w-9 h-9 rounded-full bg-accent/15 border border-accent/30 items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold text-foreground">{t("coach_showcase_title")}</p>
                    <p className="text-xs text-muted mt-1 mb-4 max-w-md mx-auto">{t("coach_showcase_intro")}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COACH_CAPABILITIES.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => { setChatInput(t(c.exampleKey)); }}
                        className="text-left p-3 rounded-xl border border-border bg-surface/40 hover:border-accent/50 hover:bg-accent/5 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={c.icon} />
                            </svg>
                          </span>
                          <span className="text-xs font-semibold text-foreground">{t(c.titleKey)}</span>
                        </div>
                        <p className="text-[11px] text-muted mt-1.5 pl-8 italic group-hover:text-foreground/80 transition-colors">
                          « {t(c.exampleKey)} »
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-[11px] text-muted/70 mt-4">{t("coach_showcase_hint")}</p>
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
                    {/* Le dock global est masqué sur cette page : sans ce bloc,
                        le coach annonçait un bouton de validation invisible. */}
                    {(msg.confirms ?? []).map((item, ci) => (
                      <CoachConfirmBox
                        key={`c${ci}`}
                        item={item}
                        t={t}
                        onResolve={(accept) => void chat.resolveConfirm(i, ci, accept)}
                      />
                    ))}
                    {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {msg.actions.map((item, ai) => {
                          const meta = coachActionMeta(item.action, t);
                          if (item.undone) {
                            return (
                              <span key={ai} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface border border-border text-muted text-[11px] font-medium line-through">
                                {meta.label}
                              </span>
                            );
                          }
                          const chipInner = (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-profit/10 border border-profit/20 text-profit text-[11px] font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              {meta.label}
                            </span>
                          );
                          const chip = meta.href ? (
                            <Link href={meta.href} className="hover:opacity-80 transition-opacity">{chipInner}</Link>
                          ) : (
                            chipInner
                          );
                          return (
                            <span key={ai} className="inline-flex items-center gap-1">
                              {chip}
                              {item.undo && (
                                <button
                                  onClick={() => undoCoachAction(i, ai)}
                                  className="text-[11px] text-muted hover:text-loss underline decoration-dotted transition-colors"
                                >
                                  {t("coach_action_undo")}
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
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
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>

            {/* Remaining messages */}
            <div className="px-3 pb-2">
              {isPaidPlan ? (
                <p className="text-xs text-muted">
                  {chatRemaining > 0
                    ? (chatRemaining === 1 ? t("coach_remaining_one") : t("coach_remaining")).replace("{n}", String(chatRemaining))
                    : t("coach_no_messages")}
                </p>
              ) : (
                <p className="text-xs text-muted">
                  {freeTasterUsed ? (
                    <>
                      {t("coach_taster_used")}{" "}
                      <Link
                        href="/dashboard/upgrade"
                        onClick={() => track("upgrade_cta_clicked", { source: "taster_footer" })}
                        className="text-accent hover:underline"
                      >
                        {t("coach_taster_cta")}
                      </Link>
                    </>
                  ) : (
                    t("coach_taster_offer")
                  )}
                </p>
              )}
            </div>
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
                {displayedAnalysis.total_trades} trades
              </p>
              <p className="text-muted text-sm mt-1">
                {displayedAnalysis.violations.length} {displayedAnalysis.violations.length === 1 ? t("analysis_violation_detected_one") : t("analysis_violations_detected")}
              </p>
              <p className="text-xs text-muted mt-2">
                {displayedAnalysis.discipline_score >= 90 ? t("band_excellent") :
                 displayedAnalysis.discipline_score >= 75 ? t("band_good") :
                 displayedAnalysis.discipline_score >= 60 ? t("band_ok") :
                 displayedAnalysis.discipline_score >= 40 ? t("band_weak") :
                 t("band_bad")}
              </p>
              <DataFieldsSummary fields={displayedAnalysis.data_fields} lang={lang} t={t} />
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

          {/* Score breakdown card (desktop) */}
          {displayedAnalysis?.score_breakdown && displayedAnalysis.score_breakdown.length > 0 && (
            <ScoreBreakdownCard breakdown={displayedAnalysis.score_breakdown} score={displayedAnalysis.discipline_score} t={t} className="hidden lg:block" />
          )}

          {/* AI Coach Q&A History */}
          {isPaidPlan && (
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">{t("analysis_history")}</h2>
              {history.length >= 2 && (
                <button
                  onClick={toggleCompareMode}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    compareMode ? "bg-accent text-white" : "text-accent hover:bg-accent/10"
                  }`}
                >
                  {t("analysis_compare")}
                </button>
              )}
            </div>
            {compareMode && (
              <p className="text-xs text-muted mb-2">{t("analysis_compare_select")}</p>
            )}
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
                      compareMode && compareSelection.includes(r.id)
                        ? "bg-accent/10 border border-accent/30"
                        : viewingHistory === r.id && !compareMode
                          ? "bg-accent/10 border border-accent/30"
                          : "border border-transparent"
                    }`}
                  >
                    {compareMode && (
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs mr-2 shrink-0 ${
                        compareSelection.includes(r.id) ? "border-accent bg-accent text-white" : "border-border"
                      }`}>
                        {compareSelection.includes(r.id) ? (compareSelection.indexOf(r.id) + 1) : ""}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-xs font-medium">
                        {new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        {r.period_label && <span className="text-muted font-normal"> · {r.period_label}</span>}
                      </p>
                      <p className="text-muted text-[11px]">
                        {r.total_trades} trades
                      </p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${r.discipline_score >= 90 ? "text-profit" : r.discipline_score >= 75 ? "text-green-400" : r.discipline_score >= 60 ? "text-yellow-400" : r.discipline_score >= 40 ? "text-orange-400" : "text-loss"}`}>
                      {r.discipline_score}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>{/* end right column */}

      </div>{/* end flex row */}

      {/* Comparison view */}
      {compareMode && compareA && compareB && (
        <div className="mt-6 bg-card border border-border rounded-xl p-5 card-shadow">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("analysis_compare_title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dates */}
            <div />
            <div className="text-center text-sm text-muted font-medium">
              {new Date(compareA.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </div>
            <div className="text-center text-sm text-muted font-medium">
              {new Date(compareB.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </div>

            {/* Score */}
            <div className="text-sm font-medium text-foreground">{t("analysis_compare_score")}</div>
            <div className={`text-center text-2xl font-bold ${compareA.discipline_score >= 90 ? "text-profit" : compareA.discipline_score >= 75 ? "text-green-400" : compareA.discipline_score >= 60 ? "text-yellow-400" : compareA.discipline_score >= 40 ? "text-orange-400" : "text-loss"}`}>
              {compareA.discipline_score}
            </div>
            <div className="text-center">
              <span className={`text-2xl font-bold ${compareB.discipline_score >= 90 ? "text-profit" : compareB.discipline_score >= 75 ? "text-green-400" : compareB.discipline_score >= 60 ? "text-yellow-400" : compareB.discipline_score >= 40 ? "text-orange-400" : "text-loss"}`}>
                {compareB.discipline_score}
              </span>
              {compareB.discipline_score !== compareA.discipline_score && (
                <span className={`ml-2 text-xs font-medium ${compareB.discipline_score > compareA.discipline_score ? "text-profit" : "text-loss"}`}>
                  {compareB.discipline_score > compareA.discipline_score ? "+" : ""}{compareB.discipline_score - compareA.discipline_score}
                </span>
              )}
            </div>

            {/* Trades */}
            <div className="text-sm font-medium text-foreground">Trades</div>
            <div className="text-center text-sm text-foreground">{compareA.total_trades}</div>
            <div className="text-center text-sm text-foreground">{compareB.total_trades}</div>

            {/* Violations */}
            <div className="text-sm font-medium text-foreground">{t("analysis_compare_violations")}</div>
            <div className="text-center text-sm text-foreground">{compareA.analysis.violations.length}</div>
            <div className="text-center">
              <span className="text-sm text-foreground">{compareB.analysis.violations.length}</span>
              {compareB.analysis.violations.length !== compareA.analysis.violations.length && (
                <span className={`ml-2 text-xs font-medium ${compareB.analysis.violations.length < compareA.analysis.violations.length ? "text-profit" : "text-loss"}`}>
                  {compareB.analysis.violations.length < compareA.analysis.violations.length ? "" : "+"}{compareB.analysis.violations.length - compareA.analysis.violations.length}
                </span>
              )}
            </div>

            {/* Strengths */}
            <div className="text-sm font-medium text-foreground">{t("analysis_compare_strengths")}</div>
            <div className="text-center text-sm text-foreground">{compareA.analysis.strengths.length}</div>
            <div className="text-center text-sm text-foreground">{compareB.analysis.strengths.length}</div>
          </div>

          {/* Evolution summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-foreground">
              <span className="font-medium">{t("analysis_evolution")}:</span>{" "}
              {compareB.discipline_score > compareA.discipline_score ? (
                <span className="text-profit">+{compareB.discipline_score - compareA.discipline_score} pts · {t("analysis_improved")}</span>
              ) : compareB.discipline_score < compareA.discipline_score ? (
                <span className="text-loss">{compareB.discipline_score - compareA.discipline_score} pts · {t("analysis_declined")}</span>
              ) : (
                <span className="text-muted">= stable</span>
              )}
            </p>
          </div>
        </div>
      )}

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
                    {r.period_label && <span className="text-muted font-normal"> · {r.period_label}</span>}
                  </p>
                  <p className="text-muted text-sm">{r.conforming_trades}/{r.total_trades} trades</p>
                </div>
                <span className={`text-2xl font-bold ${r.discipline_score >= 90 ? "text-profit" : r.discipline_score >= 75 ? "text-green-400" : r.discipline_score >= 60 ? "text-yellow-400" : r.discipline_score >= 40 ? "text-orange-400" : "text-loss"}`}>
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
