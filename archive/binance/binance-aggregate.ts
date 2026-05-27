// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw fill from Binance Futures /fapi/v1/userTrades */
export interface BinanceFill {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  price: string; // Binance returns decimal strings for precision
  qty: string;
  realizedPnl: string;
  commission: string;
  time: number; // Unix timestamp in ms
  orderId: number;
  positionSide: "BOTH" | "LONG" | "SHORT";
}

/** Aggregated position ready for insertion into the trades table */
export interface AggregatedPosition {
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number | null;
  lot_size: number;
  open_time: string; // ISO 8601
  close_time: string | null;
  pnl: number;
  commission: number;
  status: "open" | "closed";
  source: "binance";
  external_id: string; // String(first fill id) — stable across syncs
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(s: string): number {
  return parseFloat(s) || 0;
}

/** Round to 8 decimal places (Binance's max precision) to avoid float drift. */
function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

// ─── Internal accumulators ────────────────────────────────────────────────────

interface WeightedFill {
  price: number;
  qty: number;
}

interface PositionAccumulator {
  openingFills: WeightedFill[];
  closingFills: WeightedFill[];
  totalPnl: number;
  totalCommission: number;
  firstFillId: number;
  openTime: number;
  closeTime: number | null;
  direction: "long" | "short";
}

function freshAccumulator(): PositionAccumulator {
  return {
    openingFills: [],
    closingFills: [],
    totalPnl: 0,
    totalCommission: 0,
    firstFillId: 0,
    openTime: 0,
    closeTime: null,
    direction: "long",
  };
}

function vwap(fills: WeightedFill[]): number {
  const notional = fills.reduce((sum, f) => sum + f.price * f.qty, 0);
  const totalQty = fills.reduce((sum, f) => sum + f.qty, 0);
  return totalQty > 0 ? round8(notional / totalQty) : 0;
}

function emitPosition(
  acc: PositionAccumulator,
  symbol: string,
  status: "open" | "closed",
): AggregatedPosition {
  const entryQty = acc.openingFills.reduce((sum, f) => sum + f.qty, 0);

  return {
    pair: symbol,
    direction: acc.direction,
    entry_price: vwap(acc.openingFills),
    exit_price: status === "closed" ? vwap(acc.closingFills) : null,
    lot_size: round8(entryQty),
    open_time: new Date(acc.openTime).toISOString(),
    close_time:
      status === "closed" && acc.closeTime
        ? new Date(acc.closeTime).toISOString()
        : null,
    pnl: round8(acc.totalPnl),
    commission: round8(acc.totalCommission),
    status,
    source: "binance",
    external_id: String(acc.firstFillId),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Aggregate raw Binance Futures fills into complete positions.
 *
 * **Grouping key:**
 * - One-way mode (`positionSide = "BOTH"`): fills are grouped by `symbol`.
 * - Hedge mode (`positionSide = "LONG" | "SHORT"`): fills are grouped by
 *   `symbol:positionSide` so long and short positions on the same symbol
 *   don't interfere.
 *
 * **Position lifecycle:**
 * A position opens when the net quantity leaves 0, and closes when it
 * returns to 0. BUY adds to net qty, SELL subtracts.
 *
 * **Inversion handling** (e.g. LONG 5 → SELL 8 in one fill):
 * The fill is split — 5 units close the existing long, 3 units open a new
 * short. ALL realizedPnl goes to the closing position (opening a position
 * realizes no gain by definition). Commission is split pro-rata.
 * In practice Binance usually emits separate fills for each leg of an
 * inversion, but this handles the single-fill edge case correctly.
 */
export function aggregateFills(fills: BinanceFill[]): AggregatedPosition[] {
  if (fills.length === 0) return [];

  // Chronological, then by fill id for deterministic same-timestamp ordering
  const sorted = [...fills].sort((a, b) => a.time - b.time || a.id - b.id);

  // Group by symbol (one-way) or symbol:positionSide (hedge)
  const groups = new Map<string, BinanceFill[]>();
  for (const fill of sorted) {
    const key =
      fill.positionSide === "BOTH"
        ? fill.symbol
        : `${fill.symbol}:${fill.positionSide}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(fill);
  }

  const positions: AggregatedPosition[] = [];

  const groupValues = Array.from(groups.values());
  for (const groupFills of groupValues) {
    const symbol = groupFills[0].symbol;
    let netQty = 0;
    let acc = freshAccumulator();

    for (const fill of groupFills) {
      const price = num(fill.price);
      const qty = num(fill.qty);
      const pnl = num(fill.realizedPnl);
      const commission = num(fill.commission);
      const signedQty = fill.side === "BUY" ? qty : -qty;

      const prevNet = netQty;
      const newNet = round8(prevNet + signedQty);

      // ── Position is flat — this fill opens a new one ──────────────────
      if (prevNet === 0) {
        acc = freshAccumulator();
        acc.firstFillId = fill.id;
        acc.openTime = fill.time;
        acc.direction = signedQty > 0 ? "long" : "short";
        acc.openingFills.push({ price, qty });
        acc.totalPnl += pnl;
        acc.totalCommission += commission;
        netQty = newNet;
        continue;
      }

      // ── Check for zero-crossing inversion ─────────────────────────────
      // prevNet and newNet have opposite signs → the fill both closes the
      // current position and opens a new one in the opposite direction.
      const crosses =
        (prevNet > 0 && newNet < 0) || (prevNet < 0 && newNet > 0);

      if (crosses) {
        const closingQty = Math.abs(prevNet);
        const remainderQty = round8(qty - closingQty);

        // Close current position with the closing portion
        acc.closingFills.push({ price, qty: closingQty });
        acc.totalPnl += pnl; // all realizedPnl → closing side
        acc.totalCommission += round8(commission * (closingQty / qty));
        acc.closeTime = fill.time;
        positions.push(emitPosition(acc, symbol, "closed"));

        // Open new position with the remainder
        acc = freshAccumulator();
        acc.firstFillId = fill.id;
        acc.openTime = fill.time;
        acc.direction = newNet > 0 ? "long" : "short";
        acc.openingFills.push({ price, qty: remainderQty });
        acc.totalPnl = 0; // opening portion has no realized PnL
        acc.totalCommission = round8(commission * (remainderQty / qty));
        netQty = newNet;
        continue;
      }

      // ── Regular fill: opening (increases |net|) or closing ────────────
      const isOpening = Math.abs(newNet) > Math.abs(prevNet);

      if (isOpening) {
        acc.openingFills.push({ price, qty });
      } else {
        acc.closingFills.push({ price, qty });
        acc.closeTime = fill.time;
      }

      acc.totalPnl += pnl;
      acc.totalCommission += commission;
      netQty = newNet;

      // Position closed
      if (newNet === 0) {
        positions.push(emitPosition(acc, symbol, "closed"));
        acc = freshAccumulator();
      }
    }

    // Still-open position at the end of fills
    if (netQty !== 0) {
      positions.push(emitPosition(acc, symbol, "open"));
    }
  }

  // Sort output chronologically for deterministic results
  positions.sort((a, b) => a.open_time.localeCompare(b.open_time));

  return positions;
}
