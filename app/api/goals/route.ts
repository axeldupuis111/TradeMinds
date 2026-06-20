import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Period = "day" | "week" | "month" | "quarter" | "year";

// Ancienneté (pour choisir la fenêtre de données à charger).
const PERIOD_RANK: Record<Period, number> = { day: 0, week: 1, month: 2, quarter: 3, year: 4 };

interface GoalRow {
  id: string;
  kind?: string | null;       // 'metric' | 'custom' (défaut 'metric')
  title?: string | null;      // objectifs perso (texte libre)
  done?: boolean | null;      // check manuel des objectifs perso
  recurring?: boolean | null; // objectif perso reconduit chaque période
  period_key?: string | null; // période en cours pour la reconduction
  streak?: number | null;     // séries de périodes réussies d'affilée
  best_streak?: number | null;
  metric: Metric | null;
  target: number | null;
  comparator: "gte" | "lte" | null;
  period: Period;
}

function periodKey(period: Period): string {
  return periodStart(period).slice(0, 10);
}

function periodStart(period: Period): string {
  const now = new Date();
  if (period === "day") {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const d = new Date(now);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "quarter") {
    const qMonth = now.getMonth() - (now.getMonth() % 3);
    return new Date(now.getFullYear(), qMonth, 1).toISOString();
  }
  if (period === "year") {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // select("*") : tolère l'absence des nouvelles colonnes (kind/title/done) tant que
  // la migration n'est pas appliquée → merge sûr.
  const { data: rawGoals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const goals = (rawGoals ?? []) as GoalRow[];
  if (goals.length === 0) return NextResponse.json({ goals: [] });

  // On charge les données depuis le début de la période la plus large utilisée.
  const broadest = goals.reduce<Period>((acc, g) => (PERIOD_RANK[g.period] > PERIOD_RANK[acc] ? g.period : acc), "day");
  const since = periodStart(broadest);
  const [{ data: reviews }, { data: trades }] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", user.id).gte("created_at", since),
    supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", user.id).gte("open_time", since).order("open_time", { ascending: true }),
  ]);

  function currentValue(g: GoalRow): number {
    const start = periodStart(g.period);
    const rv = (reviews ?? []).filter((r) => r.created_at >= start && r.discipline_score != null);
    const tr = (trades ?? []).filter((t) => t.open_time >= start);
    switch (g.metric) {
      case "discipline_score":
        return rv.length ? Math.round(rv.reduce((s, r) => s + (r.discipline_score as number), 0) / rv.length) : 0;
      case "sessions":
        return rv.length;
      case "win_rate": {
        if (!tr.length) return 0;
        return Math.round((tr.filter((t) => netPnl(t) > 0).length / tr.length) * 100);
      }
      case "trades_per_day": {
        if (!tr.length) return 0;
        const days = new Set(tr.map((t) => t.open_time.slice(0, 10)));
        return Math.round((tr.length / days.size) * 10) / 10;
      }
      case "max_consecutive_losses": {
        let max = 0, run = 0;
        for (const t of tr) { if (netPnl(t) < 0) { run += 1; if (run > max) max = run; } else run = 0; }
        return max;
      }
      default:
        return 0;
    }
  }

  // Reconduction des objectifs perso récurrents : si la période a changé, on
  // valide la série (streak) selon l'atteinte de la période précédente, puis on
  // remet à zéro pour la nouvelle période. Best-effort (ignore si colonnes absentes).
  for (const g of goals) {
    if (g.kind !== "custom" || !g.recurring) continue;
    const curKey = periodKey(g.period);
    if (g.period_key !== curKey) {
      const wasDone = !!g.done;
      const newStreak = wasDone ? (g.streak ?? 0) + 1 : 0;
      const newBest = Math.max(g.best_streak ?? 0, newStreak);
      const { error } = await supabase
        .from("goals")
        .update({ done: false, period_key: curKey, streak: newStreak, best_streak: newBest })
        .eq("id", g.id);
      if (!error) {
        g.done = false; g.period_key = curKey; g.streak = newStreak; g.best_streak = newBest;
      }
    }
  }

  const result = goals.map((g) => {
    const kind = g.kind === "custom" ? "custom" : "metric";
    if (kind === "custom") {
      return {
        id: g.id, kind, title: g.title ?? "", period: g.period, done: !!g.done,
        recurring: !!g.recurring, streak: g.streak ?? 0, bestStreak: g.best_streak ?? 0,
      };
    }
    const value = currentValue(g);
    const target = g.target ?? 0;
    const comparator = g.comparator ?? "gte";
    const met = comparator === "gte" ? value >= target : value <= target;
    const progress = comparator === "gte"
      ? Math.min(100, Math.round((value / (target || 1)) * 100) || 0)
      : value <= target ? 100 : Math.max(0, Math.round((target / (value || 1)) * 100));
    return { id: g.id, kind, metric: g.metric, target, comparator, period: g.period, value, met, progress };
  });

  return NextResponse.json({ goals: result });
}
