export type AssetType = "forex_major" | "forex_jpy" | "xauusd" | "xagusd" | "index" | "crypto" | "oil" | "unknown";

export type TradeResult = "win" | "loss" | "breakeven";

const INDEX_PATTERNS = /^(US30|NAS100|SPX500|GER40|UK100|JPN225|FRA40|DJI|NDX|SPX|DAX|FTSE|NIKKEI)/i;
const CRYPTO_PATTERNS = /^(BTC|ETH|XRP|LTC|SOL|ADA|DOGE)/i;
const OIL_PATTERNS = /^(WTI|BRENT|USOIL|UKOIL|XTIUSD|XBRUSD)/i;
const GOLD_PATTERNS = /^(XAUUSD|GOLD)/i;
const SILVER_PATTERNS = /^(XAGUSD|SILVER)/i;
const JPY_PATTERN = /JPY/i;
const FOREX_6CHAR = /^[A-Z]{6}$/;

function cleanSymbol(symbol: string): string {
  return symbol.replace(/[.#_\-].*$/, "").replace(/m$/i, "").toUpperCase();
}

export function detectAssetType(symbol: string): AssetType {
  const clean = cleanSymbol(symbol);

  if (GOLD_PATTERNS.test(clean)) return "xauusd";
  if (SILVER_PATTERNS.test(clean)) return "xagusd";
  if (JPY_PATTERN.test(clean)) return "forex_jpy";
  if (INDEX_PATTERNS.test(clean)) return "index";
  if (CRYPTO_PATTERNS.test(clean)) return "crypto";
  if (OIL_PATTERNS.test(clean)) return "oil";
  if (FOREX_6CHAR.test(clean)) return "forex_major";

  console.warn(`[pips] Unknown asset type for symbol: ${symbol}`);
  return "unknown";
}

const PIP_VALUES: Record<AssetType, number> = {
  forex_major: 0.0001,
  forex_jpy: 0.01,
  xauusd: 0.10,
  xagusd: 0.01,
  index: 1,
  crypto: 1,
  oil: 0.01,
  unknown: 0.0001,
};

export function getPipValue(symbol: string): number {
  return PIP_VALUES[detectAssetType(symbol)];
}

export function calculatePips(symbol: string, priceA: number, priceB: number): number {
  const pipValue = getPipValue(symbol);
  const raw = Math.abs(priceA - priceB) / pipValue;
  return Math.round(raw * 10) / 10;
}

export function getTradeResult(pnlNet: number, accountBalance?: number): TradeResult {
  const threshold = accountBalance ? Math.max(2, accountBalance * 0.001) : 2;
  if (Math.abs(pnlNet) < threshold) return "breakeven";
  return pnlNet > 0 ? "win" : "loss";
}
