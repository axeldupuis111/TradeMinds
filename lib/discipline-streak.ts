/**
 * discipline-streak.ts
 * Pure streak maths for the discipline streak (consecutive distinct TRADING days
 * with no revenge/FOMO trade). No-trade days are simply absent from the input, so
 * weekends and breaks never reset the streak — markets are closed anyway.
 *
 * Computes both the CURRENT trailing streak and the all-time RECORD, so the user
 * has a personal best to chase.
 */

export interface DisciplineDay {
  /** ISO day "YYYY-MM-DD". */
  day: string;
  /** True if that day contained a revenge/FOMO (emotional) trade. */
  emotional: boolean;
}

export interface StreakResult {
  /** Consecutive clean trading days ending at the most recent trading day. */
  current: number;
  /** Longest run of consecutive clean trading days ever. */
  record: number;
  /** True when the current streak is (or ties) the all-time best. */
  isRecord: boolean;
}

export function computeDisciplineStreaks(days: DisciplineDay[]): StreakResult {
  if (days.length === 0) return { current: 0, record: 0, isRecord: false };

  // Chronological, de-duplicated by day (last write wins on emotional flag).
  const byDay = new Map<string, boolean>();
  for (const d of days) byDay.set(d.day, (byDay.get(d.day) ?? false) || d.emotional);
  const sorted = Array.from(byDay.keys()).sort();

  let record = 0;
  let run = 0;
  for (const day of sorted) {
    if (byDay.get(day)) {
      run = 0;
    } else {
      run++;
      if (run > record) record = run;
    }
  }

  // Current = trailing run (most recent backward until an emotional day).
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (byDay.get(sorted[i])) break;
    current++;
  }

  return { current, record, isRecord: current > 0 && current >= record };
}
