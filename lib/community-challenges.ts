/**
 * Community challenges — WEEKLY ROTATION.
 *
 * Challenge templates live in code (like blog posts): the pool below defines
 * every possible challenge, and `challengesForWeek` draws CHALLENGES_PER_WEEK
 * of them for a given ISO week with a seeded PRNG — deterministic, so every
 * client and the server agree on the draw without any DB or cron.
 *
 * A week runs Monday 00:00 UTC → next Monday 00:00 UTC (ISO-8601 week). Days
 * are bucketed in each participant's own timezone, and a day belongs to the
 * week when its local date key falls on Mon..Sun of that week.
 *
 * Completion vs ranking are SEPARATE on purpose (discipline metrics are capped,
 * so everyone reaching the target would tie):
 *  - completed  = binary target reached → finisher reward (+1 streak freeze);
 *  - rankScore  = continuous score with decimals (week's average discipline
 *    score as built-in tiebreaker) → podium; remaining ties share the rank.
 *
 * Participation rows are (user_id, challenge_key, week_key); finalized results
 * land in `challenge_awards`, written only by the service role (migration
 * 20260713).
 */

export type ChallengeMetric =
  | "clean_days"
  | "clean_run"
  | "sessions"
  | "gold_avg"
  | "gold_days"
  | "early_bird"
  | "journal_days"
  | "calm_days"
  | "weekend_days"
  | "score_climb";

export interface CommunityChallenge {
  key: string;
  metric: ChallengeMetric;
  /** Target value that counts as "completed" (finisher reward). */
  target: number;
  titleKey: string;
  descKey: string;
}

/** i18n keys follow the feed convention: challenge_c_<key with - → _>_title. */
function keys(key: string): { titleKey: string; descKey: string } {
  const snake = key.replace(/-/g, "_");
  return { titleKey: `challenge_c_${snake}_title`, descKey: `challenge_c_${snake}_desc` };
}

export const CHALLENGE_POOL: CommunityChallenge[] = [
  { key: "clean-days", metric: "clean_days", target: 4, ...keys("clean-days") },
  { key: "clean-run", metric: "clean_run", target: 4, ...keys("clean-run") },
  { key: "sessions-week", metric: "sessions", target: 5, ...keys("sessions-week") },
  { key: "gold-avg", metric: "gold_avg", target: 85, ...keys("gold-avg") },
  { key: "gold-days", metric: "gold_days", target: 3, ...keys("gold-days") },
  { key: "early-bird", metric: "early_bird", target: 3, ...keys("early-bird") },
  { key: "journal-days", metric: "journal_days", target: 4, ...keys("journal-days") },
  { key: "calm-volume", metric: "calm_days", target: 4, ...keys("calm-volume") },
  { key: "weekend-prep", metric: "weekend_days", target: 2, ...keys("weekend-prep") },
  { key: "score-climb", metric: "score_climb", target: 3, ...keys("score-climb") },
];

export const CHALLENGES_PER_WEEK = 3;

/** gold_avg / score_climb need a real sample, not one lucky session. */
export const MIN_SESSIONS_FOR_AVG = 3;

/** Podium (ranks → emblem/certificate) only with a real contest. */
export const MIN_PODIUM_PARTICIPANTS = 3;

export function getCommunityChallenge(key: string): CommunityChallenge | undefined {
  return CHALLENGE_POOL.find((c) => c.key === key);
}

/** Emotions that count as impulsive (break a "clean" day). Kept in sync with goals/insights. */
export const IMPULSIVE_EMOTIONS = new Set([
  "revenge",
  "fomo",
  "greedy",
  "cupide",
  "frustrated",
  "overconfident",
]);

// ── ISO week helpers (UTC) ────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** ISO-8601 week key, e.g. "2026-W28" (UTC-based). */
export function isoWeekKey(at: Date = new Date()): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // ISO week is the week of its Thursday
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the given ISO week. */
export function weekStartUtc(weekKey: string): Date {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return new Date(NaN);
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Jan 4 is always in ISO week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const mondayW1 = jan4.getTime() - (day - 1) * DAY_MS;
  return new Date(mondayW1 + (week - 1) * 7 * DAY_MS);
}

