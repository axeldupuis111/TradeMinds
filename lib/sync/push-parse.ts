// Pure parsing/validation for the push sync rail — no I/O, no framework
// imports, so it's trivially unit-testable and shared by the route handler.
// This is the contract every client (MetaTrader EA, cTrader cBot, NinjaTrader
// add-on) must satisfy in its JSON payload.

/** All platforms that push trades through this rail. */
export type PushSource = "mt4" | "mt5" | "ctrader" | "ninjatrader";

/** Fields sent by the client software for each closed trade. */
export interface PushTrade {
  ticket: number | string;
  symbol: string;
  direction: string; // "buy" | "sell" | "long" | "short" (case-insensitive)
  volume: number;
  open_price: number;
  close_price: number;
  open_time: string | number; // ISO 8601 or Unix timestamp
  close_time: string | number;
  profit: number;
  commission?: number;
  swap?: number;
  sl?: number | null;
  tp?: number | null;
  source?: string; // platform identifier (defaults to "mt5")
  account?: string | number; // n° de compte de trading (pour rattacher au challenge)
}

const KNOWN_SOURCES: readonly PushSource[] = ["mt4", "mt5", "ctrader", "ninjatrader"];

/**
 * Validate and normalize the source field. Defaults to "mt5" so legacy EAs that
 * never send a source keep working.
 */
export function mapSource(val: unknown): PushSource {
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if ((KNOWN_SOURCES as readonly string[]).includes(v)) return v as PushSource;
  }
  return "mt5";
}

export function mapDirection(val: string): "long" | "short" | null {
  const v = val.trim().toLowerCase();
  if (v === "buy" || v === "long") return "long";
  if (v === "sell" || v === "short") return "short";
  return null;
}

/**
 * Convert a time value to ISO 8601 string.
 * Accepts: ISO string, Unix seconds (number), or Unix seconds as string.
 */
export function toIso(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;

  // If it's a number or a numeric string → treat as Unix seconds
  const asNum = typeof value === "number" ? value : Number(value);
  if (!isNaN(asNum) && asNum > 1_000_000_000) {
    // Distinguish seconds from milliseconds (threshold: year ~2001 in seconds)
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return new Date(ms).toISOString();
  }

  // Otherwise try parsing as date string
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isValidTrade(t: unknown): t is PushTrade {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;

  const hasTicket =
    (typeof o.ticket === "number" && !isNaN(o.ticket)) ||
    (typeof o.ticket === "string" && o.ticket.trim() !== "");
  if (!hasTicket) return false;
  if (!o.symbol || typeof o.symbol !== "string" || o.symbol.trim() === "") return false;
  if (!o.direction || typeof o.direction !== "string") return false;
  if (mapDirection(o.direction as string) === null) return false;
  if (typeof o.volume !== "number" || o.volume <= 0) return false;
  if (typeof o.open_price !== "number" || o.open_price <= 0) return false;
  if (typeof o.close_price !== "number" || o.close_price <= 0) return false;
  if (!toIso(o.open_time as string | number)) return false;
  if (!toIso(o.close_time as string | number)) return false;

  return true;
}
