"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Plus, Target, ChevronDown, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Comparator = "gte" | "lte";
type Period = "month" | "week";

interface Goal {
  id: string;
  metric: Metric;
  target: number;
  comparator: Comparator;
  period: Period;
  value: number;
  met: boolean;
  progress: number;
}

const METRIC_COMPARATOR: Record<Metric, Comparator> = {
  discipline_score: "gte",
  sessions: "gte",
  win_rate: "gte",
  trades_per_day: "lte",
  max_consecutive_losses: "lte",
};

const METRICS: Metric[] = ["discipline_score", "sessions", "win_rate", "trades_per_day", "max_consecutive_losses"];

// Objectifs suggérés : cibles sensées + raison. Clé i18n pour le "pourquoi".
const PRESETS: { metric: Metric; target: number; period: Period }[] = [
  { metric: "discipline_score", target: 80, period: "month" },
  { metric: "sessions", target: 12, period: "month" },
  { metric: "trades_per_day", target: 3, period: "month" },
  { metric: "max_consecutive_losses", target: 3, period: "month" },
  { metric: "win_rate", target: 50, period: "month" },
];

function unit(m: Metric) {
  return m === "win_rate" ? "%" : m === "discipline_score" ? "/100" : "";
}

export default function GoalsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
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

  async function addGoal(m: Metric, tgt: number, p: Period) {
    if (isNaN(tgt) || tgt <= 0) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("goals").insert({
        user_id: user.id,
        metric: m,
        target: tgt,
        comparator: METRIC_COMPARATOR[m],
        period: p,
      });
      await load();
    }
    setBusy(false);
  }

  async function removeGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((g) => g.filter((x) => x.id !== id));
  }

  function metricLabel(m: Metric) { return t(`goal_metric_${m}`); }

  const metCount = goals.filter((g) => g.met).length;
  // Suggestions non encore ajoutées (par métrique + période).
  const existing = new Set(goals.map((g) => `${g.metric}:${g.period}`));
  const suggestions = PRESETS.filter((p) => !existing.has(`${p.metric}:${p.period}`));

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("goals_page_title")}</h1>
      <p className="text-muted mt-1">{t("goals_intro")}</p>

      {/* Résumé de progression */}
      {goals.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--surface))" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--profit))" strokeWidth="4"
                strokeDasharray={`${(metCount / goals.length) * 100} 100`} strokeLinecap="round"
                pathLength={100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
              {metCount}/{goals.length}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("goals_summary_title")}</p>
            <p className="text-xs text-muted">
              {t("goals_summary_sub").replace("{met}", String(metCount)).replace("{total}", String(goals.length))}
            </p>
          </div>
        </div>
      )}

      {/* Objectifs suggérés */}
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
                    <span className="text-muted font-normal">
                      {METRIC_COMPARATOR[p.metric] === "gte" ? "≥" : "≤"} {p.target}{unit(p.metric)} · {t(`goals_period_${p.period}`)}
                    </span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">{t(`goal_why_${p.metric}`)}</p>
                </div>
                <button
                  onClick={() => addGoal(p.metric, p.target, p.period)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {t("goals_add_quick")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objectif personnalisé (replié) */}
      <div className="mt-5">
        <button
          onClick={() => setShowCustom((s) => !s)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showCustom ? "rotate-180" : ""}`} />
          {t("goals_custom_title")}
        </button>
        {showCustom && (
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm sm:col-span-2">
                {METRICS.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
              </select>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("goals_target")}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm" />
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm">
                <option value="month">{t("goals_period_month")}</option>
                <option value="week">{t("goals_period_week")}</option>
              </select>
            </div>
            <p className="text-xs text-muted mt-2">{t(`goal_why_${metric}`)}</p>
            <button onClick={() => addGoal(metric, parseFloat(target), period)} disabled={busy}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" /> {t("goals_add")}
            </button>
          </div>
        )}
      </div>

      {/* Liste des objectifs actifs */}
      <h2 className="text-sm font-semibold text-foreground mt-6 mb-2">{t("goals_active_title")}</h2>
      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Target className="w-6 h-6 text-muted/50 mx-auto mb-2" />
          <p className="text-muted text-sm">{t("goals_empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const failing = !g.met && g.comparator === "lte" && g.value > g.target;
            const barColor = g.met ? "bg-profit" : failing ? "bg-loss" : "bg-accent";
            const status = g.met ? "met" : failing ? "failed" : "progress";
            const statusStyle =
              status === "met" ? "bg-profit/10 text-profit"
              : status === "failed" ? "bg-loss/10 text-loss"
              : "bg-surface text-muted";
            const gap = g.comparator === "gte"
              ? Math.max(0, Math.round((g.target - g.value) * 10) / 10)
              : Math.max(0, Math.round((g.value - g.target) * 10) / 10);
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {metricLabel(g.metric)}
                      <span className="text-muted font-normal">
                        {" "}· {g.comparator === "gte" ? "≥" : "≤"} {g.target}{unit(g.metric)} · {t(`goals_period_${g.period}`)}
                      </span>
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${statusStyle}`}>
                    {status === "met" && <CheckCircle2 className="w-3 h-3" />}
                    {t(`goals_status_${status}`)}
                  </span>
                  <button onClick={() => removeGoal(g.id)} className="text-muted hover:text-loss transition-colors shrink-0" aria-label={t("goals_delete")}>
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${g.met ? "text-profit" : failing ? "text-loss" : "text-foreground"}`}>
                    {g.value}{unit(g.metric)}
                  </span>
                </div>
                {!g.met && gap > 0 && (
                  <p className="text-xs text-muted mt-1.5">
                    {g.comparator === "gte"
                      ? t("goals_gap_below").replace("{gap}", `${gap}${unit(g.metric)}`)
                      : t("goals_gap_above").replace("{gap}", `${gap}${unit(g.metric)}`)}
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