/** Next Monday 00:00 UTC — exclusive end of the week (countdown target). */
export function weekEndUtc(weekKey: string): Date {
  return new Date(weekStartUtc(weekKey).getTime() + 7 * DAY_MS);
}

export function previousWeekKey(weekKey: string): string {
  return isoWeekKey(new Date(weekStartUtc(weekKey).getTime() - DAY_MS));
}

/** The 7 local-date keys ("YYYY-MM-DD", Mon..Sun) belonging to the week. */
export function weekDayKeys(weekKey: string): string[] {
  const start = weekStartUtc(weekKey);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10));
}

// ── Weekly draw (seeded, deterministic) ───────────────────────────────────────

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The challenges live for a given week — same result for every caller. */
export function challengesForWeek(weekKey: string): CommunityChallenge[] {
  const rand = mulberry32(hashSeed(weekKey));
  const pool = [...CHALLENGE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, CHALLENGES_PER_WEEK);
}

// ── Week stats & scoring (pure — inputs are already bucketed per local day) ──

export interface WeekTradeDay {
  /** Local date key "YYYY-MM-DD" (must belong to the week). */
  day: string;
  /** True if the day contained at least one impulsive trade. */
  impulsive: boolean;
  /** Number of closed trades that day. */
  trades: number;
}

export interface WeekSession {
  /** Local date key of the scored session. */
  day: string;
  /** Local hour 0-23 the session was reviewed. */
  hour: number;
  /** Discipline score 0-100. */
  score: number;
}

export interface WeekInputs {
  tradeDays: WeekTradeDay[];
  sessions: WeekSession[];
  /** Discipline scores of the PREVIOUS week (score_climb baseline). */
  prevScores: number[];
}

export interface WeekStats {
  tradedDays: number;
  cleanDays: number;
  /** Longest run of consecutive traded days without an impulsive trade. */
  maxCleanRun: number;
  /** Traded days with a controlled volume (≤ 5 trades). */
  calmDays: number;
  sessions: number;
  /** Mean discipline score of the week, WITH decimals (0 if no session). */
  avgScore: number;
  /** Days whose average session score is ≥ 85. */
  goldDays: number;
  /** Sessions reviewed before 9:00 local. */
  earlyBird: number;
  /** Distinct Sat/Sun days with a scored session. */
  weekendDays: number;
  /** Distinct days with a scored session. */
  journalDays: number;
  /** avgScore delta vs previous week (0 unless both weeks have ≥ 3 sessions). */
  scoreClimb: number;
}

const CALM_MAX_TRADES = 5;
const GOLD_DAY_SCORE = 85;
const EARLY_HOUR = 9;

function isWeekend(dayKey: string): boolean {
  const wd = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
}

