// Stats "tous temps" d'un utilisateur pour le mur de badges du classement.
// Pur (pas d'I/O) : l'API classement fournit les reviews brutes + le fuseau du
// profil, on en dérive les compteurs que les badges affichent en progression.

import { localDateKey, localHour, localWeekday, addDaysToDateKey } from "./timezone";

export interface ReviewLike {
  created_at: string;
  discipline_score: number | null;
}

export interface AllTimeStats {
  /** Sessions notées, toutes périodes confondues. */
  totalSessions: number;
  /** Jours (locaux) dont la moyenne de score est >= 85. */
  goldDays: number;
  /** Vrai si un jour >= 85 suit immédiatement (jour tradé suivant) un jour < 50. */
  comeback: boolean;
  /** Sessions démarrées avant 9 h locale. */
  earlyBird: number;
  /** Sessions le samedi/dimanche (local). */
  weekendSessions: number;
  /** Plus longue série de jours calendaires consécutifs à moyenne >= 70. */
  bestStreak: number;
}

export function computeAllTimeStats(reviews: ReviewLike[], tz: string | null | undefined): AllTimeStats {
  const scored = reviews.filter((r) => r.discipline_score != null);

  let earlyBird = 0;
  let weekendSessions = 0;
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const r of scored) {
    const at = new Date(r.created_at);
    if (localHour(tz, at) < 9) earlyBird++;
    const wd = localWeekday(tz, at);
    if (wd === 0 || wd === 6) weekendSessions++;
    const key = localDateKey(tz, at);
    const a = byDay.get(key) ?? { sum: 0, n: 0 };
    a.sum += r.discipline_score as number;
    a.n += 1;
    byDay.set(key, a);
  }

  const days = Array.from(byDay.entries())
    .map(([key, a]) => ({ key, avg: a.sum / a.n }))
    .sort((x, y) => x.key.localeCompare(y.key));

  let goldDays = 0;
  let comeback = false;
  let bestStreak = 0;
  let run = 0;
  let prevKey: string | null = null;
  let prevAvg: number | null = null;
  for (const { key, avg } of days) {
    if (avg >= 85) goldDays++;
    // Comeback : le jour tradé suivant un jour < 50 repasse à 85+ (peu importe
    // le nombre de jours calendaires entre les deux — on juge la réaction).
    if (prevAvg != null && prevAvg < 50 && avg >= 85) comeback = true;

    if (avg >= 70) {
      const consecutive = prevKey != null && addDaysToDateKey(prevKey, 1) === key;
      run = consecutive && run > 0 ? run + 1 : 1;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
    prevKey = key;
    prevAvg = avg;
  }

  return { totalSessions: scored.length, goldDays, comeback, earlyBird, weekendSessions, bestStreak };
}
