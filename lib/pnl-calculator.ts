import { INSTRUMENTS } from "./instruments";

/**
 * Returns the contract-size multiplier for a given trading pair.
 * This is intentionally approximate — used to pre-fill the P&L
 * field so the user has a sensible starting point. The user can
 * always override with the exact broker value.
 */
function getMultiplier(pair: string): number {
  const p = pair.toUpperCase().trim();

  // Forex majors / minors : standard lot = 100,000 units
  if ((INSTRUMENTS.forex_majors || []).includes(p)) return 100000;
  if ((INSTRUMENTS.forex_minors || []).includes(p)) return 100000;

  // Metals (XAUUSD, XAGUSD…)
  if ((INSTRUMENTS.metals || []).includes(p)) return 100;

  // Oil / Commodities
  if ((INSTRUMENTS.commodities || []).includes(p)) return 1000;

  // Indices, crypto, stocks : 1:1
  return 1;
}

/**
 * Approximate P&L estimation. Final value should always be confirmed
 * against the broker's actual P&L.
 *
 * Formula: (exit - entry) × lot × multiplier × sign
 *   sign = +1 for long, -1 for short
 */
export function estimatePnl(params: {
  entry: number;
  exit: number;
  lot: number;
  direction: "long" | "short" | "buy" | "sell";
  pair: string;
}): number {
  const { entry, exit, lot, direction, pair } = params;
  if (!isFinite(entry) || !isFinite(exit) || !isFinite(lot)) return 0;
  if (lot <= 0) return 0;

  const dir = direction.toLowerCase();
  const sign = dir === "long" || dir === "buy" ? 1 : -1;
  const multiplier = getMultiplier(pair);

  const raw = (exit - entry) * lot * multiplier * sign;
  // Round to 2 decimals
  return Math.round(raw * 100) / 100;
}
