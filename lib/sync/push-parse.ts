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

/**
 * État du compte au moment de l'envoi, tel que le broker le connaît.
 *
 * Envoyé par le client à chaque lot de trades ET à chaque battement de cœur
 * (toutes les 60 s, même sans trade fermé). C'est ce qui permet d'afficher le
 * vrai solde au lieu d'une reconstitution, et de suivre l'equity en direct
 * pendant qu'une position est ouverte.
 */
export interface AccountSnapshot {
  account: string;
  balance: number;
  equity: number;
  open_positions: number;
  currency: string | null;
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

/** Offset maximal plausible entre une heure serveur et l'UTC (UTC+14 / UTC-12). */
const MAX_BROKER_OFFSET_SEC = 14 * 3600;

/**
 * Décalage, en secondes, entre l'heure serveur du broker et l'UTC réel.
 *
 * MetaTrader exprime TOUS ses horodatages (DEAL_TIME, OrderCloseTime,
 * TimeCurrent) en heure SERVEUR du broker, sérialisée en secondes depuis epoch.
 * Lus tels quels, les trades d'un broker à GMT+3 sont datés 3 h dans le futur,
 * ce qui décale les fenêtres « aujourd'hui » : un trade de fin de séance peut
 * basculer sur le lendemain, et l'alerte de perte journalière se tromper de jour.
 *
 * L'EA envoie son `TimeCurrent()` dans le champ `server_time`. On le compare à
 * NOTRE horloge : pas besoin que la machine du trader soit à l'heure, ni de lui
 * demander sa timezone. L'écart est arrondi à l'heure pleine, ce qui absorbe la
 * latence réseau tout en collant aux offsets réellement pratiqués par les
 * serveurs MetaTrader.
 *
 * Renvoie 0 quand `server_time` est absent (anciens EA, autres rails) ou
 * aberrant : ne rien corriger vaut mieux que corriger de travers.
 */
export function brokerOffsetSeconds(serverTime: unknown, receivedAtMs: number): number {
  const raw = typeof serverTime === "number" ? serverTime : Number(serverTime);
  if (!serverTime || !isFinite(raw) || raw <= 1_000_000_000) return 0;

  const deltaSec = raw - Math.floor(receivedAtMs / 1000);
  if (Math.abs(deltaSec) > MAX_BROKER_OFFSET_SEC + 3600) return 0;

  const rounded = Math.round(deltaSec / 3600) * 3600;
  return Math.abs(rounded) > MAX_BROKER_OFFSET_SEC ? 0 : rounded;
}

/**
 * Convert a time value to ISO 8601 string.
 * Accepts: ISO string, Unix seconds (number), or Unix seconds as string.
 *
 * `offsetSeconds` corrige l'heure serveur du broker (voir brokerOffsetSeconds).
 * Il ne s'applique qu'aux horodatages numériques : une chaîne ISO porte déjà son
 * fuseau, la retoucher la casserait.
 */
export function toIso(
  value: string | number | null | undefined,
  offsetSeconds = 0,
): string | null {
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
    return new Date(ms - offsetSeconds * 1000).toISOString();
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

/**
 * Valide l'état de compte envoyé par le client, ou renvoie null s'il est
 * inexploitable. Un état invalide n'est jamais fatal : les trades du même
 * payload doivent continuer d'être enregistrés.
 *
 * Le n° de compte est obligatoire : sans lui on ne saurait pas à quel compte
 * TradeDiscipline rattacher le solde, et écrire un solde sur le mauvais compte
 * est pire que ne rien écrire.
 */
export function readAccountSnapshot(val: unknown): AccountSnapshot | null {
  if (!val || typeof val !== "object") return null;
  const o = val as Record<string, unknown>;

  const account = o.account == null ? "" : String(o.account).trim();
  if (account === "") return null;

  const balance = readFiniteNumber(o.balance);
  if (balance === null) return null;

  // L'equity peut manquer sur un client minimaliste : on retombe sur le solde,
  // ce qui revient à dire « aucune position ouverte ».
  const equity = readFiniteNumber(o.equity) ?? balance;

  // Un compte réel n'est jamais à 0,00 de solde ET 0,00 d'equity : c'est la
  // signature d'un client qui n'a pas réussi à lire l'état du compte.
  if (balance === 0 && equity === 0) return null;

  const openRaw = readFiniteNumber(o.open_positions);
  const open_positions = openRaw !== null && openRaw > 0 ? Math.round(openRaw) : 0;

  const currency =
    typeof o.currency === "string" && o.currency.trim() !== ""
      ? o.currency.trim().toUpperCase().slice(0, 8)
      : null;

  return { account, balance, equity, open_positions, currency };
}

/** Nombre exploitable (les clients MQL sérialisent parfois les nombres en texte). */
function readFiniteNumber(val: unknown): number | null {
  if (typeof val === "number") return isFinite(val) ? val : null;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return isFinite(n) ? n : null;
  }
  return null;
}

/** Ticket lisible pour les messages d'erreur, même sur un payload non conforme. */
export function readTicket(t: unknown): string {
  if (!t || typeof t !== "object") return "?";
  const v = (t as Record<string, unknown>).ticket;
  if (typeof v === "number" || typeof v === "string") return String(v);
  return "?";
}
