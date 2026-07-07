"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { formatCurrency } from "@/lib/utils";
import CountUp from "@/components/animations/CountUp";
import ConfettiBurst from "@/components/animations/ConfettiBurst";
import GrowBar from "@/components/animations/GrowBar";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, Plus, Target, CheckCircle2, PenLine, Layers, Flame, Repeat, Sparkles, Clock, CalendarDays, Flag, Crown, Scale, ShieldCheck, Zap, Gauge, TrendingUp, TrendingDown, Minus, Lock, X, Trophy, Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Comparator = "gte" | "lte";
type Period = "day" | "week" | "month" | "quarter" | "year";
type Horizon = "short" | "mid" | "long";
type Tab = "goals" | "discipline";
type CreateMode = "write" | "metric" | "packs";

interface PeriodHistory { key: string; value: number; met: boolean; current: boolean; hadData: boolean }
interface MetricGoal {
  id: string; kind: "metric"; metric: Metric; target: number; comparator: Comparator;
  period: Period; value: number; met: boolean; progress: number;
  history?: PeriodHistory[]; periodStreak?: number;
}
interface CustomGoal { id: string; kind: "custom"; title: string; period: Period; done: boolean; recurring: boolean; streak: number; bestStreak: number }
type Goal = MetricGoal | CustomGoal;

// Insights de discipline (route /api/goals/insights).
interface EdgeSide { count: number; winRate: number; avgNet: number }
interface ScorecardCell { metric: Metric; value: number | null; prev: number | null; betterWhen: Comparator }
interface Insights {
  streak: { current: number; record: number; isRecord: boolean };
  edge: { composed: EdgeSide; impulsive: EdgeSide } | null;
  scorecard: ScorecardCell[];
  trend?: number[];
  heatmap?: { date: string; score: number }[];
  hasTrades: boolean;
  hasReviews: boolean;
}

function periodKeyClient(p: Period): string {
  const now = new Date();
  if (p === "day") {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  if (p === "week") {
    const day = now.getDay();
    const d = new Date(now);
    d.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  if (p === "quarter") {
    return new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 3), 1).toISOString().slice(0, 10);
  }
  if (p === "year") {
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// Bornes de la période courante (pour jours restants + fraction écoulée).
function periodBounds(p: Period): { start: Date; end: Date } {
  const now = new Date();
  if (p === "day") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (p === "week") {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (p === "quarter") {
    const start = new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 3), 1);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, 1) };
  }
  if (p === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}
function daysLeftIn(p: Period): number {
  const { end } = periodBounds(p);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}
function elapsedFraction(p: Period): number {
  const { start, end } = periodBounds(p);
  return Math.min(1, Math.max(0, (Date.now() - start.getTime()) / (end.getTime() - start.getTime())));
}

// Packs d'objectifs prêts à l'emploi (i18n via les clés ci-dessous).
interface Pack {
  id: string;
  metrics: { metric: Metric; target: number; period: Period }[];
  habits: { titleKey: string; period: Period }[];
}
const PACKS: Pack[] = [
  { id: "prep", metrics: [{ metric: "sessions", target: 12, period: "month" }, { metric: "discipline_score", target: 80, period: "month" }], habits: [{ titleKey: "pack_prep_habit", period: "week" }] },
  { id: "antitilt", metrics: [{ metric: "trades_per_day", target: 3, period: "month" }, { metric: "max_consecutive_losses", target: 3, period: "month" }], habits: [{ titleKey: "pack_antitilt_habit", period: "week" }] },
  { id: "consistency", metrics: [{ metric: "win_rate", target: 50, period: "month" }, { metric: "discipline_score", target: 85, period: "month" }], habits: [{ titleKey: "pack_consistency_habit", period: "week" }] },
];

const METRIC_COMPARATOR: Record<Metric, Comparator> = {
  discipline_score: "gte", sessions: "gte", win_rate: "gte", trades_per_day: "lte", max_consecutive_losses: "lte",
};
const METRICS: Metric[] = ["discipline_score", "sessions", "win_rate", "trades_per_day", "max_consecutive_losses"];
const PERIODS: Period[] = ["day", "week", "month", "quarter", "year"];

// Horizon temporel d'un objectif (du plus court au plus long terme).
const HORIZON_OF: Record<Period, Horizon> = { day: "short", week: "short", month: "mid", quarter: "mid", year: "long" };
const HORIZONS: Horizon[] = ["short", "mid", "long"];
const HORIZON_ICON: Record<Horizon, typeof Clock> = { short: Clock, mid: CalendarDays, long: Flag };
// Accent visuel par horizon (chip d'icône + teinte de bandeau).
const HORIZON_STYLE: Record<Horizon, { chip: string; icon: string; tint: string }> = {
  short: { chip: "bg-accent/10", icon: "text-accent", tint: "from-accent/[0.07]" },
  mid: { chip: "bg-violet-500/10", icon: "text-violet-400", tint: "from-violet-500/[0.07]" },
  long: { chip: "bg-warning/10", icon: "text-warning", tint: "from-warning/[0.07]" },
};
// Cible par défaut quand on transforme une métrique du scorecard en objectif (1 clic).
const DEFAULT_TARGET: Record<Metric, number> = {
  discipline_score: 85, sessions: 12, win_rate: 50, trades_per_day: 3, max_consecutive_losses: 2,
};

function unit(m: Metric) { return m === "win_rate" ? "%" : m === "discipline_score" ? "/100" : ""; }

// Pastille de statut + remplissage de barre (couleur selon l'état de l'objectif).
function statusVisual(status: "met" | "failed" | "progress") {
  if (status === "met") return { dot: "bg-profit shadow-[0_0_8px_rgb(var(--profit)/0.45)]", bar: "bg-profit", badge: "bg-profit/10 text-profit", text: "text-profit" };
  if (status === "failed") return { dot: "bg-loss shadow-[0_0_8px_rgb(var(--loss)/0.45)]", bar: "bg-loss", badge: "bg-loss/10 text-loss", text: "text-loss" };
  return { dot: "bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.45)]", bar: "bg-gradient-to-r from-accent to-cyan-300", badge: "bg-surface text-muted", text: "text-foreground" };
}

// Mini-courbe d'évolution du score de discipline (aire + ligne, vert/rouge selon
// la pente globale). Pure SVG, sans dépendance.
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const w = 132, h = 38, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "rgb(var(--profit))" : "rgb(var(--loss))";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="goals-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#goals-spark)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  );
}

