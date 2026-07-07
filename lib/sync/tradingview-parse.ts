// Normalisation des alertes webhook TradingView vers le contrat PushTrade du
// rail push. Module pur (pas d'I/O) — la route /api/sync/tradingview délègue
// ensuite à syncPushTrades.
//
// Contraintes TradingView : pas de header custom (le token passe dans l'URL
// `?token=` ou dans le corps), et les placeholders ({{close}}, {{timenow}}…)
// sont substitués en TEXTE — les nombres arrivent donc souvent en string.
// Le message d'alerte est libre : on accepte les alias de champs courants
// (ticker/symbol, qty/volume, entry/exit…) en plus du contrat canonique.

import type { PushTrade } from "./push-parse";

/** Coerce number | numeric string → number (TradingView substitue en texte). */
function toNum(val: unknown): number | undefined {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val.trim());
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function toStr(val: unknown): string | undefined {
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  if (typeof val === "number" && !isNaN(val)) return String(val);
  return undefined;
}

function firstOf<T>(o: Record<string, unknown>, keys: string[], map: (v: unknown) => T | undefined): T | undefined {
  for (const k of keys) {
    if (o[k] != null) {
      const v = map(o[k]);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

// Hash djb2 → ticket synthétique déterministe : un même trade renvoyé deux
// fois (retry TradingView, réplique d'alerte) reste dédupliqué par l'index
// unique (user_id, source, external_id).
function syntheticTicket(parts: (string | number)[]): string {
  const s = parts.join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `tv-${h.toString(36)}`;
}

/**
 * Direction : accepte long/short/buy/sell (contrat push) mais aussi la valeur
 * de {{strategy.prev_market_position}} qui décrit la position tout juste
 * clôturée. "flat" (aucune position fermée) est invalide.
 */
function mapTvDirection(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (["buy", "long"].includes(v)) return "long";
  if (["sell", "short"].includes(v)) return "short";
  return null;
}

/** Résultat de la normalisation d'un objet trade TradingView. */
export function normalizeTradingViewTrade(input: unknown): PushTrade | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const symbol = firstOf(o, ["symbol", "ticker", "pair"], toStr);
  const dirRaw = firstOf(o, ["direction", "side", "position", "market_position"], toStr);
  const direction = dirRaw ? mapTvDirection(dirRaw) : null;
  const volume = firstOf(o, ["volume", "qty", "quantity", "contracts", "size", "lots"], toNum);
  const openPrice = firstOf(o, ["open_price", "entry_price", "entry", "avg_entry_price"], toNum);
  const closePrice = firstOf(o, ["close_price", "exit_price", "exit", "close", "price"], toNum);
  const openTimeRaw = firstOf(o, ["open_time", "entry_time"], (v) =>
    typeof v === "number" || typeof v === "string" ? (v as string | number) : undefined,
  );
  const closeTimeRaw = firstOf(o, ["close_time", "exit_time", "time", "timenow"], (v) =>
    typeof v === "number" || typeof v === "string" ? (v as string | number) : undefined,
  );

  if (!symbol || !direction || !volume || volume <= 0) return null;
  if (!openPrice || openPrice <= 0 || !closePrice || closePrice <= 0) return null;

  // Temps : la clôture par défaut = maintenant (l'alerte part au moment du
  // trade) ; l'ouverture par défaut = la clôture (trade sans durée plutôt que
  // trade rejeté — le guide recommande d'envoyer les vrais horodatages).
  const closeTime = closeTimeRaw ?? new Date().toISOString();
  const openTime = openTimeRaw ?? closeTime;

  // P&L : fourni par le snippet Pine (strategy.closedtrades.profit). À défaut,
  // repli en termes de prix — exact pour actions/crypto (qty en unités),
  // approximatif pour le forex en lots (documenté dans le guide).
  const sign = direction === "long" ? 1 : -1;
  const profit =
    firstOf(o, ["profit", "pnl", "net_profit"], toNum) ??
    (closePrice - openPrice) * volume * sign;

  const ticket =
    firstOf(o, ["ticket", "id", "trade_id"], toStr) ??
    syntheticTicket([symbol.toUpperCase(), direction, String(openTime), String(closeTime), volume]);

  return {
    ticket,
    symbol,
    direction,
    volume,
    open_price: openPrice,
    close_price: closePrice,
    open_time: openTime,
    close_time: closeTime,
    profit,
    commission: firstOf(o, ["commission", "fees"], toNum) ?? 0,
    swap: firstOf(o, ["swap"], toNum) ?? 0,
    sl: firstOf(o, ["sl", "stop_loss"], toNum) ?? null,
    tp: firstOf(o, ["tp", "take_profit"], toNum) ?? null,
    source: "tradingview",
    account: firstOf(o, ["account"], toStr),
  };
}

export interface TradingViewNormalized {
  token: string | null;
  trades: PushTrade[];
  /** Nombre d'objets trade reçus mais invalides (champ requis manquant). */
  invalid: number;
}

/**
 * Normalise un payload webhook TradingView complet. Formes acceptées :
 * - objet trade "à plat" (le message d'alerte EST le trade) ;
 * - { trade: {...} } ou { trades: [...] } (contrat canonique du rail push).
 * Le token vient de l'URL (?token=) en priorité, sinon du corps.
 */
export function normalizeTradingViewPayload(
  payload: unknown,
  urlToken?: string | null,
): TradingViewNormalized {
  const bodyToken =
    payload && typeof payload === "object"
      ? toStr((payload as Record<string, unknown>).token)
      : undefined;
  const token = urlToken?.trim() || bodyToken || null;

  const rawTrades: unknown[] = [];
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.trades)) rawTrades.push(...o.trades);
    else if (o.trade && typeof o.trade === "object") rawTrades.push(o.trade);
    else rawTrades.push(o); // forme "à plat"
  }

  const trades: PushTrade[] = [];
  let invalid = 0;
  for (const raw of rawTrades) {
    const t = normalizeTradingViewTrade(raw);
    if (t) trades.push(t);
    else invalid++;
  }

  return { token, trades, invalid };
}
