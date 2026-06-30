import { localDateKey, addDaysToDateKey } from "@/lib/timezone";

/** A session review row, as needed to evaluate the discipline streak. */
export interface ReviewRow {
  user_id: string;
  created_at: string;
  discipline_score: number | null;
}

/** Score at/above which a day counts toward the streak (same bar as the leaderboard). */
export const QUALIFY_SCORE = 70;

/**
 * Trailing discipline streak: consecutive local days whose average discipline
 * score is >= QUALIFY_SCORE, counted backwards from YESTERDAY. Also reports
 * whether the trader already logged a session TODAY (in which case there's
 * nothing to nudge). `now` is injectable for deterministic tests.
 */
export function streakAtRisk(
  reviews: ReviewRow[],
  tz: string,
  now: Date = new Date(),
): { streak: number; loggedToday: boolean } {
  const byDay = new Map<string, { sum: number; n: number }>();
  let loggedToday = false;
  const todayKey = localDateKey(tz, now);

  for (const r of reviews) {
    const d = localDateKey(tz, new Date(r.created_at));
    if (d === todayKey) loggedToday = true;
    if (r.discipline_score == null) continue;
    const a = byDay.get(d) ?? { sum: 0, n: 0 };
    a.sum += r.discipline_score;
    a.n += 1;
    byDay.set(d, a);
  }

  const qualifies = (d: string) => {
    const a = byDay.get(d);
    return !!a && a.sum / a.n >= QUALIFY_SCORE;
  };

  let streak = 0;
  let day = addDaysToDateKey(todayKey, -1);
  while (qualifies(day)) {
    streak += 1;
    day = addDaysToDateKey(day, -1);
  }
  return { streak, loggedToday };
}
