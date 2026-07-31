/**
 * Calcul serveur des stats de discipline d'un trader sur une période, partagé
 * par les défis hebdo publics (/api/community-challenges) et les défis privés
 * des communautés partenaires (/api/community).
 *
 * Les jours sont bucketés dans le fuseau du trader : deux participants d'une
 * même communauté peuvent vivre le même « mardi » à des instants différents.
 * La logique de score, elle, reste dans lib/community-challenges (pure et
 * testée) — ici on ne fait que passer des lignes SQL au bon format.
 */

import { computeWeekStats, IMPULSIVE_EMOTIONS, type WeekStats } from "@/lib/community-challenges";
import { localDateKey, localHour } from "@/lib/timezone";

export interface TradeRow {
  user_id: string;
  emotion: string | null;
  open_time: string | null;
}

export interface ReviewRow {
  user_id: string;
  discipline_score: number | null;
  created_at: string;
}

/**
 * Stats d'un trader sur `days`, avec `prevDays` comme période de référence
 * (base du défi « en progression »). Les deux listes sont des clés de jour
 * locales "YYYY-MM-DD".
 */
export function statsForPeriod(
  tz: string,
  days: string[],
  prevDays: string[],
  trades: TradeRow[],
  reviews: ReviewRow[],
): WeekStats {
  const tradeByDay = new Map<string, { impulsive: boolean; trades: number }>();
  for (const t of trades) {
    if (!t.open_time) continue;
    const day = localDateKey(tz, new Date(t.open_time));
    const cur = tradeByDay.get(day) ?? { impulsive: false, trades: 0 };
    tradeByDay.set(day, {
      impulsive: cur.impulsive || (!!t.emotion && IMPULSIVE_EMOTIONS.has(t.emotion)),
      trades: cur.trades + 1,
    });
  }

  const sessions: { day: string; hour: number; score: number }[] = [];
  const prevScores: number[] = [];
  const prevSet = new Set(prevDays);
  for (const r of reviews) {
    if (r.discipline_score == null) continue;
    const at = new Date(r.created_at);
    const day = localDateKey(tz, at);
    if (prevSet.has(day)) prevScores.push(r.discipline_score);
    sessions.push({ day, hour: localHour(tz, at), score: r.discipline_score });
  }

  const tradeDays = Array.from(tradeByDay.entries()).map(([day, v]) => ({ day, ...v }));
  return computeWeekStats(days, { tradeDays, sessions, prevScores });
}

/** Regroupe des lignes par utilisateur (une seule requête `in(...)` en amont). */
export function groupByUser<T extends { user_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const arr = map.get(row.user_id);
    if (arr) arr.push(row);
    else map.set(row.user_id, [row]);
  }
  return map;
}
