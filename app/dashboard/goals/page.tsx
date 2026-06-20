"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Plus, Target, ChevronDown, CheckCircle2, PenLine, Layers, Flame, Repeat } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Comparator = "gte" | "lte";
type Period = "week" | "month" | "quarter";

interface MetricGoal {
  id: string; kind: "metric"; metric: Metric; target: number; comparator: Comparator;
  period: Period; value: number; met: boolean; progress: number;
}
interface CustomGoal { id: string; kind: "custom"; title: string; period: Period; done: boolean; recurring: boolean; streak: number; bestStreak: number }
type Goal = MetricGoal | CustomGoal;

function periodKeyClient(p: Period): string {
  const now = new Date();
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
const PERIODS: Period[] = ["week", "month", "quarter"];

const PRESETS: { metric: Metric; target: number; period: Period }[] = [
  { metric: "discipline_score", target: 80, period: "month" },
  { metric: "sessions", target: 12, period: "month" },
  { metric: "trades_per_day", target: 3, period: "month" },
  { metric: "max_consecutive_losses", target: 3, period: "month" },
  { metric: "win_rate", target: 50, period: "month" },
];

function unit(m: Metric) { return m === "win_rate" ? "%" : m === "discipline_score" ? "/100" : ""; }

export default function GoalsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  // Objectif perso (texte)
  const [customText, setCustomText] = useState("");
  const [customPeriod, setCustomPeriod] = useState<Period>("week");
  const [customRecurring, setCustomRecurring] = useState(true);

  // Objectif mesuré custom
  const [metric, setMetric] = useState<Metric>("discipline_score");
  const [target, setTarget] = useState("85");
  const [period, setPeriod] = useState<Period>("month");

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

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
    await createCustom(title, customPeriod, customRecurring);
    setCustomText("");
    await load();
    setBusy(false);
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
  const suggestions = PRESETS.filter((p) => !existing.has(`${p.metric}:${p.period}`));

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("goals_page_title")}</h1>
      <p className="text-muted mt-1">{t("goals_intro")}</p>

      {/* Résumé */}
      {goals.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--surface))" strokeWidth="4" />
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--profit))" strokeWidth="4"
                strokeDasharray={`${(achieved / goals.length) * 100} 100`} strokeLinecap="round" pathLength={100} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{achieved}/{goals.length}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("goals_summary_title")}</p>
            <p className="text-xs text-muted">{t("goals_summary_sub").replace("{met}", String(achieved)).replace("{total}", String(goals.length))}</p>
          </div>
        </div>
      )}

      {/* Écrire son propre objectif */}
      <div className="mt-5 rounded-xl border border-accent/20 bg-accent/[0.03] p-4">
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
      </div>

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

      {/* Objectifs suggérés (mesurés) */}
      {!loading && suggestions.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> {t("goals_suggested_title")}
          </h2>
          <div className="space-y-2">
            {suggestions.map((p) => (
              <div key={`${p.metric}:${p.period}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {metricLabel(p.metric)}{" "}
                    <span className="text-muted font-normal">{METRIC_COMPARATOR[p.metric] === "gte" ? "≥" : "≤"} {p.target}{unit(p.metric)} · {periodLabel(p.period)}</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">{t(`goal_why_${p.metric}`)}</p>
                </div>
                <button onClick={() => addMetricGoal(p.metric, p.target, p.period)} disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> {t("goals_add_quick")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Objectifs perso (à cocher) */}
      {customGoals.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-foreground mt-6 mb-2">{t("goals_personal_title")}</h2>
          <div className="space-y-2">
            {customGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <button onClick={() => toggleDone(g.id, !g.done)} className="shrink-0" aria-label={t("goals_toggle_done")}>
                  {g.done
                    ? <CheckCircle2 className="w-5 h-5 text-profit" />
                    : <span className="block w-5 h-5 rounded-full border-2 border-border" />}
                </button>
                <span className={`flex-1 text-sm ${g.done ? "text-muted line-through" : "text-foreground"}`}>{g.title}</span>
                {g.recurring && g.streak > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-orange-400 whitespace-nowrap" title={t("goals_best_streak").replace("{n}", String(g.bestStreak))}>
                    <Flame className="w-3.5 h-3.5" /> {g.streak}
                  </span>
                )}
                {g.recurring && (
                  <Repeat className="w-3.5 h-3.5 text-muted/60 shrink-0" aria-label={t("goals_recurring_badge")} />
                )}
                <span className="text-[11px] text-muted whitespace-nowrap">{periodLabel(g.period)}</span>
                <button onClick={() => removeGoal(g.id)} className="text-muted hover:text-loss transition-colors shrink-0" aria-label={t("goals_delete")}>
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Objectifs mesurés actifs */}
      <h2 className="text-sm font-semibold text-foreground mt-6 mb-2">{t("goals_active_title")}</h2>
      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : metricGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Target className="w-6 h-6 text-muted/50 mx-auto mb-2" />
          <p className="text-muted text-sm">{t("goals_empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {metricGoals.map((g) => {
            const failing = !g.met && g.comparator === "lte" && g.value > g.target;
            const barColor = g.met ? "bg-profit" : failing ? "bg-loss" : "bg-accent";
            const status = g.met ? "met" : failing ? "failed" : "progress";
            const statusStyle = status === "met" ? "bg-profit/10 text-profit" : status === "failed" ? "bg-loss/10 text-loss" : "bg-surface text-muted";
            const gap = g.comparator === "gte" ? Math.max(0, Math.round((g.target - g.value) * 10) / 10) : Math.max(0, Math.round((g.value - g.target) * 10) / 10);
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {metricLabel(g.metric)}
                      <span className="text-muted font-normal"> · {g.comparator === "gte" ? "≥" : "≤"} {g.target}{unit(g.metric)} · {periodLabel(g.period)}</span>
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${statusStyle}`}>
                    {status === "met" && <CheckCircle2 className="w-3 h-3" />}{t(`goals_status_${status}`)}
                  </span>
                  <button onClick={() => removeGoal(g.id)} className="text-muted hover:text-loss transition-colors shrink-0" aria-label={t("goals_delete")}>
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${g.met ? "text-profit" : failing ? "text-loss" : "text-foreground"}`}>{g.value}{unit(g.metric)}</span>
                </div>
                {!g.met && gap > 0 && (
                  <p className="text-xs text-muted mt-1.5">
                    {g.comparator === "gte" ? t("goals_gap_below").replace("{gap}", `${gap}${unit(g.metric)}`) : t("goals_gap_above").replace("{gap}", `${gap}${unit(g.metric)}`)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
