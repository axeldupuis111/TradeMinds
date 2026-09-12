import { NextResponse } from "next/server";
import { bornesDePeriode } from "@/lib/periode-objectif";
import { addDaysToDateKey as decalerJours, localDateKey, normalizeTimezone } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { serieDepuisLesTrades } from "@/lib/discipline-streak-source";
import { fetchAllRows } from "@/lib/supabase-paginate";

export const dynamic = "force-dynamic";

// Émotions clairement impulsives vs clairement posées. Les autres (hésitant,
// anxieux, sans tag) restent dans un milieu neutre exclu du contraste pour que
// la comparaison "discipline vs impulsivité" reste nette et défendable.
const IMPULSIVE = new Set(["revenge", "fomo", "greedy", "cupide", "frustrated", "overconfident"]);
const COMPOSED = new Set(["calm", "confident", "neutral"]);

interface TradeRow { pnl: number; commission: number | null; swap: number | null; emotion: string | null; open_time: string | null }
interface ReviewRow { discipline_score: number | null; created_at: string }

function netPnl(t: TradeRow): number { return t.pnl + (t.commission || 0) + (t.swap || 0); }
/**
 * ⚠️ LE MOIS DU TRADER. Cette borne se posait sur l'horloge du serveur, donc
 * UTC : le « mois en cours » commençait le 31 à 14 h pour un trader à Sydney,
 * et les trades de cette soirée-là étaient comptés dans le mois précédent.
 * Même définition que partout ailleurs désormais (`lib/periode-objectif`).
 */
function monthStartISO(fuseau: string, offset = 0): string {
  return bornesDePeriode("month", -offset, fuseau).start.toISOString();
}

interface EdgeSide { count: number; winRate: number; avgNet: number }
function aggregate(trades: TradeRow[]): EdgeSide {
  const count = trades.length;
  if (count === 0) return { count: 0, winRate: 0, avgNet: 0 };
  const wins = trades.filter((t) => netPnl(t) > 0).length;
  const total = trades.reduce((s, t) => s + netPnl(t), 0);
  return { count, winRate: Math.round((wins / count) * 100), avgNet: total / count };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const fuseau = normalizeTimezone((profil?.timezone as string | null) ?? null);

  // ⚠️ LECTURE PAGINÉE : non bornée, elle rend exactement mille lignes avec un
  // statut 200 (voir lib/supabase-paginate.ts). Tout ce qui suit agrège sur
  // l'historique entier ; au-delà de mille trades, ces chiffres devenaient faux
  // en silence. L'ordre n'importe pas ici : tout est filtré ou sommé.
  const [tradesRows, reviewsRes, gelsRes] = await Promise.all([
    fetchAllRows<TradeRow>((from, to) =>
      supabase
        .from("trades")
        .select("pnl, commission, swap, emotion, open_time")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400),
    supabase.from("streak_freezes").select("day").eq("user_id", user.id),
  ]);
  if (tradesRows === null || reviewsRes.error) {
    console.error("[Goals insights] data query error:", reviewsRes.error ?? "lecture des trades incomplète");
    return NextResponse.json({ error: "Failed to load insights data" }, { status: 503 });
  }
  const { data: reviewsRaw } = reviewsRes;
  const trades = tradesRows;
  const reviews = ((reviewsRaw ?? []) as ReviewRow[]).filter((r) => r.discipline_score != null);

  // ── Série de discipline, celle du produit et pas une deuxième.
  //
  // ⚠️⚠️ LE COMMENTAIRE D'ORIGINE DISAIT « cohérente avec le dashboard », ET
  // ELLE NE L'ÉTAIT PAS : ce calcul ignorait les GELS DE SÉRIE. Un jour gelé y
  // cassait la série, donc les objectifs proposés par l'IA partaient d'un
  // chiffre que l'écran contredisait. Une phrase qui affirme ne remplace pas
  // un appel à la fonction dont elle parle.
  const geles = ((gelsRes.data as { day: string }[] | null) ?? []).map((g) => g.day);
  const streak = serieDepuisLesTrades(trades, geles);

  // ── Edge de discipline : trades posés vs impulsifs (win rate + résultat moyen).
  const composed = aggregate(trades.filter((t) => t.emotion != null && COMPOSED.has(t.emotion)));
  const impulsive = aggregate(trades.filter((t) => t.emotion != null && IMPULSIVE.has(t.emotion)));
  const edge = composed.count >= 3 && impulsive.count >= 2 ? { composed, impulsive } : null;

  // ── Tableau de bord du mois : métriques clés mois en cours vs mois précédent.
  const thisM = monthStartISO(fuseau, 0);
  const lastM = monthStartISO(fuseau, -1);
  function metricsFor(startISO: string, endISO: string | null) {
    const rv = reviews.filter((r) => r.created_at >= startISO && (endISO == null || r.created_at < endISO));
    const tr = trades.filter((t) => t.open_time != null && t.open_time >= startISO && (endISO == null || t.open_time < endISO));
    const discipline = rv.length ? Math.round(rv.reduce((s, r) => s + (r.discipline_score as number), 0) / rv.length) : null;
    const winRate = tr.length ? Math.round((tr.filter((t) => netPnl(t) > 0).length / tr.length) * 100) : null;
    const days = new Set(tr.map((t) => (t.open_time as string).slice(0, 10)));
    const perDay = days.size ? Math.round((tr.length / days.size) * 10) / 10 : null;
    let max = 0, run = 0;
    for (const t of tr) { if (netPnl(t) < 0) { run += 1; if (run > max) max = run; } else run = 0; }
    return { discipline, sessions: rv.length, winRate, perDay, maxLosses: tr.length ? max : null };
  }
  const cur = metricsFor(thisM, null);
  const prev = metricsFor(lastM, thisM);
  const scorecard = [
    { metric: "discipline_score", value: cur.discipline, prev: prev.discipline, betterWhen: "gte" },
    { metric: "sessions", value: cur.sessions || null, prev: prev.sessions || null, betterWhen: "gte" },
    { metric: "win_rate", value: cur.winRate, prev: prev.winRate, betterWhen: "gte" },
    { metric: "trades_per_day", value: cur.perDay, prev: prev.perDay, betterWhen: "lte" },
    { metric: "max_consecutive_losses", value: cur.maxLosses, prev: prev.maxLosses, betterWhen: "lte" },
  ];

  // ── Mini-tendance : scores de discipline des 14 dernières sessions (chrono).
  const trend = reviews
    .slice(0, 14)
    .map((r) => r.discipline_score as number)
    .reverse();

  // ── Heatmap : score de discipline moyen par jour sur ~12 semaines.
  const HEATMAP_DAYS = 84;
  // ⚠️ La fenêtre de la heatmap se compte en jours DU TRADER.
  const cutoffIso = decalerJours(localDateKey(fuseau), -(HEATMAP_DAYS - 1));
  const dayAgg = new Map<string, { sum: number; n: number }>();
  for (const r of reviews) {
    const d = r.created_at.slice(0, 10);
    if (d < cutoffIso) continue;
    const a = dayAgg.get(d) ?? { sum: 0, n: 0 };
    a.sum += r.discipline_score as number; a.n += 1; dayAgg.set(d, a);
  }
  const heatmap = Array.from(dayAgg.entries()).map(([date, a]) => ({ date, score: Math.round(a.sum / a.n) }));

  return NextResponse.json({
    streak,
    edge,
    scorecard,
    trend,
    heatmap,
    hasTrades: trades.length > 0,
    hasReviews: reviews.length > 0,
  });
}
