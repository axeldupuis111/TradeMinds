/**
 * Community challenges — defined in code (like blog posts), so adding one needs
 * no DB change: append here + add the two i18n keys. Participation is stored in
 * the `challenge_participations` table (migration 20260701).
 *
 * Progress metric:
 *  - "clean_streak": current run of consecutive trading days with no impulsive
 *    (revenge/FOMO/…) trade — reuses lib/discipline-streak.
 */

export type ChallengeMetric = "clean_streak";

export interface CommunityChallenge {
  key: string;
  metric: ChallengeMetric;
  /** Target value that counts as "completed". */
  target: number;
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
