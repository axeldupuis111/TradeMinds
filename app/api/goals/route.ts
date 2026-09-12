import { NextResponse } from "next/server";
import { bornesDePeriode, cleDePeriode, debutDePeriodeIso } from "@/lib/periode-objectif";
import { normalizeTimezone } from "@/lib/timezone";
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

/**
 * ⚠️⚠️ LA CLÉ ET LES BORNES VIENNENT DU MÊME ENDROIT QUE CÔTÉ CLIENT.
 * Il en existait TROIS versions (cette route, la page Objectifs, les outils du
 * coach), avec trois conventions : la reconduction comparait donc une clé écrite
 * par le navigateur à une clé recalculée ici, et ne les reconnaissait pas. Un
 * objectif récurrent créé depuis l'écran était reconduit aussitôt : coché remis
 * à zéro, série remise à zéro, sans que le trader ait rien manqué.
 *
 * ⚠️ Et une période appartient au calendrier du TRADER : évaluée sur l'horloge
 * de Vercel, la « journée » d'un objectif quotidien commençait à 10 h du matin
 * pour un trader à Sydney.
 */
function periodKey(period: Period, fuseau: string): string {
  return cleDePeriode(period, fuseau);
}

// Nombre de périodes d'historique évaluées rétroactivement (dont la courante).
const HISTORY_LEN: Record<Period, number> = { day: 7, week: 8, month: 6, quarter: 4, year: 3 };

function periodStart(period: Period, fuseau: string): string {
  return debutDePeriodeIso(period, fuseau);
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

  const { data: profil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const fuseau = normalizeTimezone((profil?.timezone as string | null) ?? null);

  // select("*") : tolère l'absence des nouvelles colonnes (kind/title/done) tant que
  // la migration n'est pas appliquée → merge sûr.
  const { data: rawGoals, error: goalsError } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (goalsError) {
    console.error("[Goals] goals query error:", goalsError);
    return NextResponse.json({ error: "Failed to load goals" }, { status: 503 });
  }

  const goals = (rawGoals ?? []) as GoalRow[];
  if (goals.length === 0) return NextResponse.json({ goals: [] });

  // On charge les données depuis le début de l'horizon d'historique le plus
  // ancien parmi les objectifs mesurés (permet d'évaluer les périodes passées
  // rétroactivement, sans table d'archive).
  const metricGoals = goals.filter((g) => g.kind !== "custom");
  const broadest = goals.reduce<Period>((acc, g) => (PERIOD_RANK[g.period] > PERIOD_RANK[acc] ? g.period : acc), "day");
  const since = metricGoals.length
    ? metricGoals
        .map((g) => bornesDePeriode(g.period, HISTORY_LEN[g.period] - 1, fuseau).start.toISOString())
        .reduce((a, b) => (a < b ? a : b))
    : periodStart(broadest, fuseau);
  const [reviewsRes, tradesRes] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", user.id).gte("created_at", since).limit(10000),
    supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", user.id).gte("open_time", since).order("open_time", { ascending: true }).limit(10000),
  ]);
  if (reviewsRes.error || tradesRes.error) {
    console.error("[Goals] data query error:", reviewsRes.error ?? tradesRes.error);
    return NextResponse.json({ error: "Failed to load goal data" }, { status: 503 });
  }
  const { data: reviews } = reviewsRes;
  const { data: trades } = tradesRes;

  /** Valeur de la métrique sur une plage [start, end). */
  function rangeValue(g: GoalRow, startIso: string, endIso: string): number {
    const rv = (reviews ?? []).filter((r) => r.created_at >= startIso && r.created_at < endIso && r.discipline_score != null);
    const tr = (trades ?? []).filter((t) => t.open_time >= startIso && t.open_time < endIso);
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

  function currentValue(g: GoalRow): number {
    const { start, end } = bornesDePeriode(g.period, 0, fuseau);
    return rangeValue(g, start.toISOString(), end.toISOString());
  }

  /** true si la valeur satisfait la cible de l'objectif. */
  function isMet(g: GoalRow, value: number): boolean {
    const target = g.target ?? 0;
    return (g.comparator ?? "gte") === "gte" ? value >= target : value <= target;
  }

  /**
   * Historique des HISTORY_LEN dernières périodes (la courante en dernier),
   * évalué rétroactivement. « hadData » distingue une période ratée d'une
   * période sans aucune activité (affichée neutre côté UI).
   */
  function historyFor(g: GoalRow): { key: string; value: number; met: boolean; current: boolean; hadData: boolean }[] {
    const len = HISTORY_LEN[g.period];
    const out: { key: string; value: number; met: boolean; current: boolean; hadData: boolean }[] = [];
    for (let offset = len - 1; offset >= 0; offset--) {
      const { start, end } = bornesDePeriode(g.period, offset, fuseau);
      const startIso = start.toISOString(), endIso = end.toISOString();
      const value = rangeValue(g, startIso, endIso);
      const hadData =
        (reviews ?? []).some((r) => r.created_at >= startIso && r.created_at < endIso) ||
        (trades ?? []).some((t) => t.open_time >= startIso && t.open_time < endIso);
      // Clé lisible = la date du trader, jamais celle du serveur.
      const key = cleDePeriode(g.period, fuseau, start);
      out.push({ key, value, met: isMet(g, value), current: offset === 0, hadData });
    }
    return out;
  }

  /**
   * Périodes consécutives réussies : en partant de la courante si elle est
   * déjà atteinte, sinon de la précédente (la période en cours n'interrompt
   * pas une série tant qu'elle n'est pas finie).
   */
  function periodStreakFor(history: { met: boolean; current: boolean; hadData: boolean }[]): number {
    let streak = 0;
    let i = history.length - 1;
    if (i >= 0 && history[i].current && !history[i].met) i -= 1;
    for (; i >= 0; i--) {
      if (history[i].met) streak += 1;
      else break;
    }
    return streak;
  }

  // Reconduction des objectifs perso récurrents : si la période a changé, on
  // valide la série (streak) selon l'atteinte de la période précédente, puis on
  // remet à zéro pour la nouvelle période. Best-effort (ignore si colonnes absentes).
  for (const g of goals) {
    if (g.kind !== "custom" || !g.recurring) continue;
    const curKey = periodKey(g.period, fuseau);
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
    const history = historyFor(g);
    return {
      id: g.id, kind, metric: g.metric, target, comparator, period: g.period, value, met, progress,
      history, periodStreak: periodStreakFor(history),
    };
  });

  return NextResponse.json({ goals: result });
}
