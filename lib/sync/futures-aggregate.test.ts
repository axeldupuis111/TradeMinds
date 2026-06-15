import { describe, it, expect } from "vitest";
import { aggregateFuturesFills, type FuturesFill } from "./futures-aggregate";

// ES (E-mini S&P 500) point value = $50 per full point per contract.
const ES = 50;

let _id = 1;
function fill(
  partial: Partial<FuturesFill> & Pick<FuturesFill, "symbol" | "side" | "price" | "qty" | "time">,
): FuturesFill {
  return { id: _id++, pointValue: ES, ...partial };
}
function reset() {
  _id = 1;
}

describe("aggregateFuturesFills", () => {
  it("returns [] for empty input", () => {
    expect(aggregateFuturesFills([])).toEqual([]);
  });

  it("simple long: 2 ES from 4500 → 4510 = +1000", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 2, time: 1000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 2, time: 2000 }),
    ]);
    expect(res).toHaveLength(1);
    const p = res[0];
    expect(p.direction).toBe("long");
    expect(p.entry_price).toBe(4500);
    expect(p.exit_price).toBe(4510);
    expect(p.lot_size).toBe(2);
    expect(p.pnl).toBe(1000); // (4510-4500)*2*50
    expect(p.status).toBe("closed");
    expect(p.source).toBe("tradovate");
    expect(p.external_id).toBe("1");
    expect(p.open_time).toBe(new Date(1000).toISOString());
    expect(p.close_time).toBe(new Date(2000).toISOString());
  });

  it("simple short: 1 ES from 4510 → 4500 = +500", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 1, time: 1000 }),
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 1, time: 2000 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].direction).toBe("short");
    expect(res[0].pnl).toBe(500); // (4500-4510)*-1*1*50
  });

  it("losing long is negative", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 1, time: 1000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4490, qty: 1, time: 2000 }),
    ]);
    expect(res[0].pnl).toBe(-500); // (4490-4500)*1*1*50
  });

  it("scale-in averages the entry price", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 1, time: 1000 }),
      fill({ symbol: "ESM6", side: "Buy", price: 4520, qty: 1, time: 1500 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4530, qty: 2, time: 2000 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].entry_price).toBe(4510); // avg(4500,4520)
    expect(res[0].lot_size).toBe(2);
    expect(res[0].pnl).toBe(2000); // (4530-4510)*2*50
  });

  it("scale-out (multiple closing fills) accrues P&L and VWAPs the exit", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 3, time: 1000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 1, time: 2000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4520, qty: 2, time: 3000 }),
    ]);
    expect(res).toHaveLength(1);
    const p = res[0];
    expect(p.pnl).toBe(2500); // 500 + 2000
    expect(p.lot_size).toBe(3);
    expect(p.exit_price).toBeCloseTo((4510 * 1 + 4520 * 2) / 3, 4);
    expect(p.status).toBe("closed");
  });

  it("over-close inverts: closes the long, opens a new short with the remainder", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 2, time: 1000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 3, time: 2000 }),
    ]);
    expect(res).toHaveLength(2);
    const [closed, open] = res;
    expect(closed.direction).toBe("long");
    expect(closed.status).toBe("closed");
    expect(closed.pnl).toBe(1000); // (4510-4500)*2*50
    expect(closed.lot_size).toBe(2);
    expect(open.direction).toBe("short");
    expect(open.status).toBe("open");
    expect(open.entry_price).toBe(4510);
    expect(open.lot_size).toBe(1);
    expect(open.pnl).toBe(0); // opening realizes nothing
  });

  it("leaves an unfinished position open with realized partial P&L", () => {
    reset();
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 3, time: 1000 }),
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 1, time: 2000 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("open");
    expect(res[0].close_time).toBeNull();
    expect(res[0].pnl).toBe(500); // partial close realized
  });

  it("keeps different symbols independent and uses each fill's pointValue", () => {
    reset();
    const NQ = 20; // Nasdaq E-mini = $20/point
    const res = aggregateFuturesFills([
      fill({ symbol: "ESM6", side: "Buy", price: 4500, qty: 1, time: 1000, pointValue: ES }),
      fill({ symbol: "NQM6", side: "Buy", price: 15000, qty: 1, time: 1100, pointValue: NQ }),
      fill({ symbol: "ESM6", side: "Sell", price: 4510, qty: 1, time: 2000, pointValue: ES }),
      fill({ symbol: "NQM6", side: "Sell", price: 15010, qty: 1, time: 2100, pointValue: NQ }),
    ]);
    expect(res).toHaveLength(2);
    const es = res.find((p) => p.pair === "ESM6")!;
    const nq = res.find((p) => p.pair === "NQM6")!;
    expect(es.pnl).toBe(500); // 10 * 1 * 50
    expect(nq.pnl).toBe(200); // 10 * 1 * 20
  });
});