export function computeWeekStats(weekDays: string[], inputs: WeekInputs): WeekStats {
  const inWeek = new Set(weekDays);

  // Trade days: dedupe + keep week-scoped, chronological.
  const byDay = new Map<string, { impulsive: boolean; trades: number }>();
  for (const t of inputs.tradeDays) {
    if (!inWeek.has(t.day)) continue;
    const cur = byDay.get(t.day) ?? { impulsive: false, trades: 0 };
    byDay.set(t.day, { impulsive: cur.impulsive || t.impulsive, trades: cur.trades + t.trades });
  }
  const days = Array.from(byDay.entries())
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const tradedDays = days.length;
  const cleanDays = days.filter((d) => !d.impulsive).length;
  const calmDays = days.filter((d) => d.trades <= CALM_MAX_TRADES).length;
  let maxCleanRun = 0;
  let run = 0;
  for (const d of days) {
    run = d.impulsive ? 0 : run + 1;
    if (run > maxCleanRun) maxCleanRun = run;
  }

  const sessions = inputs.sessions.filter((s) => inWeek.has(s.day));
  const avgScore = sessions.length ? sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length : 0;

  const scoresByDay = new Map<string, number[]>();
  for (const s of sessions) {
    const arr = scoresByDay.get(s.day) ?? [];
    arr.push(s.score);
    scoresByDay.set(s.day, arr);
  }
  let goldDays = 0;
  for (const scores of Array.from(scoresByDay.values())) {
    if (scores.reduce((a, b) => a + b, 0) / scores.length >= GOLD_DAY_SCORE) goldDays++;
  }

  const earlyBird = sessions.filter((s) => s.hour < EARLY_HOUR).length;
  const journalDays = scoresByDay.size;
  const weekendDays = Array.from(scoresByDay.keys()).filter(isWeekend).length;

  const prevAvg = inputs.prevScores.length
    ? inputs.prevScores.reduce((a, b) => a + b, 0) / inputs.prevScores.length
    : 0;
  const scoreClimb =
    sessions.length >= MIN_SESSIONS_FOR_AVG && inputs.prevScores.length >= MIN_SESSIONS_FOR_AVG
      ? avgScore - prevAvg
      : 0;

  return {
    tradedDays,
    cleanDays,
    maxCleanRun,
    calmDays,
    sessions: sessions.length,
    avgScore,
    goldDays,
    earlyBird,
    weekendDays,
    journalDays,
    scoreClimb,
  };
}

/** Displayed progress toward the target (integers, capped at nothing). */
export function challengeProgress(c: CommunityChallenge, s: WeekStats): number {
  switch (c.metric) {
    case "clean_days": return s.cleanDays;
    case "clean_run": return s.maxCleanRun;
    case "sessions": return s.sessions;
    case "gold_avg": return s.sessions >= MIN_SESSIONS_FOR_AVG ? Math.round(s.avgScore) : 0;
    case "gold_days": return s.goldDays;
    case "early_bird": return s.earlyBird;
    case "journal_days": return s.journalDays;
    case "calm_days": return s.calmDays;
    case "weekend_days": return s.weekendDays;
    case "score_climb": return Math.max(0, Math.floor(s.scoreClimb));
  }
}

export function challengeCompleted(c: CommunityChallenge, s: WeekStats): boolean {
  return challengeProgress(c, s) >= c.target;
}

/**
 * Continuous ranking score. Completion is binary but the podium is not: the
 * week's average discipline score (decimals) is folded in as a tiebreaker
 * (÷1000 so it can never outweigh one unit of real progress).
 */
export function challengeRankScore(c: CommunityChallenge, s: WeekStats): number {
  if (c.metric === "gold_avg") return s.sessions >= MIN_SESSIONS_FOR_AVG ? s.avgScore : 0;
  if (c.metric === "score_climb") return Math.max(0, s.scoreClimb);
  return challengeProgress(c, s) + Math.min(100, Math.max(0, s.avgScore)) / 1000;
}

/**
 * Competition ranking ("1224"): ties share the rank, the next one skips.
 * Input scores may be in any order; returns rank per index (1-based), or null
 * for entries with no progress.
 */
export function competitionRanks(scores: number[]): (number | null)[] {
  const sorted = scores.filter((v) => v > 0).sort((a, b) => b - a);
  return scores.map((v) => (v > 0 ? sorted.findIndex((x) => x === v) + 1 : null));
}

/** Emblem shown next to the username the week after a podium finish. */
export const PODIUM_FLAIR: Record<number, string> = { 1: "👑", 2: "🥈", 3: "🥉" };

/**
 * Streak freezes granted by completed challenges, capped per month so a great
 * week doesn't make the discipline streak unbreakable.
 */
export const CHALLENGE_FREEZE_CAP_PER_MONTH = 4;

export function challengeFreezeBonus(completedThisMonth: number): number {
  return Math.min(CHALLENGE_FREEZE_CAP_PER_MONTH, Math.max(0, completedThisMonth));
}
