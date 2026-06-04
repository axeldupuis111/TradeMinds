/**
 * position-sizing.ts
 * Pure utility — no side-effects, no Supabase, fully testable.
 *
 * Converts a risk amount (€) into a recommended lot size given
 * a Stop-Loss in pips and the pip value per lot for an instrument.
 */

import { AssetType, detectAssetType } from "@/lib/pips";

// ---------------------------------------------------------------------------
// Pip value per standard lot (USD/EUR approximation, account denominated in USD).
// null = no reliable default → user must enter manually.
// Assumptions:
//   forex_major : 1 lot = 100 000 units, 1 pip = $10
//   forex_jpy   : similar but slightly lower due to USD/JPY rate variation
//   xauusd      : 1 lot = 100 oz, pip size 0.10 → $10/pip/lot
//   xagusd      : 1 lot = 5 000 oz, pip size 0.01 → $50/pip/lot
//   index/crypto/oil: contract specs vary by broker → null (manual)
// ---------------------------------------------------------------------------
export const DEFAULT_PIP_VALUE_PER_LOT: Record<AssetType, number | null> = {
  forex_major: 10,
  forex_jpy: 9,
  xauusd: 10,
  xagusd: 50,
  index: null,
  crypto: null,
  oil: null,
  unknown: null,
};

export function getDefaultPipValuePerLot(symbol: string): number | null {
  return DEFAULT_PIP_VALUE_PER_LOT[detectAssetType(symbol)];
}

// ---------------------------------------------------------------------------
// computeMaxRiskEur
// Takes the MIN of all defined ceilings:
//   a) risk_pct/100 * accountSize   (strategy rule)
//   b) dailyDdRemainingEur          (daily DD cap from challenge)
//   c) totalDdRemainingEur          (total DD cap from challenge)
// Undefined / null / 0 values are skipped (no ceiling applied from that source).
// ---------------------------------------------------------------------------
export type RiskCap = "risk_pct" | "daily_dd" | "total_dd";

export interface MaxRiskResult {
  riskEur: number;
  cappedBy: RiskCap;
}

export interface ComputeMaxRiskParams {
  riskPct?: number | null;          // strategy.risk_per_trade_pct
  accountSize: number;
  dailyDdRemainingEur?: number | null;
  totalDdRemainingEur?: number | null;
}

export function computeMaxRiskEur(params: ComputeMaxRiskParams): MaxRiskResult | null {
  const { riskPct, accountSize, dailyDdRemainingEur, totalDdRemainingEur } = params;

  const candidates: { value: number; cap: RiskCap }[] = [];

  // risk_pct: null or 0 means "no rule defined" — skip.
  if (riskPct != null && riskPct > 0 && accountSize > 0) {
    candidates.push({ value: (riskPct / 100) * accountSize, cap: "risk_pct" });
  }
  // DD ceilings: 0 is a REAL ceiling (limit reached), not "unconfigured".
  // Include whenever the value is defined (non-null), even if 0 or negative.
  if (dailyDdRemainingEur != null) {
    candidates.push({ value: dailyDdRemainingEur, cap: "daily_dd" });
  }
  if (totalDdRemainingEur != null) {
    candidates.push({ value: totalDdRemainingEur, cap: "total_dd" });
  }

  if (candidates.length === 0) return null;

  // Pick the most restrictive ceiling, clamped to 0 (never negative risk).
  const winner = candidates.reduce((min, c) => (c.value < min.value ? c : min));
  return { riskEur: Math.max(0, winner.value), cappedBy: winner.cap };
}

// ---------------------------------------------------------------------------
// computeLotSize
// lots = riskEur / (slPips * pipValuePerLot), rounded to 0.01.
// ---------------------------------------------------------------------------
export interface LotSizeResult {
  lots: number;   // rounded to 0.01
  raw: number;    // unrounded
}

export function computeLotSize(params: {
  riskEur: number;
  slPips: number;
  pipValuePerLot: number;
}): LotSizeResult | null {
  const { riskEur, slPips, pipValuePerLot } = params;
  if (slPips <= 0 || pipValuePerLot <= 0 || riskEur <= 0) return null;

  const raw = riskEur / (slPips * pipValuePerLot);
  const lots = Math.round(raw * 100) / 100; // 0.01 precision
  return { lots, raw };
}

// ---------------------------------------------------------------------------
// Futures sizing
// FLOOR (never round up) — must never exceed riskAmount.
// ---------------------------------------------------------------------------

/**
 * Number of contracts to trade given a risk budget, SL in points, and
 * the contract's point value ($/point/contract).
 * Uses Math.floor so the actual risk never exceeds riskAmount.
 */
export function computeContracts(params: {
  riskAmount: number;   // $ risk budget
  slPoints: number;     // stop-loss distance in points
  pointValue: number;   // $/point/contract (from FuturesContract.pointValue)
}): number {
  const { riskAmount, slPoints, pointValue } = params;
  if (slPoints <= 0 || pointValue <= 0 || riskAmount <= 0) return 0;
  return Math.floor(riskAmount / (slPoints * pointValue));
}

/**
 * Actual $ risk for a given number of contracts (post-floor, ≤ riskAmount).
 */
export function actualRiskForContracts(params: {
  contracts: number;
  slPoints: number;
  pointValue: number;
}): number {
  const { contracts, slPoints, pointValue } = params;
  return contracts * slPoints * pointValue;
}