// Couleur d'une case de heatmap selon le score de discipline du jour.
function heatCls(score: number | null): string {
  if (score == null) return "bg-surface/50";
  if (score >= 85) return "bg-profit/80";
  if (score >= 70) return "bg-green-500/55";
  if (score >= 50) return "bg-yellow-500/45";
  return "bg-loss/55";
}

// Heatmap de régularité façon GitHub : ~13 semaines × 7 jours, colorée par le
// score de discipline quotidien (échelle de qualité, pas d'« intensité »).
// Repères mois + jours, « aujourd'hui » marqué, et stats de synthèse à droite.
function DisciplineHeatmap({ data, t }: { data: { date: string; score: number }[]; t: (k: string) => string }) {
  const WEEKS = 13;
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const scoreByDate = new Map(data.map((h) => [h.date, h.score]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = ymd(today);
  const monOffset = (today.getDay() + 6) % 7; // lundi = 0
  const start = new Date(today); start.setDate(today.getDate() - monOffset - (WEEKS - 1) * 7);

  type Cell = { iso: string; score: number | null; isToday: boolean; future: boolean };
  const cols: Cell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start); cur.setDate(start.getDate() + w * 7 + d);
      const iso = ymd(cur);
      week.push({ iso, score: scoreByDate.get(iso) ?? null, isToday: iso === todayIso, future: cur > today });
    }
    cols.push(week);
  }

  // Libellé de mois au-dessus de la 1re colonne de chaque mois.
  const monthLabels = cols.map((week, wi) => {
    const m = new Date(week[0].iso + "T00:00:00").getMonth();
    const prev = wi > 0 ? new Date(cols[wi - 1][0].iso + "T00:00:00").getMonth() : -1;
    return m !== prev ? new Date(week[0].iso + "T00:00:00").toLocaleDateString(undefined, { month: "short" }) : "";
  });

  // Stats de synthèse.
  const scores = data.map((d) => d.score);
  const daysTracked = scores.length;
  const avg = daysTracked ? Math.round(scores.reduce((a, b) => a + b, 0) / daysTracked) : null;
  const disciplinedDays = scores.filter((s) => s >= 70).length;
  const avgCls = avg == null ? "text-muted" : avg >= 85 ? "text-profit" : avg >= 70 ? "text-green-400" : avg >= 50 ? "text-warning" : "text-loss";

  const CELL = "w-3.5 h-3.5";
  const wdShown = [0, 2, 4]; // Lun, Mer, Ven

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
      <div className="overflow-x-auto pb-1 shrink-0">
        {/* Libellés de mois */}
        <div className="flex gap-[3px] mb-1">
          <span className="w-4 shrink-0" />
          {monthLabels.map((m, wi) => (
            <span key={wi} className="w-3.5 shrink-0 text-[9px] text-muted whitespace-nowrap overflow-visible">{m}</span>
          ))}
        </div>
        {/* Colonne jours + grille */}
        <div className="flex gap-[3px]">
          <div className="w-4 shrink-0 flex flex-col gap-[3px]">
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <span key={r} className="h-3.5 text-[8px] text-muted leading-[14px] text-right pr-0.5">{wdShown.includes(r) ? t(`review_wd_${r}`) : ""}</span>
            ))}
          </div>
          {cols.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) =>
                cell.future ? (
                  <span key={di} className={CELL} />
                ) : (
                  <span key={di}
                    title={`${new Date(cell.iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${cell.score != null ? `${cell.score}/100` : t("goals_heatmap_no_data")}`}
                    className={`${CELL} rounded-[3px] transition-transform hover:scale-125 ${heatCls(cell.score)} ${cell.score == null ? "border border-border/60" : ""} ${cell.isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}`}
                  />
                ),
              )}
            </div>
          ))}
        </div>
        {/* Légende : échelle de qualité + pas de session (distinct) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span>{t("goals_heatmap_legend_low")}</span>
            <span className="flex gap-0.5">
              <span className="w-3 h-3 rounded-[3px] bg-loss/55" />
              <span className="w-3 h-3 rounded-[3px] bg-yellow-500/45" />
              <span className="w-3 h-3 rounded-[3px] bg-green-500/55" />
              <span className="w-3 h-3 rounded-[3px] bg-profit/80" />
            </span>
            <span>{t("goals_heatmap_legend_high")}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-surface/50 border border-border/60" />
            <span>{t("goals_heatmap_no_data")}</span>
          </span>
        </div>
      </div>

      {/* Synthèse — s'étire pour remplir l'espace à droite de la grille */}
      <div className="flex-1 grid grid-cols-3 gap-3 self-stretch lg:self-auto">
        <div className="rounded-xl border border-border bg-surface/30 p-4 flex flex-col justify-center">
          <p className="text-2xl font-black text-foreground tabular-nums leading-none">{daysTracked}</p>
          <p className="text-xs text-muted mt-1.5">{t("goals_heatmap_days_tracked")}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/30 p-4 flex flex-col justify-center">
          <p className={`text-2xl font-black tabular-nums leading-none ${avgCls}`}>{avg == null ? "—" : avg}<span className="text-sm text-muted font-bold">{avg == null ? "" : "/100"}</span></p>
          <p className="text-xs text-muted mt-1.5">{t("goals_heatmap_avg")}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/30 p-4 flex flex-col justify-center">
          <p className="text-2xl font-black text-profit tabular-nums leading-none">{disciplinedDays}</p>
          <p className="text-xs text-muted mt-1.5">{t("goals_heatmap_disciplined")}</p>
        </div>
      </div>
    </div>
  );
}

// Pastilles d'historique : chaque période passée évaluée rétroactivement
// (✓ vert / ✗ rouge / neutre si aucune activité), la courante cerclée.
function HistoryDots({ history, unit: u, t }: { history: PeriodHistory[]; unit: string; t: (k: string) => string }) {
  if (!history || history.length < 2) return null;
  return (
    <div className="flex items-center gap-[3px]">
      {history.map((h) => {
        const cls = h.current
          ? h.met ? "bg-profit ring-1 ring-profit/70 ring-offset-1 ring-offset-card" : "bg-accent/70 ring-1 ring-accent/70 ring-offset-1 ring-offset-card"
          : !h.hadData ? "bg-surface border border-border/70"
          : h.met ? "bg-profit/80" : "bg-loss/45";
        const status = h.current ? t("goals_hist_current") : !h.hadData ? t("goals_hist_nodata") : h.met ? t("goals_hist_met") : t("goals_hist_missed");
        return (
          <span
            key={h.key}
            title={`${h.key} · ${h.value}${u} · ${status}`}
            role="img"
            aria-label={`${h.key} : ${status}`}
            className={`w-2 h-2 rounded-[2px] shrink-0 ${cls}`}
          />
        );
      })}
    </div>
  );
}

