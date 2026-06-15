// Aggregate raw futures fills (Tradovate today) into complete round-turn
// positions ready for the `trades` table. Unlike crypto exchanges, futures
// APIs rarely return per-trade realized P&L, so we compute it from price
// deltas × the contract's point value using the average-cost method.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FuturesFill {
  id: number; // stable, unique fill id from the broker
  symbol: string; // human contract name, e.g. "ESM6"
  side: "Buy" | "Sell";
  qty: number; // contracts
  price: number;
  time: number; // Unix ms
  /** Account-currency value of a 1.0 price move for ONE contract. */
  pointValue: number;
}

export interface AggregatedFuturesPosition {
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number | null;
  lot_size: number; // total contracts of the position
  open_time: string; // ISO 8601
  close_time: string | null;
  pnl: number; // realized P&L in account currency (gross of commission)
  status: "open" | "closed";
  source: "tradovate";
  external_id: string; // String(first fill id) — stable across syncs
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

interface Accumulator {
  netQty: number; // signed: + long, - short
  avgEntry: number; // average entry price of the currently open quantity
  openQty: number; // total contracts that opened the position (for lot_size)
  realizedPnl: number;
  firstFillId: number;
  openTime: number;
  closeTime: number | null;
  pointValue: number;
}

function fresh(): Accumulator {
  return {
    netQty: 0,
    avgEntry: 0,
    openQty: 0,
    realizedPnl: 0,
    firstFillId: 0,
    openTime: 0,
    closeTime: null,
    pointValue: 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Aggregate fills into round-turn positions using average-cost netting.
 *
 * A position opens when net quantity leaves 0 and closes when it returns to 0.
 * Realized P&L is accrued on every closing fill:
 *   pnl += (closePrice − avgEntry) × directionSign × closedQty × pointValue
 * An over-closing fill (qty greater than the open net) closes the current
 * position and opens a new one in the opposite direction with the remainder.
 */
export function aggregateFuturesFills(fills: FuturesFill[]): AggregatedFuturesPosition[] {
  if (fills.length === 0) return [];

  const sorted = [...fills].sort((a, b) => a.time - b.time || a.id - b.id);

  // Group by symbol.
  const groups = new Map<string, FuturesFill[]>();
  for (const f of sorted) {
    let g = groups.get(f.symbol);
    if (!g) {
      g = [];
      groups.set(f.symbol, g);
    }
    g.push(f);
  }

  const positions: AggregatedFuturesPosition[] = [];

  for (const groupFills of Array.from(groups.values())) {
    const symbol = groupFills[0].symbol;
    let acc = fresh();
    let entryDirection: "long" | "short" = "long";
    let exitPriceAccum: { notional: number; qty: number } = { notional: 0, qty: 0 };

    const finalize = (status: "open" | "closed") => {
      const pos: AggregatedFuturesPosition = {
        pair: symbol,
        direction: entryDirection,
        entry_price: round5(acc.avgEntry),
        exit_price: exitPriceAccum.qty > 0 ? round5(exitPriceAccum.notional / exitPriceAccum.qty) : null,
        lot_size: acc.openQty,
        open_time: new Date(acc.openTime).toISOString(),
        close_time: status === "closed" && acc.closeTime ? new Date(acc.closeTime).toISOString() : null,
        pnl: round2(acc.realizedPnl),
        status,
        source: "tradovate",
        external_id: String(acc.firstFillId),
      };
      positions.push(pos);
    };

    for (const f of groupFills) {
      const signed = f.side === "Buy" ? f.qty : -f.qty;
      const prevNet = acc.netQty;

      // ── Flat → this fill opens a new position ────────────────────────────
      if (prevNet === 0) {
        acc = fresh();
        acc.firstFillId = f.id;
        acc.openTime = f.time;
        acc.pointValue = f.pointValue;
        acc.netQty = signed;
        acc.avgEntry = f.price;
        acc.openQty = f.qty;
        entryDirection = signed > 0 ? "long" : "short";
        exitPriceAccum = { notional: 0, qty: 0 };
        continue;
      }

      const sameDirection = (prevNet > 0 && signed > 0) || (prevNet < 0 && signed < 0);

      if (sameDirection) {
        // Scale into the position → weighted-average the entry price.
        const totalQty = Math.abs(prevNet) + f.qty;
        acc.avgEntry = (acc.avgEntry * Math.abs(prevNet) + f.price * f.qty) / totalQty;
        acc.netQty = prevNet + signed;
        acc.openQty += f.qty;
        continue;
      }

      // ── Opposite direction → closing (and maybe inverting) ───────────────
      const dirSign = prevNet > 0 ? 1 : -1;
      const closeQty = Math.min(Math.abs(prevNet), f.qty);

      acc.realizedPnl += (f.price - acc.avgEntry) * dirSign * closeQty * acc.pointValue;
      exitPriceAccum.notional += f.price * closeQty;
      exitPriceAccum.qty += closeQty;
      acc.netQty = prevNet + signed;

      if (acc.netQty === 0) {
        // Fully closed.
        acc.closeTime = f.time;
        finalize("closed");
        acc = fresh();
        exitPriceAccum = { notional: 0, qty: 0 };
      } else if ((prevNet > 0 && acc.netQty < 0) || (prevNet < 0 && acc.netQty > 0)) {
        // Over-close → previous position closed, remainder opens the opposite.
        acc.closeTime = f.time;
        finalize("closed");
        const remainder = f.qty - closeQty;
        acc = fresh();
        acc.firstFillId = f.id;
        acc.openTime = f.time;
        acc.pointValue = f.pointValue;
        acc.netQty = signed > 0 ? remainder : -remainder;
        acc.avgEntry = f.price;
        acc.openQty = remainder;
        entryDirection = acc.netQty > 0 ? "long" : "short";
        exitPriceAccum = { notional: 0, qty: 0 };
      }
      // else: partial close, position still open — keep accumulating.
    }

    // Still-open position at the end.
    if (acc.netQty !== 0) {
      finalize("open");
    }
  }

  positions.sort((a, b) => a.open_time.localeCompare(b.open_time));
  return positions;
}
