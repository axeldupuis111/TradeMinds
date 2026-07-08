/**
 * Community challenges — defined in code (like blog posts), so adding one needs
 * no DB change: append here + add the two i18n keys. Participation is stored in
 * the `challenge_participations` table (migration 20260701).
 *
 * Progress metrics:
 *  - "clean_streak": current run of consecutive trading days with no impulsive
 *    (revenge/FOMO/…) trade — reuses lib/discipline-streak.
 *  - "sessions_window": pre-trade sessions completed in the last `windowDays`.
 *  - "gold_week": rolling 7-day average discipline score (0 below 3 sessions,
 *    so one lucky session can't complete the challenge).
 */

export type ChallengeMetric = "clean_streak" | "sessions_window" | "gold_week";

export interface CommunityChallenge {
  key: string;
  metric: ChallengeMetric;
  /** Target value that counts as "completed". */
  target: number;
  /** Window in days for windowed metrics (sessions_window). */
  windowDays?: number;
  titleKey: string;
  descKey: string;
}

export const COMMUNITY_CHALLENGES: CommunityChallenge[] = [
  {
    key: "clean-week",
    metric: "clean_streak",
    target: 7,
    titleKey: "challenge_c_clean_week_title",
    descKey: "challenge_c_clean_week_desc",
  },
  {
    key: "clean-month",
    metric: "clean_streak",
    target: 30,
    titleKey: "challenge_c_clean_month_title",
    descKey: "challenge_c_clean_month_desc",
  },
  {
    key: "sessions-sprint",
    metric: "sessions_window",
    target: 10,
    windowDays: 14,
    titleKey: "challenge_c_sessions_sprint_title",
    descKey: "challenge_c_sessions_sprint_desc",
  },
  {
    key: "gold-week",
    metric: "gold_week",
    target: 85,
    titleKey: "challenge_c_gold_week_title",
    descKey: "challenge_c_gold_week_desc",
  },
];

export function getCommunityChallenge(key: string): CommunityChallenge | undefined {
  return COMMUNITY_CHALLENGES.find((c) => c.key === key);
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
