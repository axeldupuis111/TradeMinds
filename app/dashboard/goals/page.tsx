"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";

interface Goal {
  id: string;
  metric: Metric;
  target: number;
  comparator: "gte" | "lte";
  period: "month" | "week";
  value: number;
  met: boolean;
  progress: number;
}

// Métriques où "plus c'est haut, mieux c'est" = gte ; trades_per_day = lte (on plafonne).
const METRIC_COMPARATOR: Record<Metric, "gte" | "lte"> = {
  discipline_score: "gte",
  sessions: "gte",
  win_rate: "gte",
  trades_per_day: "lte",
  max_consecutive_losses: "lte",
};

const METRICS: Metric[] = ["discipline_score", "sessions", "win_rate", "trades_per_day", "max_consecutive_losses"];

export default function GoalsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<Metric>("discipline_score");
  const [target, setTarget] = useState("85");
  const [period, setPeriod] = useState<"month" | "week">("month");

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addGoal() {
    const num = parseFloat(target);
    if (isNaN(num) || num <= 0) return;
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("goals").insert({
        user_id: user.id,
        metric,
        target: num,
        comparator: METRIC_COMPARATOR[metric],
        period,
      });
      await load();
    }
    setAdding(false);
  }

  async function removeGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((g) => g.filter((x) => x.id !== id));
  }

  function metricLabel(m: Metric) { return t(`goal_metric_${m}`); }
  function unit(m: Metric) { return m === "win_rate" ? "%" : m === "discipline_score" ? "/100" : ""; }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">{t("goals_page_title")}</h1>
      <p className="text-muted mt-1">{t("goals_subtitle")}</p>

      {/* Formulaire d'ajout */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm sm:col-span-2"
          >
            {METRICS.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
          </select>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t("goals_target")}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm"
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "month" | "week")}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm"
          >
            <option value="month">{t("goals_period_month")}</option>
            <option value="week">{t("goals_period_week")}</option>
          </select>
        </div>
        <button
          onClick={addGoal}
          disabled={adding}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          {t("goals_add")}
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="skeleton h-32 rounded-xl mt-4" />
      ) : goals.length === 0 ? (
        <p className="text-muted text-sm mt-6 text-center">{t("goals_empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {goals.map((g) => {
            // Échec = objectif "ne pas dépasser" (lte) déjà dépassé.
            const failing = !g.met && g.comparator === "lte" && g.value > g.target;
            const barColor = g.met ? "bg-profit" : failing ? "bg-loss" : "bg-accent";
            const status = g.met ? "met" : failing ? "failed" : "progress";
            const statusStyle =
              status === "met" ? "bg-profit/10 text-profit"
              : status === "failed" ? "bg-loss/10 text-loss"
              : "bg-surface text-muted";
            // Écart restant.
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
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusStyle}`}>
                    {t(`goals_status_${status}`)}
                  </span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-muted hover:text-loss transition-colors shrink-0"
                    aria-label={t("goals_delete")}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${g.progress}%` }}
                    />
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
