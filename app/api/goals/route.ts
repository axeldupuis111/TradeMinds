import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Metric = "discipline_score" | "sessions" | "win_rate" | "trades_per_day";

interface GoalRow {
  id: string;
  metric: Metric;
  target: number;
  comparator: "gte" | "lte";
  period: "month" | "week";
}

function periodStart(period: "month" | "week"): string {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const d = new Date(now);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

// Renvoie les objectifs de l'utilisateur avec leur valeur courante calculée sur la période.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: goals } = await supabase
    .from("goals")
    .select("id, metric, target, comparator, period")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!goals || goals.length === 0) {
    return NextResponse.json({ goals: [] });
  }

  // On récupère le début de période le plus ancien pour minimiser les requêtes.
  const needsMonth = goals.some((g) => g.period === "month");
  const since = periodStart(needsMonth ? "month" : "week");

  const [{ data: reviews }, { data: trades }] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", user.id).gte("created_at", since),
    supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", user.id).gte("open_time", since),
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
        const wins = tr.filter((t) => netPnl(t) > 0).length;
        return Math.round((wins / tr.length) * 100);
      }
      case "trades_per_day": {
        if (!tr.length) return 0;
        const days = new Set(tr.map((t) => t.open_time.slice(0, 10)));
        return Math.round((tr.length / days.size) * 10) / 10;
      }
      default:
        return 0;
    }
  }

  const result = goals.map((g) => {
    const value = currentValue(g as GoalRow);
    const met = g.comparator === "gte" ? value >= g.target : value <= g.target;
    const progress = g.comparator === "gte"
      ? Math.min(100, Math.round((value / g.target) * 100) || 0)
      : value <= g.target ? 100 : Math.max(0, Math.round((g.target / value) * 100));
    return { ...g, value, met, progress };
  });

  return NextResponse.json({ goals: result });
}
