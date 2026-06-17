/**
 * challenge-projection.ts
 * Pure, testable projection of a prop-firm challenge outcome.
 *
 * Two honest, explainable outputs (no made-up numbers):
 *  1. Pace projection — at your current profit-per-trading-day, how many
 *     trading days until you hit the target.
 *  2. Success probability — models your equity as a random walk with drift
 *     (your per-trade mean & std) and computes the probability of reaching the
 *     profit target (+a) before breaching the total drawdown floor (−b). This
 *     is the classic "gambler's ruin with drift" barrier probability — a real
 *     model, with the fair-coin limit P = b/(a+b) when you have no edge.
 */

export interface ChallengeProjectionInput {
  /** € of profit still needed to reach the target (≥ 0). */
  profitRemainingEur: number;
  /** € of buffer before breaching the total drawdown (the failure floor, ≥ 0). */
  ddBufferEur: number;
  /** Net P&L (€) of each closed trade, in chronological order. */
  tradePnls: number[];
  /** ISO open_time of each trade (same order) — used for the pace projection. */
  tradeDays: string[];
}

export type ChallengeStatus = "passed" | "failed" | "on_track" | "behind" | "at_risk" | "insufficient";

export interface ChallengeProjection {
  status: ChallengeStatus;
  /** 0..1 probability of hitting target before breaching DD. null if not enough data. */
  successProb: number | null;
  /** Trading days to reach target at current pace. null if pace ≤ 0 or done. */
  daysToTarget: number | null;
  /** Average net P&L per trading day so far (€). */
  pacePerDay: number;
}

const MIN_TRADES = 10;

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stdDev(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((s, v) => s + (v - mu) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/**
 * P(reach +a before −b) for a Brownian motion with per-step drift mu and
 * variance sigma². Returns b/(a+b) in the driftless limit.
 */
export function barrierProbability(a: number, b: number, mu: number, sigma: number): number {
  if (a <= 0) return 1; // target already reached
  if (b <= 0) return 0; // already at the floor
  if (sigma <= 0) return mu > 0 ? 1 : 0; // deterministic
  const k = (2 * mu) / (sigma * sigma);
  if (Math.abs(k) < 1e-9) return b / (a + b); // no edge → fair gambler's ruin
  // P = (e^{k·b} − 1) / (e^{k·b} − e^{−k·a}), with overflow guards.
  const kb = k * b;
  const negKa = -k * a;
  if (kb > 700) return 1; // strong positive drift
  if (negKa > 700) return 0; // strong negative drift
  const expKb = Math.exp(kb);
  const expNegKa = Math.exp(negKa);
  const p = (expKb - 1) / (expKb - expNegKa);
  if (!isFinite(p)) return mu > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, p));
}

export function projectChallenge(input: ChallengeProjectionInput): ChallengeProjection {
  const { profitRemainingEur, ddBufferEur, tradePnls, tradeDays } = input;

  if (profitRemainingEur <= 0) {
    return { status: "passed", successProb: 1, daysToTarget: 0, pacePerDay: 0 };
  }
  if (ddBufferEur <= 0) {
    return { status: "failed", successProb: 0, daysToTarget: null, pacePerDay: 0 };
  }

  // ── Pace per trading day ────────────────────────────────────────────────
  const distinctDays = new Set(tradeDays.map((d) => d.split("T")[0]).filter(Boolean));
  const tradingDays = Math.max(1, distinctDays.size);
  const totalPnl = tradePnls.reduce((s, v) => s + v, 0);
  const pacePerDay = totalPnl / tradingDays;
  const daysToTarget = pacePerDay > 0 ? Math.ceil(profitRemainingEur / pacePerDay) : null;

  if (tradePnls.length < MIN_TRADES) {
    return { status: "insufficient", successProb: null, daysToTarget, pacePerDay };
  }

  // ── Success probability (random walk with drift) ────────────────────────
  const mu = mean(tradePnls);
  const sigma = stdDev(tradePnls, mu);
  const successProb = barrierProbability(profitRemainingEur, ddBufferEur, mu, sigma);

  const status: ChallengeStatus =
    successProb >= 0.6 ? "on_track" : successProb >= 0.35 ? "behind" : "at_risk";

  return { status, successProb, daysToTarget, pacePerDay };
}
