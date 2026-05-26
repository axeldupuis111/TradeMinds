import { describe, it, expect } from "vitest";
import {
  aggregateFills,
  type BinanceFill,
  type AggregatedPosition,
} from "./binance-aggregate";

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _fillId = 1000;

/** Build a BinanceFill with sensible defaults; only override what matters. */
function fill(partial: Partial<BinanceFill> & Pick<BinanceFill, "symbol" | "side" | "price" | "qty" | "time">): BinanceFill {
  return {
    id: _fillId++,
    realizedPnl: "0",
    commission: "0.05",
    orderId: 1,
    positionSide: "BOTH",
    ...partial,
  };
}

function resetIds() {
  _fillId = 1000;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("aggregateFills", () => {
  // ── 0. Edge case: empty input ───────────────────────────────────────────
  it("returns [] for empty fills array", () => {
    expect(aggregateFills([])).toEqual([]);
  });

  // ── 1. Simple long position: 1 open fill + 1 close fill ────────────────
  it("aggregates a simple long position (1 open + 1 close)", () => {
    resetIds();
    const fills: BinanceFill[] = [
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000, realizedPnl: "0", commission: "5" }),
      fill({ symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, realizedPnl: "1000", commission: "5.1" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    const pos = result[0];
    expect(pos.pair).toBe("BTCUSDT");
    expect(pos.direction).toBe("long");
    expect(pos.entry_price).toBe(50000);
    expect(pos.exit_price).toBe(51000);
    expect(pos.lot_size).toBe(1);
    expect(pos.open_time).toBe(new Date(1000000).toISOString());
    expect(pos.close_time).toBe(new Date(2000000).toISOString());
    expect(pos.pnl).toBe(1000);
    expect(pos.commission).toBe(10.1);
    expect(pos.status).toBe("closed");
    expect(pos.source).toBe("binance");
    expect(pos.external_id).toBe("1000"); // id of first fill
  });

  // ── 2. Simple short position ────────────────────────────────────────────
  it("aggregates a simple short position", () => {
    resetIds();
    const fills: BinanceFill[] = [
      fill({ symbol: "ETHUSDT", side: "SELL", price: "3000", qty: "10", time: 1000000, realizedPnl: "0", commission: "3" }),
      fill({ symbol: "ETHUSDT", side: "BUY", price: "2900", qty: "10", time: 2000000, realizedPnl: "1000", commission: "2.9" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("short");
    expect(result[0].entry_price).toBe(3000);
    expect(result[0].exit_price).toBe(2900);
    expect(result[0].lot_size).toBe(10);
    expect(result[0].pnl).toBe(1000);
  });

  // ── 3. Multi-fill position: VWAP correctness ───────────────────────────
  it("computes VWAP correctly for multi-fill open and close", () => {
    resetIds();
    const fills: BinanceFill[] = [
      // Open in 2 fills
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "0.5", time: 1000000, realizedPnl: "0", commission: "2.5" }),
      fill({ symbol: "BTCUSDT", side: "BUY", price: "51000", qty: "0.5", time: 1100000, realizedPnl: "0", commission: "2.55" }),
      // Close in 2 fills
      fill({ symbol: "BTCUSDT", side: "SELL", price: "52000", qty: "0.3", time: 2000000, realizedPnl: "450", commission: "1.56" }),
      fill({ symbol: "BTCUSDT", side: "SELL", price: "53000", qty: "0.7", time: 2100000, realizedPnl: "1400", commission: "3.71" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    const pos = result[0];
    // entry VWAP = (0.5*50000 + 0.5*51000) / 1.0 = 50500
    expect(pos.entry_price).toBe(50500);
    // exit VWAP = (0.3*52000 + 0.7*53000) / 1.0 = 52700
    expect(pos.exit_price).toBe(52700);
    expect(pos.lot_size).toBe(1);
    expect(pos.pnl).toBe(1850);
    expect(pos.commission).toBe(10.32);
    expect(pos.status).toBe("closed");
  });

  // ── 4. Position still open ──────────────────────────────────────────────
  it("marks a position as open when net qty never returns to 0", () => {
    resetIds();
    const fills: BinanceFill[] = [
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000, commission: "5" }),
      fill({ symbol: "BTCUSDT", side: "BUY", price: "49500", qty: "0.5", time: 1100000, commission: "2.475" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    const pos = result[0];
    expect(pos.status).toBe("open");
    expect(pos.exit_price).toBeNull();
    expect(pos.close_time).toBeNull();
    expect(pos.direction).toBe("long");
    // entry VWAP = (1*50000 + 0.5*49500) / 1.5 = 74750/1.5 = 49833.33333333
    expect(pos.entry_price).toBeCloseTo(49833.33333333, 4);
    expect(pos.lot_size).toBe(1.5);
  });

  // ── 5. Multiple successive positions on the same symbol ─────────────────
  it("produces distinct positions for successive trades on the same symbol", () => {
    resetIds();
    const fills: BinanceFill[] = [
      // Position 1: long
      fill({ id: 100, symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000, realizedPnl: "0" }),
      fill({ id: 101, symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, realizedPnl: "1000" }),
      // Position 2: short
      fill({ id: 200, symbol: "BTCUSDT", side: "SELL", price: "52000", qty: "2", time: 3000000, realizedPnl: "0" }),
      fill({ id: 201, symbol: "BTCUSDT", side: "BUY", price: "51500", qty: "2", time: 4000000, realizedPnl: "1000" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(2);

    expect(result[0].direction).toBe("long");
    expect(result[0].entry_price).toBe(50000);
    expect(result[0].exit_price).toBe(51000);
    expect(result[0].external_id).toBe("100");

    expect(result[1].direction).toBe("short");
    expect(result[1].entry_price).toBe(52000);
    expect(result[1].exit_price).toBe(51500);
    expect(result[1].external_id).toBe("200");
  });

  // ── 6. Multiple symbols handled independently ──────────────────────────
  it("groups fills by symbol independently", () => {
    resetIds();
    const fills: BinanceFill[] = [
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000 }),
      fill({ symbol: "ETHUSDT", side: "SELL", price: "3000", qty: "5", time: 1100000 }),
      fill({ symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, realizedPnl: "1000" }),
      fill({ symbol: "ETHUSDT", side: "BUY", price: "2900", qty: "5", time: 2100000, realizedPnl: "500" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(2);
    const btc = result.find((p) => p.pair === "BTCUSDT")!;
    const eth = result.find((p) => p.pair === "ETHUSDT")!;

    expect(btc.direction).toBe("long");
    expect(btc.entry_price).toBe(50000);
    expect(btc.exit_price).toBe(51000);

    expect(eth.direction).toBe("short");
    expect(eth.entry_price).toBe(3000);
    expect(eth.exit_price).toBe(2900);
  });

  // ── 7. Inversion: long → short without passing through 0 ──────────────
  it("handles inversion (long→short) by splitting the crossing fill", () => {
    resetIds();
    const fills: BinanceFill[] = [
      // Open long 5 BTC
      fill({ id: 500, symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "5", time: 1000000, realizedPnl: "0", commission: "25" }),
      // Sell 8 BTC → closes long 5, opens short 3
      fill({ id: 501, symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "8", time: 2000000, realizedPnl: "5000", commission: "40.8" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(2);

    // First position: closed long
    const long = result[0];
    expect(long.direction).toBe("long");
    expect(long.status).toBe("closed");
    expect(long.lot_size).toBe(5);
    expect(long.entry_price).toBe(50000);
    expect(long.exit_price).toBe(51000);
    expect(long.pnl).toBe(5000); // all realizedPnl goes to closing position
    // commission: 25 (open) + 40.8 * (5/8) = 25 + 25.5 = 50.5
    expect(long.commission).toBe(50.5);
    expect(long.external_id).toBe("500");

    // Second position: open short (remainder)
    const short = result[1];
    expect(short.direction).toBe("short");
    expect(short.status).toBe("open");
    expect(short.lot_size).toBe(3);
    expect(short.entry_price).toBe(51000);
    expect(short.exit_price).toBeNull();
    expect(short.pnl).toBe(0); // opening has no realized PnL
    // commission: 40.8 * (3/8) = 15.3
    expect(short.commission).toBe(15.3);
    expect(short.external_id).toBe("501"); // inverting fill's id
  });

  // ── 8. Inversion: short → long ────────────────────────────────────────
  it("handles inversion (short→long) correctly", () => {
    resetIds();
    const fills: BinanceFill[] = [
      fill({ id: 600, symbol: "ETHUSDT", side: "SELL", price: "3000", qty: "10", time: 1000000, realizedPnl: "0", commission: "3" }),
      fill({ id: 601, symbol: "ETHUSDT", side: "BUY", price: "2900", qty: "15", time: 2000000, realizedPnl: "1000", commission: "4.35" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(2);

    const short = result[0];
    expect(short.direction).toBe("short");
    expect(short.status).toBe("closed");
    expect(short.lot_size).toBe(10);
    expect(short.entry_price).toBe(3000);
    expect(short.exit_price).toBe(2900);
    expect(short.pnl).toBe(1000);

    const long = result[1];
    expect(long.direction).toBe("long");
    expect(long.status).toBe("open");
    expect(long.lot_size).toBe(5);
    expect(long.entry_price).toBe(2900);
  });

  // ── 9. Hedge mode: LONG and SHORT on same symbol are separate ─────────
  it("separates hedge-mode positions by positionSide", () => {
    resetIds();
    const fills: BinanceFill[] = [
      // Hedge long
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000, positionSide: "LONG" }),
      // Hedge short (same symbol, same time window)
      fill({ symbol: "BTCUSDT", side: "SELL", price: "50100", qty: "1", time: 1100000, positionSide: "SHORT" }),
      // Close both
      fill({ symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, positionSide: "LONG", realizedPnl: "1000" }),
      fill({ symbol: "BTCUSDT", side: "BUY", price: "49000", qty: "1", time: 2100000, positionSide: "SHORT", realizedPnl: "1100" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(2);

    const longPos = result.find((p) => p.direction === "long")!;
    expect(longPos.entry_price).toBe(50000);
    expect(longPos.exit_price).toBe(51000);
    expect(longPos.pnl).toBe(1000);
    expect(longPos.status).toBe("closed");

    const shortPos = result.find((p) => p.direction === "short")!;
    expect(shortPos.entry_price).toBe(50100);
    expect(shortPos.exit_price).toBe(49000);
    expect(shortPos.pnl).toBe(1100);
    expect(shortPos.status).toBe("closed");
  });

  // ── 10. external_id is stable and deterministic ────────────────────────
  it("uses the first fill id as external_id for deduplication", () => {
    const fills: BinanceFill[] = [
      fill({ id: 42, symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000 }),
      fill({ id: 43, symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, realizedPnl: "1000" }),
    ];

    const result = aggregateFills(fills);
    expect(result[0].external_id).toBe("42");

    // Running again produces the same id (deterministic)
    const result2 = aggregateFills(fills);
    expect(result2[0].external_id).toBe("42");
  });

  // ── 11. Fills arrive out of order — sorted by time internally ─────────
  it("sorts fills by time before processing", () => {
    const fills: BinanceFill[] = [
      // Intentionally reversed
      fill({ id: 2, symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "1", time: 2000000, realizedPnl: "1000" }),
      fill({ id: 1, symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "1", time: 1000000 }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("long"); // BUY first (earlier time)
    expect(result[0].entry_price).toBe(50000);
    expect(result[0].exit_price).toBe(51000);
    expect(result[0].external_id).toBe("1"); // first fill by time
  });

  // ── 12. Partial close then re-add then full close ─────────────────────
  it("handles partial close followed by scaling back in", () => {
    resetIds();
    const fills: BinanceFill[] = [
      // Open 10
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50000", qty: "10", time: 1000000 }),
      // Partial close 4
      fill({ symbol: "BTCUSDT", side: "SELL", price: "51000", qty: "4", time: 2000000, realizedPnl: "4000" }),
      // Scale back in 2 (net goes 6 → 8)
      fill({ symbol: "BTCUSDT", side: "BUY", price: "50500", qty: "2", time: 3000000 }),
      // Full close remaining 8
      fill({ symbol: "BTCUSDT", side: "SELL", price: "52000", qty: "8", time: 4000000, realizedPnl: "16000" }),
    ];

    const result = aggregateFills(fills);

    expect(result).toHaveLength(1);
    const pos = result[0];
    expect(pos.status).toBe("closed");
    // Opening fills: 10@50000 + 2@50500 → VWAP = (500000+101000)/12 = 50083.33333333
    expect(pos.lot_size).toBe(12);
    expect(pos.entry_price).toBeCloseTo(50083.33333333, 4);
    // Closing fills: 4@51000 + 8@52000 → VWAP = (204000+416000)/12 = 51666.66666667
    expect(pos.exit_price).toBeCloseTo(51666.66666667, 4);
    expect(pos.pnl).toBe(20000);
  });
});
