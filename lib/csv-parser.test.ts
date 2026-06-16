import { describe, it, expect } from "vitest";
import { parseCSV, applyManualMapping } from "./csv-parser";

describe("parseCSV — MT5 / FTMO (semicolon, by column index)", () => {
  const csv = [
    "Compte;531066904",
    "",
    "heure;position;symbole;type;volume;prix;sl;tp;heure;prix;commission;swap;profit",
    "2026.06.10 08:00:00;101;EURUSD;buy;1,00;1,10000;1,09000;1,12000;2026.06.10 10:00:00;1,10500;-5,00;-1,20;50,00",
    "2026.06.10 11:00:00;102;XAUUSD;sell;0,50;2000,00;2010,00;1980,00;2026.06.10 12:00:00;1995,00;- 7,00;0,00;1 234,56",
    "2026.06.10 13:00:00;103;;balance;0;0;0;0;;0;0;0;100,00",
  ].join("\n");

  const result = parseCSV(csv);

  it("extracts the account number from the header block", () => {
    expect(result.accountNumber).toBe("531066904");
  });

  it("keeps only buy/sell rows (skips the balance line)", () => {
    expect(result.trades).toHaveLength(2);
  });

  it("maps the first trade by column index with European numbers", () => {
    expect(result.trades[0]).toEqual({
      open_time: "2026.06.10 08:00:00",
      close_time: "2026.06.10 10:00:00",
      pair: "EURUSD",
      direction: "long",
      lot_size: 1,
      entry_price: 1.1,
      exit_price: 1.105,
      sl: 1.09,
      tp: 1.12,
      commission: -5,
      swap: -1.2,
      pnl: 50,
    });
  });

  it("parses European spaces/sign quirks ('1 234,56', '- 7,00')", () => {
    const xau = result.trades[1];
    expect(xau.pair).toBe("XAUUSD");
    expect(xau.direction).toBe("short");
    expect(xau.pnl).toBeCloseTo(1234.56);
    expect(xau.commission).toBe(-7);
  });
});

describe("parseCSV — MT4 (header-based, comma-delimited)", () => {
  const csv = [
    "Ticket,Open Time,Close Time,Symbol,Type,Size,Open Price,Close Price,S / L,T / P,Commission,Swap,Profit",
    "123,2026.06.10 08:00,2026.06.10 10:00,EURUSD,buy,1.0,1.1000,1.1050,1.0900,1.1200,-5,-1.2,50",
  ].join("\n");

  it("maps header names (incl. 'S / L' → sl) into a trade", () => {
    const { trades } = parseCSV(csv);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      pair: "EURUSD",
      direction: "long",
      lot_size: 1,
      entry_price: 1.1,
      exit_price: 1.105,
      sl: 1.09,
      tp: 1.12,
      pnl: 50,
    });
  });
});

describe("parseCSV — cTrader (prefers Net Profit over Gross Profit)", () => {
  const csv = [
    "Position ID,Symbol,Direction,Volume,Opening Time,Closing Time,Entry Price,Closing Price,Gross Profit,Net Profit",
    "111,EURUSD,Buy,1.0,2026-06-10 08:00,2026-06-10 10:00,1.1000,1.1050,55.00,50.00",
  ].join("\n");

  it("uses the net P&L column, not gross", () => {
    const { trades } = parseCSV(csv);
    expect(trades).toHaveLength(1);
    expect(trades[0].pnl).toBe(50);
    expect(trades[0].pair).toBe("EURUSD");
    expect(trades[0].direction).toBe("long");
  });
});

describe("parseCSV — simple TradeDiscipline template", () => {
  const csv = [
    "date,pair,direction,lot,entry,exit,sl,tp,pnl",
    "2026-06-10,EURUSD,long,1,1.1,1.105,1.09,1.12,50",
  ].join("\n");

  it("parses the template format", () => {
    const { trades } = parseCSV(csv);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ pair: "EURUSD", direction: "long", pnl: 50 });
  });
});

describe("parseCSV — fuzzy detection (exchange exports)", () => {
  const csv = [
    "Symbol,Side,Quantity,Entry Price,Close Price,Realized PnL",
    "BTCUSDT,Buy,0.5,60000,60500,250",
  ].join("\n");

  it("detects pair + pnl columns from a Binance-like export", () => {
    const { trades } = parseCSV(csv);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      pair: "BTCUSDT",
      direction: "long",
      lot_size: 0.5,
      pnl: 250,
    });
  });
});

describe("parseCSV — unknown layout asks for manual mapping", () => {
  const csv = ["Foo,Bar,Baz", "1,2,3"].join("\n");

  it("returns needsMapping with the raw headers/rows for the mapping UI", () => {
    const result = parseCSV(csv);
    expect(result.trades).toHaveLength(0);
    expect(result.needsMapping).toBe(true);
    expect(result.rawHeaders).toEqual(["Foo", "Bar", "Baz"]);
    expect(result.rawRows).toEqual([{ Foo: "1", Bar: "2", Baz: "3" }]);
  });
});

describe("applyManualMapping — user-chosen column mapping", () => {
  it("builds trades from arbitrary headers via the mapping", () => {
    const rawHeaders = ["Inst", "Result", "Vol", "Way", "In", "Out"];
    const rawRows = [
      { Inst: "GBPUSD", Result: "75.5", Vol: "2", Way: "sell", In: "1.27", Out: "1.265" },
    ];
    const trades = applyManualMapping(rawHeaders, rawRows, {
      pair: "Inst",
      pnl: "Result",
      lot_size: "Vol",
      direction: "Way",
      entry_price: "In",
      exit_price: "Out",
    });
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      pair: "GBPUSD",
      direction: "short",
      lot_size: 2,
      entry_price: 1.27,
      exit_price: 1.265,
      pnl: 75.5,
      sl: null,
      tp: null,
    });
  });
});
