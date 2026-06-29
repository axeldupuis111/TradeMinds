"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Plus, Target, ChevronDown, CheckCircle2, PenLine, Layers, Flame, Repeat, Sparkles, Clock, CalendarDays, Flag, Crown, Scale, ShieldCheck, Zap, Gauge, TrendingUp, TrendingDown, Minus, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Comparator = "gte" | "lte";
type Period = "day" | "week" | "month" | "quarter" | "year";
type Horizon = "short" | "mid" | "long";

interface MetricGoal {
  id: string; kind: "metric"; metric: Metric; target: number; comparator: Comparator;
  period: Period; value: number; met: boolean; progress: number;
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

export default function GoalsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);

  // Objectif perso (texte)
  const [customText, setCustomText] = useState("");
  const [customPeriod, setCustomPeriod] = useState<Period>("week");
  const [customRecurring, setCustomRecurring] = useState(true);
  const [interpretMsg, setInterpretMsg] = useState<"auto" | "manual" | null>(null);

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

  useEffect(() => {
    fetch("/api/goals/recommend")
      .then((r) => r.json())
      .then((d) => setRecos(d.recommendations ?? []))
      .catch(() => setRecos([]));
    fetch("/api/goals/insights")
      .then((r) => r.json())
      .then((d) => setInsights(d?.scorecard ? d : null))
      .catch(() => setInsights(null));
  }, []);

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
    setInterpretMsg(null);
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
        setInterpretMsg("auto");
      } else {
        // 2b. Non mesurable → objectif à cocher manuellement.
        await createCustom(title, customPeriod, customRecurring);
        await load();
        setInterpretMsg("manual");
      }
      setCustomText("");
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
  }

  async function toggleDone(id: string, done: boolean) {
    setGoals((gs) => gs.map((g) => (g.id === id && g.kind === "custom" ? { ...g, done } : g)));
    await supabase.from("goals").update({ done }).eq("id", id);
  }

  async function removeGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((g) => g.filter((x) => x.id !== id));
  }

  function metricLabel(m: Metric) { return t(`goal_metric_${m}`); }
  function periodLabel(p: Period) { return t(`goals_period_${p}`); }

  const metricGoals = goals.filter((g): g is MetricGoal => g.kind === "metric");
  const customGoals = goals.filter((g): g is CustomGoal => g.kind === "custom");
  const achieved = metricGoals.filter((g) => g.met).length + customGoals.filter((g) => g.done).length;

  const existing = new Set(metricGoals.map((g) => `${g.metric}:${g.period}`));
  // Recommandations non encore ajoutées (par métrique + période).
  const recoToShow = recos.filter((r) => !existing.has(`${r.metric}:${r.period}`));

  // Objectifs groupés par horizon temporel, triés par priorité (à surveiller d'abord).
  const byHorizon: Record<Horizon, Goal[]> = { short: [], mid: [], long: [] };
  for (const g of goals) byHorizon[HORIZON_OF[g.period]].push(g);
  for (const h of HORIZONS) byHorizon[h].sort((a, b) => goalStatus(a).priority - goalStatus(b).priority);

  // ── Dérivés des insights de discipline ───────────────────────────────────
  const streak = insights?.streak;
  // Prochain palier de série (3 → 10 → 30).
  const nextMilestone = !streak ? null : streak.current < 3 ? 3 : streak.current < 10 ? 10 : streak.current < 30 ? 30 : null;
  const prevMilestone = !streak ? 0 : streak.current < 3 ? 0 : streak.current < 10 ? 3 : streak.current < 30 ? 10 : 30;
  const milestonePct = nextMilestone && streak ? Math.min(100, ((streak.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100) : 100;
  // Trajectoire de discipline : score moyen du mois vs mois précédent.
  const discCell = insights?.scorecard.find((s) => s.metric === "discipline_score");
  const traj = discCell && discCell.value != null && discCell.prev != null
    ? { dir: discCell.value - discCell.prev >= 3 ? "up" : discCell.value - discCell.prev <= -3 ? "down" : "flat", delta: discCell.value - discCell.prev }
    : null;
  // Edge : écart de réussite posé vs impulsif.
  const edge = insights?.edge;
  const winGap = edge ? edge.composed.winRate - edge.impulsive.winRate : 0;
  const avgGap = edge ? edge.composed.avgNet - edge.impulsive.avgNet : 0;

  const showDiscipline = insights && (insights.hasTrades || insights.hasReviews);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("goals_page_title")}</h1>
      <p className="text-muted mt-1">{t("goals_intro")}</p>

      {/* ═══ Centre de discipline : preuve & suivi automatique ═══ */}

      {/* Hero — série de discipline + trajectoire */}
      {insights?.hasTrades && streak && (
        <KpiCardPremium layout="full" accentColor="amber" intensity="hero" className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-3">
              <Flame className={`w-9 h-9 shrink-0 ${streak.current > 0 ? "text-warning" : "text-muted/50"}`} strokeWidth={1.75} />
              <div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-3xl font-black tabular-nums text-foreground leading-none">{streak.current}</span>
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
            <div className="flex items-center gap-4">
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
                <div className="text-right border-l border-border pl-4">
                  <p className="text-xl font-black tabular-nums text-foreground leading-none">{streak.record}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted mt-1">{t("goals_record")}</p>
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
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-warning transition-all duration-700" style={{ width: `${Math.max(3, milestonePct)}%` }} />
              </div>
            </div>
          )}
        </KpiCardPremium>
      )}

      {/* Edge — ce que la discipline te rapporte */}
      {insights?.hasTrades && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Scale className="w-4 h-4 text-accent" /> {t("goals_insight_title")}
          </h2>
          {edge ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-profit/30 bg-profit/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-profit" /> <span className="text-sm font-semibold text-foreground">{t("goals_edge_composed")}</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-black tabular-nums text-profit leading-none">{edge.composed.winRate}%</span>
                    <span className="text-xs text-muted mb-0.5">{t("goals_edge_winrate")}</span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">
                    {t("goals_edge_trades").replace("{n}", String(edge.composed.count))} · {t("goals_edge_avg")} <span className={edge.composed.avgNet >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(edge.composed.avgNet)}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-loss/30 bg-loss/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-loss" /> <span className="text-sm font-semibold text-foreground">{t("goals_edge_impulsive")}</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-black tabular-nums text-loss leading-none">{edge.impulsive.winRate}%</span>
                    <span className="text-xs text-muted mb-0.5">{t("goals_edge_winrate")}</span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">
                    {t("goals_edge_trades").replace("{n}", String(edge.impulsive.count))} · {t("goals_edge_avg")} <span className={edge.impulsive.avgNet >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(edge.impulsive.avgNet)}</span>
                  </p>
                </div>
              </div>
              <div className={`mt-2 flex items-center gap-2 rounded-xl border p-3 text-sm ${winGap > 0 ? "border-profit/30 bg-profit/[0.04] text-foreground" : "border-border bg-card text-muted"}`}>
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
      {showDiscipline && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent" /> {t("goals_scorecard_title")}
          </h2>
          <p className="text-xs text-muted mb-3">{t("goals_scorecard_sub")}</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {insights!.scorecard.map((s) => {
              const u = unit(s.metric);
              const hasDelta = s.value != null && s.prev != null;
              const delta = hasDelta ? (s.value as number) - (s.prev as number) : 0;
              const improved = s.betterWhen === "gte" ? delta > 0 : delta < 0;
              const worse = s.betterWhen === "gte" ? delta < 0 : delta > 0;
              return (
                <div key={s.metric} className="rounded-xl border border-border bg-card p-3.5">
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
      )}

      {/* ═══ Couche action : créer & découvrir des objectifs ═══ */}
      <div className="mt-8">
      {/* Écrire son propre objectif */}
      <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-accent" /> {t("goals_custom_text_title")}
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text" value={customText} onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCustomGoal(); }}
            placeholder={t("goals_custom_text_placeholder")} maxLength={120}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select value={customPeriod} onChange={(e) => setCustomPeriod(e.target.value as Period)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm">
            {PERIODS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <button onClick={addCustomGoal} disabled={busy || !customText.trim()}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> {t("goals_add")}
          </button>
        </div>
        <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
          <input type="checkbox" checked={customRecurring} onChange={(e) => setCustomRecurring(e.target.checked)} className="accent-accent w-4 h-4" />
          <span className="text-xs text-muted">{t("goals_recurring_label")}</span>
        </label>
        <p className="text-xs text-muted/70 mt-2">{t("goals_ai_hint")}</p>
        {interpretMsg && (
          <p className={`text-xs mt-1.5 ${interpretMsg === "auto" ? "text-profit" : "text-accent"}`}>
            {interpretMsg === "auto" ? t("goals_ai_auto") : t("goals_ai_manual")}
          </p>
        )}
      </div>

      {/* Recommandé pour toi (IA, basé sur tes faiblesses détectées) */}
      {recoToShow.length > 0 && (
        <div className="mt-5">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Packs d'objectifs */}
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" /> {t("goals_packs_title")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PACKS.map((pack) => (
            <button key={pack.id} onClick={() => applyPack(pack)} disabled={busy}
              className="text-left rounded-xl border border-border bg-card p-3 hover:border-accent/40 transition-colors disabled:opacity-50">
              <p className="text-sm font-semibold text-foreground">{t(`pack_${pack.id}_title`)}</p>
              <p className="text-xs text-muted mt-0.5">{t(`pack_${pack.id}_desc`)}</p>
              <span className="inline-flex items-center gap-1 text-xs text-accent font-medium mt-2">
                <Plus className="w-3 h-3" /> {t("goals_pack_add")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Objectif mesuré personnalisé (replié) */}
      <div className="mt-5">
        <button onClick={() => setShowCustom((s) => !s)} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${showCustom ? "rotate-180" : ""}`} />
          {t("goals_custom_title")}
        </button>
        {showCustom && (
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm sm:col-span-2">
                {METRICS.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
              </select>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("goals_target")} className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm" />
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm">
                {PERIODS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted mt-2">{t(`goal_why_${metric}`)}</p>
            <button onClick={() => addMetricGoal(metric, parseFloat(target), period)} disabled={busy}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" /> {t("goals_add")}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* ═══ Feuille de route : objectifs groupés par horizon ═══ */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> {t("goals_roadmap_title")}
          </h2>
          {goals.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-8 h-8">
                <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--surface))" strokeWidth="4" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--profit))" strokeWidth="4"
                    strokeDasharray={`${(achieved / goals.length) * 100} 100`} strokeLinecap="round" pathLength={100} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">{achieved}/{goals.length}</span>
              </div>
              <span className="text-xs text-muted hidden sm:inline">{t("goals_summary_sub").replace("{met}", String(achieved)).replace("{total}", String(goals.length))}</span>
            </div>
          )}
        </div>
        {loading ? (
          <div className="skeleton h-40 rounded-2xl" />
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-3">
              <Target className="w-6 h-6 text-muted/50" />
            </div>
            <p className="text-muted text-sm">{t("goals_empty")}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_0_rgb(255_255_255/0.02)_inset]">
            {HORIZONS.filter((h) => byHorizon[h].length > 0).map((h, gi) => {
              const rows = byHorizon[h];
              const HIcon = HORIZON_ICON[h];
              const hs = HORIZON_STYLE[h];
              return (
                <div key={h}>
                  {/* Bandeau d'horizon */}
                  <div className={`flex items-center gap-2.5 px-4 sm:px-5 py-3 bg-gradient-to-r ${hs.tint} to-transparent ${gi > 0 ? "border-t border-border" : ""}`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${hs.chip}`}>
                      <HIcon className={`w-4 h-4 ${hs.icon}`} />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{t(`goals_horizon_${h}`)}</span>
                    <span className="text-[11px] text-muted/70 hidden sm:inline">{t(`goals_horizon_${h}_sub`)}</span>
                    <span className="ml-auto text-[11px] font-semibold text-muted bg-surface rounded-full px-2 py-0.5">{rows.length}</span>
                  </div>
                  {/* Lignes */}
                  {rows.map((g) => {
                    const { status } = goalStatus(g);
                    const sv = statusVisual(status);
                    const statusLabel = g.kind === "custom"
                      ? (g.done ? t("goals_status_met") : t("goals_status_todo"))
                      : t(`goals_status_${status}`);
                    return (
                      <div key={g.id} className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-t border-border/50 hover:bg-surface/30 transition-colors">
                        {/* Contrôle de tête : toggle (perso) ou pastille de statut (mesuré) */}
                        {g.kind === "custom" ? (
                          <button onClick={() => toggleDone(g.id, !g.done)} className="shrink-0" aria-label={t("goals_toggle_done")}>
                            {g.done
                              ? <CheckCircle2 className="w-5 h-5 text-profit" />
                              : <span className="block w-5 h-5 rounded-full border-2 border-border group-hover:border-accent/60 transition-colors" />}
                          </button>
                        ) : (
                          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${sv.dot}`} aria-hidden />
                        )}

                        {/* Objectif */}
                        <div className="min-w-0 flex-1">
                          {g.kind === "metric" ? (
                            <>
                              <p className="font-medium text-foreground text-sm leading-tight truncate">{metricLabel(g.metric)}</p>
                              <p className="text-[11px] text-muted mt-0.5">{g.comparator === "gte" ? "≥" : "≤"} {g.target}{unit(g.metric)}</p>
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

                        {/* Échéance */}
                        <span className="hidden sm:inline text-[11px] text-muted whitespace-nowrap w-16 text-right shrink-0">{periodLabel(g.period)}</span>

                        {/* Progression (mesuré) */}
                        <div className="shrink-0 w-20 sm:w-36 flex items-center gap-2">
                          {g.kind === "metric" ? (
                            <>
                              <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${sv.bar}`} style={{ width: `${Math.max(3, g.progress)}%` }} />
                              </div>
                              <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${sv.text}`}>{g.value}{unit(g.metric)}</span>
                            </>
                          ) : (
                            <span className="w-full text-right text-xs text-muted/30">—</span>
                          )}
                        </div>

                        {/* Statut */}
                        <span className={`hidden md:inline-flex shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap items-center gap-1 ${sv.badge}`}>
                          {status === "met" && <CheckCircle2 className="w-3 h-3" />}{statusLabel}
                        </span>

                        {/* Suppression (révélée au survol sur desktop) */}
                        <button onClick={() => removeGoal(g.id)} className="shrink-0 text-muted/40 hover:text-loss transition-all sm:opacity-0 sm:group-hover:opacity-100" aria-label={t("goals_delete")}>
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
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
  );
}
