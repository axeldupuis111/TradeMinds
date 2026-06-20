import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
type Period = "week" | "month" | "quarter";

interface GoalRow {
  id: string;
  kind?: string | null;       // 'metric' | 'custom' (défaut 'metric')
  title?: string | null;      // objectifs perso (texte libre)
  done?: boolean | null;      // check manuel des objectifs perso
  metric: Metric | null;
  target: number | null;
  comparator: "gte" | "lte" | null;
  period: Period;
}

function periodStart(period: Period): string {
  const now = new Date();
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

  // Données depuis le début du trimestre (couvre week/month/quarter).
  const since = periodStart("quarter");
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

  const result = goals.map((g) => {
    const kind = g.kind === "custom" ? "custom" : "metric";
    if (kind === "custom") {
      return { id: g.id, kind, title: g.title ?? "", period: g.period, done: !!g.done };
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
