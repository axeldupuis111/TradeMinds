/**
 * futures-contracts.ts
 * Verified CME Group contract specifications (as of 2025).
 * Sources: CME Group product pages + NinjaTrader / Tradovate contract specs.
 *
 * tickValue  = monetary gain/loss for 1 tick move on 1 contract (in USD)
 * pointValue = monetary gain/loss for 1 full point move on 1 contract (in USD)
 * tickSize   = minimum price increment (in points)
 *
 * Relationship: tickValue = tickSize × pointValue
 */

export type FuturesContract = {
  symbol: string;
  name: string;
  tickSize: number;
  tickValue: number;    // USD per tick per contract
  pointValue: number;   // USD per full point per contract
  currency: "USD";
};

export const FUTURES_CONTRACTS: FuturesContract[] = [
  // ── Equity Index ─────────────────────────────────────────────────────────
  { symbol: "ES",  name: "E-mini S&P 500",          tickSize: 0.25, tickValue: 12.50, pointValue: 50,   currency: "USD" },
  { symbol: "MES", name: "Micro E-mini S&P 500",    tickSize: 0.25, tickValue: 1.25,  pointValue: 5,    currency: "USD" },
  { symbol: "NQ",  name: "E-mini Nasdaq-100",       tickSize: 0.25, tickValue: 5.00,  pointValue: 20,   currency: "USD" },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq-100", tickSize: 0.25, tickValue: 0.50,  pointValue: 2,    currency: "USD" },
  { symbol: "YM",  name: "E-mini Dow",              tickSize: 1.0,  tickValue: 5.00,  pointValue: 5,    currency: "USD" },
  { symbol: "MYM", name: "Micro E-mini Dow",        tickSize: 1.0,  tickValue: 0.50,  pointValue: 0.50, currency: "USD" },
  { symbol: "RTY", name: "E-mini Russell 2000",     tickSize: 0.10, tickValue: 5.00,  pointValue: 50,   currency: "USD" },
  { symbol: "M2K", name: "Micro E-mini Russell",    tickSize: 0.10, tickValue: 0.50,  pointValue: 5,    currency: "USD" },
  // ── Energy ───────────────────────────────────────────────────────────────
  { symbol: "CL",  name: "Crude Oil (WTI)",         tickSize: 0.01, tickValue: 10.00, pointValue: 1000, currency: "USD" },
  { symbol: "MCL", name: "Micro WTI Crude Oil",     tickSize: 0.01, tickValue: 1.00,  pointValue: 100,  currency: "USD" },
  // ── Metals ───────────────────────────────────────────────────────────────
  { symbol: "GC",  name: "Gold",                    tickSize: 0.10, tickValue: 10.00, pointValue: 100,  currency: "USD" },
  { symbol: "MGC", name: "Micro Gold",              tickSize: 0.10, tickValue: 1.00,  pointValue: 10,   currency: "USD" },
];

/**
 * Returns the contract spec for a given symbol (case-insensitive), or null if unknown.
 */
export function getFuturesContract(symbol: string): FuturesContract | null {
  const upper = symbol.trim().toUpperCase();
  return FUTURES_CONTRACTS.find((c) => c.symbol === upper) ?? null;
}
