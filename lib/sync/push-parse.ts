// Pure parsing/validation for the push sync rail — no I/O, no framework
// imports, so it's trivially unit-testable and shared by the route handler.
// This is the contract every client (MetaTrader EA, cTrader cBot, NinjaTrader
// add-on) must satisfy in its JSON payload.

/** All platforms that push trades through this rail. */
export type PushSource = "mt4" | "mt5" | "ctrader" | "ninjatrader" | "tradingview";

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

const KNOWN_SOURCES: readonly PushSource[] = ["mt4", "mt5", "ctrader", "ninjatrader", "tradingview"];

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
  if (!isNaN(asNum)) {
    // Un horodatage numérique antérieur à ~2001 n'existe pas pour un trade :
    // c'est un 0 envoyé par un client qui n'a pas retrouvé la donnée. On le
    // refuse au lieu de journaliser un trade daté du 1er janvier 1970.
    if (asNum <= 1_000_000_000) return null;
    // Distinguish seconds from milliseconds (threshold: year ~2001 in seconds)
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return new Date(ms).toISOString();
  }

  // Otherwise try parsing as date string
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Explique pourquoi un trade est refusé, ou renvoie null s'il est valide.
 *
 * Le rail push répond toujours 200 (les clients MQL/NinjaScript rejouent mal
 * les erreurs HTTP) : sans motif explicite, un trade mal formé disparaissait
 * en silence. Le motif est renvoyé dans la réponse pour que l'EA l'affiche
 * dans son journal.
 */
export function tradeRejectReason(t: unknown): string | null {
  if (!t || typeof t !== "object") return "trade absent ou illisible";
  const o = t as Record<string, unknown>;

  const hasTicket =
    (typeof o.ticket === "number" && !isNaN(o.ticket)) ||
    (typeof o.ticket === "string" && o.ticket.trim() !== "");
  if (!hasTicket) return "ticket manquant";
  if (!o.symbol || typeof o.symbol !== "string" || o.symbol.trim() === "")
    return "symbole manquant";
  if (!o.direction || typeof o.direction !== "string") return "sens (direction) manquant";
  if (mapDirection(o.direction as string) === null)
    return `sens inconnu : ${String(o.direction)}`;
  if (typeof o.volume !== "number" || o.volume <= 0) return "volume nul ou invalide";
  if (typeof o.open_price !== "number" || o.open_price <= 0)
    return "prix d'ouverture nul (deal d'ouverture introuvable dans l'historique chargé)";
  if (typeof o.close_price !== "number" || o.close_price <= 0)
    return "prix de clôture nul ou invalide";
  if (!toIso(o.open_time as string | number))
    return "heure d'ouverture nulle (deal d'ouverture introuvable dans l'historique chargé)";
  if (!toIso(o.close_time as string | number)) return "heure de clôture nulle ou invalide";

  return null;
}

export function isValidTrade(t: unknown): t is PushTrade {
  return tradeRejectReason(t) === null;
}

/** Ticket lisible pour les messages d'erreur, même sur un payload non conforme. */
export function readTicket(t: unknown): string {
  if (!t || typeof t !== "object") return "?";
  const v = (t as Record<string, unknown>).ticket;
  if (typeof v === "number" || typeof v === "string") return String(v);
  return "?";
}