// Statut + priorité unifiés (objectifs mesurés et perso). Plus la priorité est
// basse, plus l'objectif remonte en haut de son horizon (ce qui demande attention).
function goalStatus(g: Goal): { status: "met" | "failed" | "progress"; priority: number } {
  if (g.kind === "custom") {
    return g.done ? { status: "met", priority: 3 } : { status: "progress", priority: 1 };
  }
  const failing = !g.met && g.comparator === "lte" && g.value > g.target;
  if (g.met) return { status: "met", priority: 3 };
  if (failing) return { status: "failed", priority: 0 };
  return { status: "progress", priority: 1 };
}

// Grille des colonnes du tableau (desktop) — partagée entre l'en-tête et les
// lignes pour un alignement parfait : Objectif | Échéance | Progression |
// Historique | Statut | actions.
const TABLE_GRID = "md:grid-cols-[minmax(0,1.6fr)_92px_minmax(150px,1.2fr)_100px_104px_36px]";

export default function GoalsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("goals");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dismissedRecos, setDismissedRecos] = useState<Set<string>>(new Set());
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Modale de création unifiée (3 modes : décrire / métrique / packs).
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("write");
  // Bannière de feedback après interprétation IA (auto-suivi vs à cocher).
  const [notice, setNotice] = useState<"auto" | "manual" | null>(null);

  // Objectif perso (texte)
  const [customText, setCustomText] = useState("");
  const [customPeriod, setCustomPeriod] = useState<Period>("week");
  const [customRecurring, setCustomRecurring] = useState(true);

  // Objectif mesuré custom
  const [metric, setMetric] = useState<Metric>("discipline_score");
  const [target, setTarget] = useState("85");
  const [period, setPeriod] = useState<Period>("month");

  // Recommandations IA basées sur les faiblesses détectées
  interface Reco { metric: Metric; comparator: Comparator; target: number; period: Period; reasonKey: string; reasonValue: number }
  const [recos, setRecos] = useState<Reco[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Célébration quand un objectif mesuré vient de passer à « atteint »
  // (comparaison avec l'état mémorisé de la dernière visite — jamais au 1er chargement).
  useEffect(() => {
    if (loading) return;
    const metric = goals.filter((g): g is MetricGoal => g.kind === "metric");
    if (metric.length === 0) return;
    try {
      const raw = localStorage.getItem("goals_met_snapshot");
      const prev: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      const newlyMet = metric.some((g) => g.met && prev[g.id] === false);
      const snapshot: Record<string, boolean> = {};
      for (const g of metric) snapshot[g.id] = g.met;
      localStorage.setItem("goals_met_snapshot", JSON.stringify(snapshot));
      if (newlyMet) setShowConfetti(true);
    } catch {
      // stockage indisponible (navigation privée) — pas de célébration, pas d'erreur
    }
  }, [goals, loading]);

  useEffect(() => {
    fetch("/api/goals/recommend")
      .then((r) => r.json())
      .then((d) => setRecos(d.recommendations ?? []))
      .catch(() => setRecos([]));
    fetch("/api/goals/insights")
      .then((r) => r.json())
      // Ne jamais écraser des insights valides par un échec transitoire
      // (ex. requête doublée pendant un refresh de session).
      .then((d) => { if (d?.scorecard) setInsights(d); })
      .catch(() => { /* on garde l'état précédent */ })
      .finally(() => setInsightsLoaded(true));
  }, []);

  // Modale : fermeture au clavier (Échap) + verrou du scroll de fond.
  useEffect(() => {
    if (!showCreate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowCreate(false); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showCreate]);

  // La bannière de feedback IA se dissipe seule.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(id);
  }, [notice]);

  async function addMetricGoal(m: Metric, tgt: number, p: Period) {
    if (isNaN(tgt) || tgt <= 0) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // On omet 'kind' (défaut SQL 'metric') pour rester compatible avant la migration.
      await supabase.from("goals").insert({ user_id: user.id, metric: m, target: tgt, comparator: METRIC_COMPARATOR[m], period: p });
      await load();
    }
    setBusy(false);
  }

  async function createCustom(title: string, p: Period, recurring: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Insert de base (compatible même sans les colonnes de récurrence).
    const { data: inserted } = await supabase
      .from("goals")
      .insert({ user_id: user.id, kind: "custom", title, period: p, done: false })
      .select("id")
      .maybeSingle();
    // Récurrence en 2e temps (best-effort si colonnes absentes).
    if (recurring && inserted?.id) {
      await supabase.from("goals").update({ recurring: true, period_key: periodKeyClient(p) }).eq("id", inserted.id);
    }
  }

  async function addCustomGoal() {
    const title = customText.trim();
    if (!title) return;
    setBusy(true);
    try {
      // 1. L'IA tente de transformer l'objectif écrit en objectif mesurable (auto-suivi).
      const res = await fetch("/api/goals/interpret", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: title, period: customPeriod }),
      });
      const data = await res.json().catch(() => ({ trackable: false }));
      if (res.ok && data.trackable && data.metric) {
        // 2a. Mesurable → objectif suivi automatiquement.
        await addMetricGoal(data.metric, Number(data.target), customPeriod);
        setNotice("auto");
      } else {
        // 2b. Non mesurable → objectif à cocher manuellement.
        await createCustom(title, customPeriod, customRecurring);
        await load();
        setNotice("manual");
      }
      setCustomText("");
      setShowCreate(false);
    } finally {
      setBusy(false);
    }
  }

  async function applyPack(pack: Pack) {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const existingMetrics = new Set(metricGoals.map((g) => `${g.metric}:${g.period}`));
      for (const m of pack.metrics) {
        if (existingMetrics.has(`${m.metric}:${m.period}`)) continue;
        await supabase.from("goals").insert({ user_id: user.id, metric: m.metric, target: m.target, comparator: METRIC_COMPARATOR[m.metric], period: m.period });
      }
      for (const h of pack.habits) {
        await createCustom(t(h.titleKey), h.period, true);
      }
      await load();
    }
    setBusy(false);
    setShowCreate(false);
  }

  async function toggleDone(id: string, done: boolean) {
    setGoals((gs) => gs.map((g) => (g.id === id && g.kind === "custom" ? { ...g, done } : g)));
    if (done) setShowConfetti(true); // petite célébration à la complétion
    await supabase.from("goals").update({ done }).eq("id", id);
  }

  async function removeGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((g) => g.filter((x) => x.id !== id));
  }

  // Édition inline de la cible d'un objectif mesuré (re-fetch pour recalculer met/progress).
  async function updateTarget(id: string, newTarget: number, oldTarget: number) {
    setEditingTarget(null);
    if (isNaN(newTarget) || newTarget <= 0 || newTarget === oldTarget) return;
    await supabase.from("goals").update({ target: newTarget }).eq("id", id);
    await load();
  }

  function metricLabel(m: Metric) { return t(`goal_metric_${m}`); }
  function periodLabel(p: Period) { return t(`goals_period_${p}`); }

  const metricGoals = goals.filter((g): g is MetricGoal => g.kind === "metric");
  const customGoals = goals.filter((g): g is CustomGoal => g.kind === "custom");
  const achieved = metricGoals.filter((g) => g.met).length + customGoals.filter((g) => g.done).length;

  const existing = new Set(metricGoals.map((g) => `${g.metric}:${g.period}`));
  // Recommandations non encore ajoutées (par métrique + période) ni rejetées.
  const recoToShow = recos.filter((r) => {
    const key = `${r.metric}:${r.period}`;
    return !existing.has(key) && !dismissedRecos.has(key);
  });

  // Objectifs groupés par horizon temporel, triés par priorité (à surveiller d'abord).
  const byHorizon: Record<Horizon, Goal[]> = { short: [], mid: [], long: [] };
  for (const g of goals) byHorizon[HORIZON_OF[g.period]].push(g);
  for (const h of HORIZONS) byHorizon[h].sort((a, b) => goalStatus(a).priority - goalStatus(b).priority);

  // Compteurs de synthèse (chips au-dessus du tableau).
  const counts = goals.reduce(
    (acc, g) => { acc[goalStatus(g).status] += 1; return acc; },
    { met: 0, failed: 0, progress: 0 } as Record<"met" | "failed" | "progress", number>,
  );

  // « Prochaine victoire » : l'objectif mesuré en cours le plus proche d'être
  // atteint (assez avancé pour être motivant, pas encore gagné).
  const focusGoal = metricGoals
    .filter((g) => !g.met && g.progress >= 25 && g.progress < 100)
    .sort((a, b) => b.progress - a.progress)[0] ?? null;
  const focusGap = focusGoal
    ? focusGoal.comparator === "gte"
      ? t("goals_gap_below").replace("{gap}", `${Math.round((focusGoal.target - focusGoal.value) * 10) / 10}${unit(focusGoal.metric)}`)
      : t("goals_gap_above").replace("{gap}", `${Math.round((focusGoal.value - focusGoal.target) * 10) / 10}${unit(focusGoal.metric)}`)
    : null;

  // ── Dérivés des insights de discipline ───────────────────────────────────
  const streak = insights?.streak;
  // Prochain palier de série (3 → 10 → 30).
  const nextMilestone = !streak ? null : streak.current < 3 ? 3 : streak.current < 10 ? 10 : streak.current < 30 ? 30 : null;
  const prevMilestone = !streak ? 0 : streak.current < 3 ? 0 : streak.current < 10 ? 3 : streak.current < 30 ? 10 : 30;
  const milestonePct = nextMilestone && streak ? Math.min(100, ((streak.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100) : 100;
  // Date projetée du prochain palier si la série continue (jours de semaine uniquement).
  const milestoneDate = nextMilestone && streak ? (() => {
    const d = new Date();
    let added = 0;
    const need = nextMilestone - streak.current;
    while (added < need) {
      d.setDate(d.getDate() + 1);
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) added += 1;
    }
    return d;
  })() : null;
  // Trajectoire de discipline : score moyen du mois vs mois précédent.
  const discCell = insights?.scorecard.find((s) => s.metric === "discipline_score");
  const traj = discCell && discCell.value != null && discCell.prev != null
    ? { dir: discCell.value - discCell.prev >= 3 ? "up" : discCell.value - discCell.prev <= -3 ? "down" : "flat", delta: discCell.value - discCell.prev }
    : null;
  // Edge : écart de réussite posé vs impulsif.
  const edge = insights?.edge;
  const winGap = edge ? edge.composed.winRate - edge.impulsive.winRate : 0;
  const avgGap = edge ? edge.composed.avgNet - edge.impulsive.avgNet : 0;
  const trend = insights?.trend ?? [];
  const heatmap = insights?.heatmap ?? [];

  const showDiscipline = insights && (insights.hasTrades || insights.hasReviews);
  const isNewUser = insightsLoaded && insights != null && !insights.hasTrades && !insights.hasReviews;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}

      {/* ═══ En-tête : titre + action de création unique ═══ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("goals_page_title")}</h1>
          <p className="text-muted mt-1">{t("goals_subtitle")}</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateMode("write"); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> {t("goals_new_btn")}
        </button>
      </div>

      {/* Skeletons pendant le chargement des insights */}
      {!insightsLoaded && (
        <div className="mt-6 space-y-5" aria-hidden>
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-10 w-72 rounded-xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      )}

      {/* Onboarding nouvel utilisateur (aucune donnée encore) */}
      {isNewUser && (
        <div className="mt-6 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("goals_onboarding_title")}</h2>
              <p className="text-sm text-muted mt-1 max-w-2xl">{t("goals_onboarding_body")}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Hero — série de discipline + trajectoire + complétion des objectifs ═══ */}
      {insightsLoaded && insights?.hasTrades && streak && (
        <KpiCardPremium layout="full" accentColor="amber" intensity="hero" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex items-center gap-3.5">
              <Flame className={`w-10 h-10 shrink-0 ${streak.current > 0 ? "text-warning" : "text-muted/50"}`} strokeWidth={1.75} />
              <div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <CountUp end={streak.current} duration={1.1} className="text-3xl font-black tabular-nums text-foreground leading-none" />
                  <span className="text-sm text-muted">{t("goals_streak_days")}</span>
                  {streak.isRecord && streak.current >= 3 && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                      <Crown className="w-3 h-3" strokeWidth={2} /> {t("goals_new_record")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">{t("goals_streak_desc")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              {trend.length >= 3 && (
                <div className="hidden sm:block text-right">
                  <Sparkline data={trend} />
                  <p className="text-[10px] text-muted mt-0.5">{t("goals_spark_label")}</p>
                </div>
              )}
              {traj && (
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${traj.dir === "up" ? "text-profit" : traj.dir === "down" ? "text-loss" : "text-warning"}`}>
                    {traj.dir === "up" ? <TrendingUp className="w-4 h-4" /> : traj.dir === "down" ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {t(`goals_traj_${traj.dir}`)}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{t("goals_traj_sub")}</p>
                </div>
              )}
              {streak.record > 0 && (
                <div className="text-center border-l border-border pl-4 sm:pl-5">
                  <p className="text-xl font-black tabular-nums text-foreground leading-none">{streak.record}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted mt-1">{t("goals_record")}</p>
                </div>
              )}
              {goals.length > 0 && (
                <div className="flex flex-col items-center border-l border-border pl-4 sm:pl-5">
                  <div className="relative w-11 h-11">
                    <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--surface))" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--profit))" strokeWidth="3.5"
                        strokeDasharray={`${(achieved / goals.length) * 100} 100`} strokeLinecap="round" pathLength={100} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground tabular-nums">{achieved}/{goals.length}</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted mt-1">{t("goals_ring_label")}</p>
                </div>
              )}
            </div>
          </div>
          {nextMilestone && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-foreground-muted">{t("goals_milestone_to_next").replace("{n}", String(nextMilestone - streak.current)).replace("{m}", String(nextMilestone))}</span>
                <span className="text-[11px] text-foreground-muted tabular-nums">{streak.current}/{nextMilestone}</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <GrowBar pct={Math.max(3, milestonePct)} className="rounded-full bg-gradient-to-r from-accent to-warning" />
              </div>
              {milestoneDate && streak.current > 0 && (
                <p className="text-[11px] text-muted mt-1.5">
                  {t("goals_milestone_forecast").replace("{m}", String(nextMilestone)).replace("{date}", milestoneDate.toLocaleDateString(undefined, { day: "numeric", month: "long" }))}
                </p>
              )}
            </div>
          )}
        </KpiCardPremium>
      )}

      {/* ═══ Navigation : Mes objectifs / Ma discipline ═══ */}
      {insightsLoaded && (
        <div className="mt-6 inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setTab("goals")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "goals" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >
            <Target className="w-4 h-4" /> {t("goals_tab_goals")}
            {goals.length > 0 && (
              <span className={`text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 ${tab === "goals" ? "bg-accent/15" : "bg-surface"}`}>{goals.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("discipline")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "discipline" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >
            <Activity className="w-4 h-4" /> {t("goals_tab_discipline")}
          </button>
        </div>
      )}

      {/* Bannière de feedback après création via IA */}
      {notice && (
        <div className={`mt-4 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${notice === "auto" ? "border-profit/30 bg-profit/[0.05] text-foreground" : "border-accent/30 bg-accent/[0.05] text-foreground"}`}>
          <Sparkles className={`w-4 h-4 shrink-0 ${notice === "auto" ? "text-profit" : "text-accent"}`} />
          <span>{notice === "auto" ? t("goals_ai_auto") : t("goals_ai_manual")}</span>
          <button onClick={() => setNotice(null)} className="ml-auto text-muted/50 hover:text-muted transition-colors" aria-label={t("close")}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ═══════════════════════ Onglet « Mes objectifs » ═══════════════════════ */}
      {insightsLoaded && tab === "goals" && (
        <div className="mt-5 space-y-5">

          {/* Prochaine victoire — l'objectif le plus proche d'être atteint */}
          {focusGoal && (
            <div className="rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/[0.06] to-transparent p-4 sm:p-5 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10 shrink-0">
                <Trophy className="w-5 h-5 text-accent" />
              </span>
              <div className="flex-1 min-w-[220px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{t("goals_focus_title")}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {metricLabel(focusGoal.metric)}{" "}
                  <span className="text-muted font-normal">{focusGoal.comparator === "gte" ? "≥" : "≤"} {focusGoal.target}{unit(focusGoal.metric)} · {periodLabel(focusGoal.period)}</span>
                </p>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="flex-1 max-w-xs h-2 rounded-full bg-surface overflow-hidden">
                    <GrowBar pct={Math.max(3, focusGoal.progress)} className="rounded-full bg-gradient-to-r from-accent to-cyan-300" />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground">{focusGoal.value}{unit(focusGoal.metric)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tabular-nums text-accent leading-none">{focusGoal.progress}%</p>
                <p className="text-[11px] text-muted mt-1 max-w-[160px]">{focusGap}</p>
              </div>
            </div>
          )}

          {/* Recommandé pour toi (IA, basé sur tes faiblesses détectées) */}
          {recoToShow.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> {t("goals_reco_title")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recoToShow.map((r) => (
                  <div key={`${r.metric}:${r.period}`} className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {metricLabel(r.metric)}{" "}
                        <span className="text-muted font-normal">{r.comparator === "gte" ? "≥" : "≤"} {r.target}{unit(r.metric)} · {periodLabel(r.period)}</span>
                      </p>
                      <p className="text-xs text-muted mt-0.5">{t(r.reasonKey).replace("{v}", String(r.reasonValue))}</p>
                    </div>
                    <button onClick={() => addMetricGoal(r.metric, r.target, r.period)} disabled={busy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 shrink-0">
                      <Plus className="w-3.5 h-3.5" /> {t("goals_add_quick")}
                    </button>
                    <button onClick={() => setDismissedRecos((s) => new Set(s).add(`${r.metric}:${r.period}`))}
                      className="shrink-0 text-muted/40 hover:text-muted transition-colors p-1 -mr-1" aria-label={t("goals_reco_dismiss")} title={t("goals_reco_dismiss")}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Le tableau des objectifs ── */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> {t("goals_roadmap_title")}
              </h2>
              {goals.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {counts.met === goals.length ? (
                    <span className="text-[11px] font-semibold text-profit bg-profit/10 rounded-full px-2.5 py-1">{t("goals_all_met")}</span>
                  ) : (
                    <>
                      {counts.met > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-profit bg-profit/10 rounded-full px-2.5 py-1">
                          <CheckCircle2 className="w-3 h-3" /> {counts.met} {t("goals_stat_met")}
                        </span>
                      )}
                      {counts.progress > 0 && (
                        <span className="text-[11px] font-semibold text-accent bg-accent/10 rounded-full px-2.5 py-1">{counts.progress} {t("goals_stat_progress")}</span>
                      )}
                      {counts.failed > 0 && (
                        <span className="text-[11px] font-semibold text-loss bg-loss/10 rounded-full px-2.5 py-1">{counts.failed} {t("goals_stat_risk")}</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="skeleton h-48 rounded-2xl" />
            ) : goals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-3">
                  <Target className="w-6 h-6 text-muted/50" />
                </div>
                <p className="text-muted text-sm">{t("goals_empty_new")}</p>
                <button
                  onClick={() => { setShowCreate(true); setCreateMode("write"); }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t("goals_empty_cta")}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_0_rgb(255_255_255/0.02)_inset]">
                {/* En-tête de tableau (desktop) */}
                <div className={`hidden md:grid ${TABLE_GRID} gap-x-4 items-center px-5 py-2.5 bg-surface/40 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted`}>
                  <span>{t("goals_col_objective")}</span>
                  <span>{t("goals_col_period")}</span>
                  <span>{t("goals_col_progress")}</span>
                  <span>{t("goals_col_history")}</span>
                  <span>{t("goals_col_status")}</span>
                  <span />
                </div>

                {HORIZONS.filter((h) => byHorizon[h].length > 0).map((h) => {
                  const rows = byHorizon[h];
                  const HIcon = HORIZON_ICON[h];
                  const hs = HORIZON_STYLE[h];
                  return (
                    <div key={h}>
                      {/* Bandeau d'horizon */}
                      <div className={`flex items-center gap-2.5 px-4 sm:px-5 py-2.5 bg-gradient-to-r ${hs.tint} to-transparent border-t border-border first:border-t-0`}>
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${hs.chip}`}>
                          <HIcon className={`w-3.5 h-3.5 ${hs.icon}`} />
                        </span>
                        <span className="text-[13px] font-semibold text-foreground">{t(`goals_horizon_${h}`)}</span>
                        <span className="text-[11px] text-muted/70 hidden sm:inline">{t(`goals_horizon_${h}_sub`)}</span>
                        <span className="ml-auto text-[11px] font-semibold text-muted bg-surface rounded-full px-2 py-0.5 tabular-nums">{rows.length}</span>
                      </div>

                      {/* Lignes */}
                      {rows.map((g) => {
                        const { status } = goalStatus(g);
                        const sv = statusVisual(status);
                        const statusLabel = g.kind === "custom"
                          ? (g.done ? t("goals_status_met") : t("goals_status_todo"))
                          : t(`goals_status_${status}`);
                        return (
                          <div key={g.id} className={`group grid grid-cols-[minmax(0,1fr)_36px] ${TABLE_GRID} gap-x-4 gap-y-2 items-center px-4 sm:px-5 py-3.5 border-t border-border/50 hover:bg-surface/30 transition-colors`}>

                            {/* Col. Objectif : contrôle + nom + détails */}
                            <div className="flex items-center gap-3 min-w-0">
                              {g.kind === "custom" ? (
                                <button onClick={() => toggleDone(g.id, !g.done)} className="shrink-0" aria-label={t("goals_toggle_done")}>
                                  {g.done
                                    ? <CheckCircle2 className="w-5 h-5 text-profit" />
                                    : <span className="block w-5 h-5 rounded-full border-2 border-border group-hover:border-accent/60 transition-colors" />}
                                </button>
                              ) : (
                                <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${sv.dot}`} title={statusLabel} aria-label={statusLabel} role="img" />
                              )}
                              <div className="min-w-0 flex-1">
                                {g.kind === "metric" ? (
                                  <>
                                    <p className="font-medium text-foreground text-sm leading-tight truncate flex items-center gap-1.5">
                                      {metricLabel(g.metric)}
                                      {(g.periodStreak ?? 0) >= 2 && (
                                        <span
                                          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-orange-400 shrink-0"
                                          title={t("goals_period_streak").replace("{n}", String(g.periodStreak))}
                                        >
                                          <Flame className="w-3 h-3" /> {g.periodStreak}
                                        </span>
                                      )}
                                    </p>
                                    {editingTarget === g.id ? (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[11px] text-muted">{g.comparator === "gte" ? "≥" : "≤"}</span>
                                        <input
                                          type="number" autoFocus value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                          onBlur={() => updateTarget(g.id, parseFloat(editValue), g.target)}
                                          className="w-16 px-1.5 py-0.5 bg-surface border border-accent/50 rounded text-[11px] text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                        <span className="text-[11px] text-muted">{unit(g.metric)}</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setEditingTarget(g.id); setEditValue(String(g.target)); }}
                                        title={t("goals_edit_target")} aria-label={t("goals_edit_target")}
                                        className="group/edit inline-flex items-center gap-1 text-[11px] text-muted mt-0.5 hover:text-accent transition-colors">
                                        {g.comparator === "gte" ? "≥" : "≤"} {g.target}{unit(g.metric)}
                                        <PenLine className="w-2.5 h-2.5 opacity-0 group-hover/edit:opacity-60 transition-opacity" />
                                      </button>
                                    )}
                                    {/* Projection de rythme (métriques cumulatives uniquement) */}
                                    {g.metric === "sessions" && !g.met && (() => {
                                      const frac = elapsedFraction(g.period);
                                      if (frac < 0.1) return null;
                                      const proj = Math.round(g.value / frac);
                                      const on = proj >= g.target;
                                      return (
                                        <p className={`text-[10px] mt-0.5 ${on ? "text-profit" : "text-warning"}`}>
                                          {t(on ? "goals_pace_on" : "goals_pace_behind").replace("{proj}", String(proj))}
                                        </p>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  <>
                                    <p className={`font-medium text-sm leading-tight ${g.done ? "text-muted line-through" : "text-foreground"}`}>{g.title}</p>
                                    {g.recurring && (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted/70">
                                          <Repeat className="w-3 h-3" /> {t("goals_recurring_badge")}
                                        </span>
                                        {g.streak > 0 && (
                                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-orange-400" title={t("goals_best_streak").replace("{n}", String(g.bestStreak))}>
                                            <Flame className="w-3 h-3" /> {g.streak}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Col. Échéance (desktop) */}
                            <div className="hidden md:flex flex-col">
                              <span className="text-xs text-foreground-muted whitespace-nowrap">{periodLabel(g.period)}</span>
                              {g.period !== "day" && status !== "met" && (
                                <span className="text-[10px] text-muted/60 tabular-nums whitespace-nowrap mt-0.5">{t("goals_days_left").replace("{n}", String(daysLeftIn(g.period)))}</span>
                              )}
                            </div>

                            {/* Col. Progression (desktop) */}
                            <div className="hidden md:flex items-center gap-2.5">
                              {g.kind === "metric" ? (
                                <>
                                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                                    <GrowBar pct={Math.max(3, g.progress)} className={`rounded-full ${sv.bar}`} />
                                  </div>
                                  <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${sv.text}`}>{g.value}{unit(g.metric)}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted/30">—</span>
                              )}
                            </div>

                            {/* Col. Historique (desktop) */}
                            <div className="hidden md:block">
                              {g.kind === "metric" && g.history ? (
                                <HistoryDots history={g.history} unit={unit(g.metric)} t={t} />
                              ) : (
                                <span className="text-xs text-muted/30">—</span>
                              )}
                            </div>

                            {/* Col. Statut (desktop) */}
                            <div className="hidden md:block">
                              <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap items-center gap-1 ${sv.badge}`}>
                                {status === "met" && <CheckCircle2 className="w-3 h-3" />}{statusLabel}
                              </span>
                            </div>

                            {/* Col. Suppression (2 temps, anti-clic accidentel) */}
                            <div className="flex justify-end">
                              {confirmDelete === g.id ? (
                                <button onClick={() => { removeGoal(g.id); setConfirmDelete(null); }}
                                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-loss bg-loss/10 rounded-full px-2.5 py-1 hover:bg-loss/20 transition-colors whitespace-nowrap"
                                  aria-label={t("goals_delete_confirm")}>
                                  <Trash2 className="w-3 h-3" strokeWidth={2} /> {t("goals_delete_confirm")}
                                </button>
                              ) : (
                                <button onClick={() => { setConfirmDelete(g.id); window.setTimeout(() => setConfirmDelete((c) => (c === g.id ? null : c)), 3500); }}
                                  className="shrink-0 text-muted/40 hover:text-loss transition-all sm:opacity-0 sm:group-hover:opacity-100" aria-label={t("goals_delete")}>
                                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                              )}
                            </div>

                            {/* Résumé mobile : échéance + progression + statut sur une ligne */}
                            <div className="md:hidden col-span-2 flex items-center gap-2.5 pl-8">
                              <span className="text-[11px] text-muted whitespace-nowrap shrink-0">{periodLabel(g.period)}</span>
                              {g.kind === "metric" ? (
                                <>
                                  <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                                    <GrowBar pct={Math.max(3, g.progress)} className={`rounded-full ${sv.bar}`} />
                                  </div>
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${sv.text}`}>{g.value}{unit(g.metric)}</span>
                                </>
                              ) : (
                                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${sv.badge}`}>{statusLabel}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══════════════════════ Onglet « Ma discipline » ═══════════════════════ */}
      {insightsLoaded && tab === "discipline" && (
        <div className="mt-5 space-y-5">
          {!showDiscipline ? (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-6">
              <Lock className="w-4 h-4 text-muted/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted">{t("goals_discipline_empty")}</p>
            </div>
          ) : (
            <>
              {/* Régularité (heatmap 12 semaines) */}
              {heatmap.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 shrink-0">
                      <CalendarDays className="w-4 h-4 text-accent" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{t("goals_heatmap_title")}</h2>
                      <p className="text-xs text-muted">{t("goals_heatmap_sub")}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <DisciplineHeatmap data={heatmap} t={t} />
                  </div>
                </section>
              )}

              {/* Edge — ce que la discipline te rapporte */}
              {insights?.hasTrades && (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 shrink-0">
                      <Scale className="w-4 h-4 text-accent" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">{t("goals_insight_title")}</h2>
                  </div>
                  {edge ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-profit/30 bg-profit/[0.04] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-4 h-4 text-profit" /> <span className="text-sm font-semibold text-foreground">{t("goals_edge_composed")}</span>
                          </div>
                          <div className="flex items-end gap-1.5">
                            <CountUp end={edge.composed.winRate} suffix="%" duration={1.1} className="text-3xl font-black tabular-nums text-profit leading-none" />
                            <span className="text-xs text-muted mb-0.5">{t("goals_edge_winrate")}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                            <GrowBar pct={edge.composed.winRate} className="rounded-full bg-profit" />
                          </div>
                          <p className="text-xs text-muted mt-2">
                            {t("goals_edge_trades").replace("{n}", String(edge.composed.count))} · {t("goals_edge_avg")} <span className={edge.composed.avgNet >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(edge.composed.avgNet)}</span>
                          </p>
                        </div>
                        <div className="rounded-xl border border-loss/30 bg-loss/[0.04] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-loss" /> <span className="text-sm font-semibold text-foreground">{t("goals_edge_impulsive")}</span>
                          </div>
                          <div className="flex items-end gap-1.5">
                            <CountUp end={edge.impulsive.winRate} suffix="%" duration={1.1} className="text-3xl font-black tabular-nums text-loss leading-none" />
                            <span className="text-xs text-muted mb-0.5">{t("goals_edge_winrate")}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                            <GrowBar pct={edge.impulsive.winRate} className="rounded-full bg-loss" />
                          </div>
                          <p className="text-xs text-muted mt-2">
                            {t("goals_edge_trades").replace("{n}", String(edge.impulsive.count))} · {t("goals_edge_avg")} <span className={edge.impulsive.avgNet >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(edge.impulsive.avgNet)}</span>
                          </p>
                        </div>
                      </div>
                      <div className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm ${winGap > 0 ? "border-profit/30 bg-profit/[0.04] text-foreground" : "border-border bg-surface/30 text-muted"}`}>
                        <Sparkles className={`w-4 h-4 shrink-0 ${winGap > 0 ? "text-profit" : "text-muted"}`} />
                        {winGap > 0 ? (
                          <span>
                            <span className="font-semibold text-profit">+{winGap} {t("goals_edge_points")}</span> {t("goals_edge_verdict")}
                            {avgGap > 0 && <> · <span className="font-semibold text-profit">{formatCurrency(avgGap)}</span> {t("goals_edge_verdict_avg")}</>}
                          </span>
                        ) : (
                          <span>{t("goals_edge_verdict_flat")}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
                      <Lock className="w-4 h-4 text-muted/60 shrink-0 mt-0.5" />
                      <p className="text-sm text-muted">{t("goals_edge_locked")}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Scorecard — tableau de bord auto-suivi du mois */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 shrink-0">
                    <Gauge className="w-4 h-4 text-accent" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t("goals_scorecard_title")}</h2>
                    <p className="text-xs text-muted">{t("goals_scorecard_sub")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {insights!.scorecard.map((s) => {
                    const u = unit(s.metric);
                    const hasDelta = s.value != null && s.prev != null;
                    const delta = hasDelta ? (s.value as number) - (s.prev as number) : 0;
                    const improved = s.betterWhen === "gte" ? delta > 0 : delta < 0;
                    const worse = s.betterWhen === "gte" ? delta < 0 : delta > 0;
                    return (
                      <div key={s.metric} className="rounded-xl border border-border bg-surface/30 p-3.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted leading-tight">{metricLabel(s.metric)}</p>
                        <div className="flex items-end justify-between gap-2 mt-1.5">
                          <span className="text-2xl font-black tabular-nums text-foreground leading-none">{s.value == null ? "—" : `${s.value}${u}`}</span>
                          {hasDelta && delta !== 0 && (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${improved ? "text-profit" : worse ? "text-loss" : "text-muted"}`}>
                              {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {Math.round(Math.abs(delta) * 10) / 10}{u}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mt-1.5">
                          {s.prev == null ? t("goals_no_prev") : `${t("goals_vs_last")} ${s.prev}${u}`}
                        </p>
                        {existing.has(`${s.metric}:month`) ? (
                          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-profit">
                            <CheckCircle2 className="w-3 h-3" /> {t("goals_scorecard_tracked")}
                          </span>
                        ) : (
                          <button onClick={() => addMetricGoal(s.metric, DEFAULT_TARGET[s.metric], "month")} disabled={busy}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/70 transition-colors disabled:opacity-50">
                            <Plus className="w-3 h-3" /> {t("goals_scorecard_track")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════ Modale « Créer un objectif » ═══════════════════════ */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              role="dialog" aria-modal="true" aria-label={t("goals_modal_title")}
              className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* En-tête */}
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card">
                <div>
                  <h2 className="text-base font-bold text-foreground">{t("goals_modal_title")}</h2>
                  <p className="text-xs text-muted mt-0.5">{t("goals_modal_sub")}</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors" aria-label={t("close")}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5">
                {/* Sélecteur de mode */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "write" as CreateMode, icon: PenLine, label: t("goals_mode_write"), sub: t("goals_mode_write_sub") },
                    { id: "metric" as CreateMode, icon: Gauge, label: t("goals_mode_metric"), sub: t("goals_mode_metric_sub") },
                    { id: "packs" as CreateMode, icon: Layers, label: t("goals_mode_packs"), sub: t("goals_mode_packs_sub") },
                  ]).map((m) => (
                    <button key={m.id} onClick={() => setCreateMode(m.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${createMode === m.id ? "border-accent bg-accent/[0.06]" : "border-border bg-surface/30 hover:border-accent/40"}`}>
                      <m.icon className={`w-4 h-4 mb-1.5 ${createMode === m.id ? "text-accent" : "text-muted"}`} />
                      <p className={`text-sm font-semibold leading-tight ${createMode === m.id ? "text-accent" : "text-foreground"}`}>{m.label}</p>
                      <p className="text-[11px] text-muted mt-0.5 leading-snug hidden sm:block">{m.sub}</p>
                    </button>
                  ))}
                </div>

                {/* ── Mode « Décris-le » ── */}
                {createMode === "write" && (
                  <div className="mt-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text" value={customText} onChange={(e) => setCustomText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addCustomGoal(); }}
                        placeholder={t("goals_custom_text_placeholder")} maxLength={120} autoFocus
                        className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <select value={customPeriod} onChange={(e) => setCustomPeriod(e.target.value as Period)}
                        className="px-3 py-2.5 bg-surface border border-border rounded-lg text-foreground text-sm">
                        {PERIODS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input type="checkbox" checked={customRecurring} onChange={(e) => setCustomRecurring(e.target.checked)} className="accent-accent w-4 h-4" />
                      <span className="text-xs text-muted">{t("goals_recurring_label")}</span>
                    </label>
                    <p className="text-xs text-muted/70 mt-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" /> {t("goals_ai_hint")}
                    </p>
                    <button onClick={addCustomGoal} disabled={busy || !customText.trim()}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50">
                      <Plus className="w-4 h-4" /> {t("goals_add")}
                    </button>
                  </div>
                )}

                {/* ── Mode « Métrique » ── */}
                {createMode === "metric" && (
                  <div className="mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {METRICS.map((m) => (
                        <button key={m} onClick={() => { setMetric(m); setTarget(String(DEFAULT_TARGET[m])); }}
                          className={`text-left rounded-xl border p-3 transition-colors ${metric === m ? "border-accent bg-accent/[0.06]" : "border-border bg-surface/30 hover:border-accent/40"}`}>
                          <p className={`text-sm font-semibold ${metric === m ? "text-accent" : "text-foreground"}`}>{metricLabel(m)}</p>
                          <p className="text-[11px] text-muted mt-0.5 leading-snug">{t(`goal_why_${m}`)}</p>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted shrink-0">{METRIC_COMPARATOR[metric] === "gte" ? "≥" : "≤"}</span>
                        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("goals_target")}
                          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-foreground text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-accent" />
                        <span className="text-xs text-muted shrink-0">{unit(metric)}</span>
                      </div>
                      <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}
                        className="px-3 py-2.5 bg-surface border border-border rounded-lg text-foreground text-sm">
                        {PERIODS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                      </select>
                    </div>
                    <button onClick={async () => { await addMetricGoal(metric, parseFloat(target), period); setShowCreate(false); }} disabled={busy}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50">
                      <Plus className="w-4 h-4" /> {t("goals_add")}
                    </button>
                  </div>
                )}

                {/* ── Mode « Packs » ── */}
                {createMode === "packs" && (
                  <div className="mt-4 space-y-2">
                    {PACKS.map((pack) => (
                      <div key={pack.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/30 p-3.5">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-sm font-semibold text-foreground">{t(`pack_${pack.id}_title`)}</p>
                          <p className="text-xs text-muted mt-0.5">{t(`pack_${pack.id}_desc`)}</p>
                          <p className="text-[11px] text-muted/70 mt-1.5">
                            {t("goals_pack_contains")} : {pack.metrics.map((m) => metricLabel(m.metric)).join(" · ")} · {t(pack.habits[0].titleKey)}
                          </p>
                        </div>
                        <button onClick={() => applyPack(pack)} disabled={busy}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 shrink-0">
                          <Plus className="w-3.5 h-3.5" /> {t("goals_pack_add")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
