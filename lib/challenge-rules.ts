/**
 * challenge-rules.ts
 * Single source of truth for prop-challenge rule calculations.
 *
 * Used by:
 *  - app/dashboard/challenge/page.tsx  (progress bars)
 *  - components/dashboard/ChallengeGuardian.tsx  (real-time Premium alerts)
 */

export interface ChallengeForRules {
  account_size: number;
  profit_target_pct: number;
  max_daily_dd_pct: number;
  max_total_dd_pct: number;
  /** true → DD is measured from equity peak (trailing); false → from initial account_size */
  trailing_drawdown: boolean;
}

export interface ChallengeRulesResult {
  // ── ProgressBar inputs ──────────────────────────────────────────────────────
  /** € profit so far (clamped ≥ 0) */
  profitUsed: number;
  /** € profit target */
  profitMax: number;

  /** € daily drawdown consumed (= abs(todayPnl) when negative, else 0) */
  dailyDdUsed: number;
  /** € daily drawdown limit */
  dailyDdMax: number;

  /** € total drawdown consumed (trailing-aware) */
  totalDdUsed: number;
  /** € total drawdown limit */
  totalDdMax: number;

  // ── Usage ratios (0 … 1+) ───────────────────────────────────────────────────
  objectiveProgressPct: number; // profitUsed / profitMax
  ddDailyUsedPct: number;       // dailyDdUsed / dailyDdMax
  ddTotalUsedPct: number;       // totalDdUsed / totalDdMax

  // ── Remaining margins ───────────────────────────────────────────────────────
  profitRemainingEur: number;
  dailyDdRemainingEur: number;
  totalDdRemainingEur: number;

  // ── Derived ─────────────────────────────────────────────────────────────────
  currentPnl: number;  // balance − account_size (can be negative)
  /** Peak equity used for trailing DD; equals account_size when trailing=false */
  equityHigh: number;
}

/**
 * @param challenge  - the prop_challenges row fields needed for rules
 * @param balance    - current account balance (account_size + sum of all trades pnl)
 * @param todayPnl   - sum of today's closed trades pnl
 * @param equityCurveBalances - ordered running balance at each trade close point
 *                             (needed only when trailing_drawdown = true)
 */
export function computeChallengeRules(
  challenge: ChallengeForRules,
  balance: number,
  todayPnl: number,
  equityCurveBalances: number[],
): ChallengeRulesResult {
  const { account_size, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown } =
    challenge;

  const currentPnl = balance - account_size;

  // ── Profit ──────────────────────────────────────────────────────────────────
  const profitMax = account_size * (profit_target_pct / 100);
  const profitUsed = Math.max(0, currentPnl);
  const profitRemainingEur = Math.max(0, profitMax - profitUsed);
  const objectiveProgressPct = profitMax > 0 ? profitUsed / profitMax : 0;

  // ── Daily DD ─────────────────────────────────────────────────────────────────
  const dailyDdMax = account_size * (max_daily_dd_pct / 100);
  const dailyDdUsed = Math.max(0, -todayPnl);
  const dailyDdRemainingEur = Math.max(0, dailyDdMax - dailyDdUsed);
  const ddDailyUsedPct = dailyDdMax > 0 ? dailyDdUsed / dailyDdMax : 0;

  // ── Total DD (trailing-aware) ────────────────────────────────────────────────
  const totalDdMax = account_size * (max_total_dd_pct / 100);

  // Trailing: measure DD from the equity peak.
  // Static:   peak is always account_size (ISO vs. previous inline: max(0, account_size - balance)).
  const equityHigh =
    trailing_drawdown && equityCurveBalances.length > 0
      ? Math.max(account_size, ...equityCurveBalances)
      : account_size;

  const totalDdUsed = Math.max(0, equityHigh - balance);

  const totalDdRemainingEur = Math.max(0, totalDdMax - totalDdUsed);
  const ddTotalUsedPct = totalDdMax > 0 ? totalDdUsed / totalDdMax : 0;

  return {
    profitUsed,
    profitMax,
    dailyDdUsed,
    dailyDdMax,
    totalDdUsed,
    totalDdMax,
    objectiveProgressPct,
    ddDailyUsedPct,
    ddTotalUsedPct,
    profitRemainingEur,
    dailyDdRemainingEur,
    totalDdRemainingEur,
    currentPnl,
    equityHigh,
  };
}
