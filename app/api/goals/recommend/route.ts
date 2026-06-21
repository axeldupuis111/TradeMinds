import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

interface Reco {
  metric: "discipline_score" | "sessions" | "win_rate" | "trades_per_day" | "max_consecutive_losses";
  comparator: "gte" | "lte";
  target: number;
  period: "month";
  reasonKey: string;
  reasonValue: number;
  severity: number; // tri : plus c'est haut, plus la faiblesse est marquée
}

// Recommandations d'objectifs basées sur l'analyse des 30 derniers jours du trader.
// Cible les faiblesses réelles (discipline faible, overtrading, séries de pertes, etc.).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "plus" && auth.plan !== "premium") {
    return NextResponse.json({ recommendations: [] });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: reviews }, { data: trades }] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", auth.userId).gte("created_at", since),
    supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", auth.userId).gte("open_time", since).order("open_time", { ascending: true }),
  ]);

  const rv = (reviews ?? []).filter((r) => r.discipline_score != null);
  const tr = trades ?? [];

  const recos: Reco[] = [];

  // Discipline moyenne faible.
  if (rv.length >= 2) {
    const avg = Math.round(rv.reduce((s, r) => s + (r.discipline_score as number), 0) / rv.length);
    if (avg < 80) {
      recos.push({ metric: "discipline_score", comparator: "gte", target: Math.min(90, avg + 10), period: "month", reasonKey: "rec_reason_discipline", reasonValue: avg, severity: 80 - avg });
    }
  }

  if (tr.length >= 5) {
    const days = new Set(tr.map((t) => t.open_time.slice(0, 10)));
    const tradingDays = days.size;

    // Overtrading.
    const perDay = Math.round((tr.length / tradingDays) * 10) / 10;
    if (perDay > 4) {
      recos.push({ metric: "trades_per_day", comparator: "lte", target: 3, period: "month", reasonKey: "rec_reason_overtrading", reasonValue: perDay, severity: (perDay - 4) * 10 });
    }

    // Séries de pertes.
    let maxRun = 0, run = 0;
    for (const t of tr) { if (netPnl(t) < 0) { run += 1; if (run > maxRun) maxRun = run; } else run = 0; }
    if (maxRun >= 3) {
      recos.push({ metric: "max_consecutive_losses", comparator: "lte", target: 2, period: "month", reasonKey: "rec_reason_streak", reasonValue: maxRun, severity: maxRun * 8 });
    }

    // Taux de réussite faible.
    const winRate = Math.round((tr.filter((t) => netPnl(t) > 0).length / tr.length) * 100);
    if (winRate < 45) {
      recos.push({ metric: "win_rate", comparator: "gte", target: 50, period: "month", reasonKey: "rec_reason_winrate", reasonValue: winRate, severity: 45 - winRate });
    }

    // Préparation insuffisante (peu de sessions par rapport aux jours tradés).
    if (rv.length < tradingDays) {
      const prep = Math.round((rv.length / tradingDays) * 100);
      recos.push({ metric: "sessions", comparator: "gte", target: tradingDays, period: "month", reasonKey: "rec_reason_prep", reasonValue: prep, severity: 100 - prep });
    }
  }

  // Les plus marquées d'abord, max 3.
  recos.sort((a, b) => b.severity - a.severity);
  return NextResponse.json({ recommendations: recos.slice(0, 3) });
}
