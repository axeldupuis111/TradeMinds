export interface ParsedTrade {
  open_time: string;
  close_time: string;
  pair: string;
  direction: "long" | "short";
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  commission: number | null;
  swap: number | null;
  pnl: number;
}

export interface ParseResult {
  trades: ParsedTrade[];
  accountNumber: string | null;
  /** true when mandatory columns couldn't be detected — UI should show mapping modal */
  needsMapping?: boolean;
  /** original column names from the file (for mapping UI) */
  rawHeaders?: string[];
  /** raw parsed rows keyed by original header (for mapping UI) */
  rawRows?: Record<string, string>[];
}

// ─── Number helpers ────────────────────────────────────────────────────────────

/** European formatting: "24 137,28" → 24137.28, "- 55,46" → -55.46 */
function parseEuropeanNumber(val: string | undefined): number | null {
  if (!val) return null;
  let s = val.trim().replace(/^-\s+/, "-");
  s = s.replace(/(\d)\s+(\d)/g, "$1$2");
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Standard format (dot decimal) */
function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function mapDirection(val: string): "long" | "short" {
  const v = val.trim().toLowerCase();
  if (v === "buy" || v === "long" || v === "buy/long" || v.includes("long")) return "long";
  return "short";
}

/** Strip everything except lowercase alphanumeric — used for fuzzy header matching */
function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Account number extraction ─────────────────────────────────────────────────

function extractAccountNumber(lines: string[]): string | null {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    const match = line.match(/^(?:Compte|Account)\s*[;:\t]\s*(.+)/i);
    if (match) {
      const raw = match[1].trim();
      const cleaned = raw.replace(/[^0-9].*$/, "").trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

// ─── MT5/FTMO parser (by column index, semicolon-delimited) ──────────────────

function tryParseMT5(lines: string[]): ParsedTrade[] {
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (trimmed === "positions") {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) { headerLineIndex = j; break; }
      }
      break;
    }
    if (trimmed.startsWith("heure;position;symbole")) { headerLineIndex = i; break; }
  }
  if (headerLineIndex === -1) return [];

  const COL = { OPEN_TIME: 0, TICKET: 1, SYMBOL: 2, TYPE: 3, VOLUME: 4, ENTRY_PRICE: 5, SL: 6, TP: 7, CLOSE_TIME: 8, EXIT_PRICE: 9, COMMISSION: 10, SWAP: 11, PROFIT: 12 };
  const trades: ParsedTrade[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    if (cols.length < 13) continue;
    const typeVal = (cols[COL.TYPE] || "").trim().toLowerCase();
    if (typeVal !== "buy" && typeVal !== "sell") continue;
    const pnl = parseEuropeanNumber(cols[COL.PROFIT]);
    if (pnl === null) continue;
    const lotSize = parseEuropeanNumber(cols[COL.VOLUME]) ?? 0;
    const entryPrice = parseEuropeanNumber(cols[COL.ENTRY_PRICE]) ?? 0;
    const exitPrice = parseEuropeanNumber(cols[COL.EXIT_PRICE]) ?? 0;
    if (lotSize <= 0 || entryPrice <= 0 || exitPrice <= 0) continue;
    trades.push({
      open_time: (cols[COL.OPEN_TIME] || "").trim(),
      close_time: (cols[COL.CLOSE_TIME] || "").trim(),
      pair: (cols[COL.SYMBOL] || "").trim().toUpperCase(),
      direction: mapDirection(typeVal),
      lot_size: lotSize,
      entry_price: entryPrice,
      exit_price: exitPrice,
      sl: parseEuropeanNumber(cols[COL.SL]),
      tp: parseEuropeanNumber(cols[COL.TP]),
      commission: parseEuropeanNumber(cols[COL.COMMISSION]),
      swap: parseEuropeanNumber(cols[COL.SWAP]),
      pnl,
    });
  }
  return trades;
}

// ─── Smart column detection ───────────────────────────────────────────────────

/** Priority-ordered pattern lists for each field (use norm() values) */
const DETECT_PATTERNS: Record<string, string[]> = {
  open_time: [
    "opentime", "openingtime", "opendate", "entrydate", "entrytime",
    "tradetime", "tradingdate", "datetime", "dateutc", "dateandtime",
    "createtime", "heure", "ouverture", "timestamp",
    "date",  // low-priority fallback
  ],
  close_time: [
    "closetime", "closingtime", "closedate", "exittime", "exitdate",
    "endtime", "fermeture", "closedatetime",
  ],
  pair: [
    "symbol", "pair", "instrument", "market", "symbole", "paire",
    "ticker", "currencypair", "tradingpair", "asset", "contract",
  ],
  direction: [
    "type", "side", "direction", "action", "ordertype", "tradetype",
    "signal", "buyorsell",
  ],
  lot_size: [
    "volume", "lot", "lots", "contracts", "quantity", "qty",
    "executed", "shares", "size",
    "amount",  // low-priority (crypto uses this for base qty)
  ],
  entry_price: [
    "openprice", "openingprice", "entryprice", "avgentryprice",
    "startprice", "buyprice",
    "price",  // low-priority fallback
  ],
  exit_price: [
    "closeprice", "closingprice", "exitprice", "endprice", "sellprice",
  ],
  pnl: [
    "realizedpnl", "realizedprofit", "closedpnl", "netprofit",
    "profit", "pnl", "pl", "gainloss", "result",
  ],
  sl: ["stoploss", "sl"],
  tp: ["takeprofit", "tp", "target"],
  commission: ["commission", "fee", "fees", "tradingfee", "frais"],
  swap: ["swap", "rollover", "financing"],
};

interface ColumnMap {
  open_time: number;
  close_time: number;
  pair: number;
  direction: number;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  sl: number;
  tp: number;
  commission: number;
  swap: number;
}

function detectColumns(headers: string[]): ColumnMap {
  const normalized = headers.map(norm);
  const found: Partial<ColumnMap> = {};
  const used = new Set<number>();

  for (const field of Object.keys(DETECT_PATTERNS)) {
    for (const pattern of DETECT_PATTERNS[field]) {
      const idx = normalized.findIndex((h, i) => h === pattern && !used.has(i));
      if (idx !== -1) {
        (found as Record<string, number>)[field] = idx;
        used.add(idx);
        break;
      }
    }
  }

  return {
    open_time: found.open_time ?? -1,
    close_time: found.close_time ?? -1,
    pair: found.pair ?? -1,
    direction: found.direction ?? -1,
    lot_size: found.lot_size ?? -1,
    entry_price: found.entry_price ?? -1,
    exit_price: found.exit_price ?? -1,
    pnl: found.pnl ?? -1,
    sl: found.sl ?? -1,
    tp: found.tp ?? -1,
    commission: found.commission ?? -1,
    swap: found.swap ?? -1,
  };
}

// ─── cTrader parser ────────────────────────────────────────────────────────────

function tryParsecTrader(headers: string[], rows: Record<string, string>[]): ParsedTrade[] | null {
  const normalizedHeaders = headers.map(norm);
  const hasCtrader =
    normalizedHeaders.includes("positionid") ||
    (normalizedHeaders.includes("openingtime") && normalizedHeaders.includes("closingtime") && normalizedHeaders.includes("grossprofit"));
  if (!hasCtrader) return null;

  const cm = detectColumns(headers);
  if (cm.pair === -1 || cm.pnl === -1) return null;

  const netPnlCol = headers.findIndex((h) => norm(h) === "netprofit");
  const grossPnlCol = headers.findIndex((h) => norm(h) === "grossprofit");
  const pnlIdx = netPnlCol !== -1 ? netPnlCol : (grossPnlCol !== -1 ? grossPnlCol : cm.pnl);

  return rows.map((row): ParsedTrade | null => {
    const dirVal = cm.direction !== -1 ? row[headers[cm.direction]] : "";
    if (!dirVal) return null;
    const dir = dirVal.trim().toLowerCase();
    if (dir !== "buy" && dir !== "sell" && dir !== "long" && dir !== "short") return null;
    const pnl = parseNumber(row[headers[pnlIdx]]);
    if (pnl === null) return null;
    const lot = cm.lot_size !== -1 ? parseNumber(row[headers[cm.lot_size]]) : null;
    const entry = cm.entry_price !== -1 ? parseNumber(row[headers[cm.entry_price]]) : null;
    const exit = cm.exit_price !== -1 ? parseNumber(row[headers[cm.exit_price]]) : null;
    if ((entry !== null && entry <= 0) || (exit !== null && exit <= 0)) return null;
    return {
      open_time: cm.open_time !== -1 ? (row[headers[cm.open_time]] || "") : "",
      close_time: cm.close_time !== -1 ? (row[headers[cm.close_time]] || "") : "",
      pair: (row[headers[cm.pair]] || "").toUpperCase(),
      direction: mapDirection(dir),
      lot_size: lot ?? 0,
      entry_price: entry ?? 0,
      exit_price: exit ?? 0,
      sl: cm.sl !== -1 ? parseNumber(row[headers[cm.sl]]) : null,
      tp: cm.tp !== -1 ? parseNumber(row[headers[cm.tp]]) : null,
      commission: cm.commission !== -1 ? parseNumber(row[headers[cm.commission]]) : null,
      swap: cm.swap !== -1 ? parseNumber(row[headers[cm.swap]]) : null,
      pnl,
    };
  }).filter((t): t is ParsedTrade => t !== null);
}

// ─── TradingView parser (entry+exit rows paired by Trade #) ──────────────────

function tryParseTradingView(headers: string[], rows: Record<string, string>[]): ParsedTrade[] | null {
  const normalizedHeaders = headers.map(norm);
  const hasTVType =
    normalizedHeaders.includes("type") &&
    (normalizedHeaders.includes("trade") || normalizedHeaders.includes("tradeno") || normalizedHeaders.includes("tradenumber"));
  if (!hasTVType) return null;

  // Check that "type" column contains Entry/Exit values
  const typeCol = headers[normalizedHeaders.indexOf("type")];
  const sampleType = rows[0]?.[typeCol]?.toLowerCase() || "";
  if (!sampleType.includes("entry") && !sampleType.includes("exit")) return null;

  const tradeNumCol = headers.find((h) => ["trade", "trade#", "tradenumber", "tradeno"].includes(norm(h))) || "";
  const symbolCol = headers.find((h) => norm(h) === "symbol") || "";
  const priceCol = headers.find((h) => norm(h) === "price") || "";
  const contractsCol = headers.find((h) => ["contracts", "qty", "quantity", "size", "lot", "lots"].includes(norm(h))) || "";
  const profitCol = headers.find((h) => norm(h) === "profit") || "";

  // Group rows by trade number
  const byTrade: Record<string, Record<string, string>[]> = {};
  for (const row of rows) {
    const num = row[tradeNumCol]?.trim() || "";
    if (!num) continue;
    byTrade[num] = byTrade[num] || [];
    byTrade[num].push(row);
  }

  const trades: ParsedTrade[] = [];
  for (const [, tradeRows] of Object.entries(byTrade)) {
    const entryRow = tradeRows.find((r) => (r[typeCol] || "").toLowerCase().includes("entry"));
    const exitRow = tradeRows.find((r) => (r[typeCol] || "").toLowerCase().includes("exit"));
    if (!entryRow || !exitRow) continue;

    const entryType = entryRow[typeCol]?.toLowerCase() || "";
    const dir = entryType.includes("long") ? "long" : "short";
    const pnl = parseNumber(exitRow[profitCol]);
    if (pnl === null) continue;

    trades.push({
      open_time: entryRow[headers.find((h) => norm(h) === "datetime" || norm(h) === "date") || ""] || "",
      close_time: exitRow[headers.find((h) => norm(h) === "datetime" || norm(h) === "date") || ""] || "",
      pair: (entryRow[symbolCol] || "").toUpperCase(),
      direction: dir,
      lot_size: parseNumber(entryRow[contractsCol]) ?? 0,
      entry_price: parseNumber(entryRow[priceCol]) ?? 0,
      exit_price: parseNumber(exitRow[priceCol]) ?? 0,
      sl: null,
      tp: null,
      commission: null,
      swap: null,
      pnl,
    });
  }
  return trades.length > 0 ? trades : null;
}

// ─── Generic fuzzy parser ─────────────────────────────────────────────────────

function parseWithColumnMap(
  cm: ColumnMap,
  headers: string[],
  rows: Record<string, string>[]
): ParsedTrade[] {
  return rows.map((row): ParsedTrade | null => {
    const pairRaw = cm.pair !== -1 ? row[headers[cm.pair]] : "";
    if (!pairRaw) return null;

    const pnl = cm.pnl !== -1 ? parseNumber(row[headers[cm.pnl]]) : null;
    if (pnl === null) return null;

    const dirRaw = cm.direction !== -1 ? (row[headers[cm.direction]] || "long") : "long";
    const dir = dirRaw.trim().toLowerCase();
    if (dir !== "buy" && dir !== "sell" && dir !== "long" && dir !== "short") {
      // Skip non-trade rows (headers, balance lines, etc.)
      return null;
    }

    return {
      open_time: cm.open_time !== -1 ? (row[headers[cm.open_time]] || "") : "",
      close_time: cm.close_time !== -1 ? (row[headers[cm.close_time]] || "") : "",
      pair: pairRaw.trim().toUpperCase().replace("/", ""),
      direction: mapDirection(dirRaw),
      lot_size: cm.lot_size !== -1 ? (parseNumber(row[headers[cm.lot_size]]) ?? 0) : 0,
      entry_price: cm.entry_price !== -1 ? (parseNumber(row[headers[cm.entry_price]]) ?? 0) : 0,
      exit_price: cm.exit_price !== -1 ? (parseNumber(row[headers[cm.exit_price]]) ?? 0) : 0,
      sl: cm.sl !== -1 ? parseNumber(row[headers[cm.sl]]) : null,
      tp: cm.tp !== -1 ? parseNumber(row[headers[cm.tp]]) : null,
      commission: cm.commission !== -1 ? parseNumber(row[headers[cm.commission]]) : null,
      swap: cm.swap !== -1 ? parseNumber(row[headers[cm.swap]]) : null,
      pnl,
    };
  }).filter((t): t is ParsedTrade => t !== null);
}

// ─── MT4 header-based parser ──────────────────────────────────────────────────

function parseMTRow(row: Record<string, string>): ParsedTrade | null {
  const typeVal = row["type"] || "";
  if (!typeVal) return null;
  const dir = typeVal.trim().toLowerCase();
  if (dir !== "buy" && dir !== "sell") return null;
  const pnl = parseNumber(row["profit"]);
  if (pnl === null) return null;
  return {
    open_time: row["open_time"] || "",
    close_time: row["close_time"] || "",
    pair: (row["symbol"] || "").toUpperCase(),
    direction: mapDirection(typeVal),
    lot_size: parseNumber(row["size"] || row["volume"]) ?? 0,
    entry_price: parseNumber(row["price"] || row["open_price"]) ?? 0,
    exit_price: parseNumber(row["close_price"]) ?? 0,
    sl: parseNumber(row["s_l"] || row["sl"]),
    tp: parseNumber(row["t_p"] || row["tp"]),
    commission: parseNumber(row["commission"]),
    swap: parseNumber(row["swap"]),
    pnl,
  };
}

function parseSimpleRow(row: Record<string, string>): ParsedTrade | null {
  const pnl = parseNumber(row["pnl"]);
  if (pnl === null) return null;
  return {
    open_time: row["date"] || "",
    close_time: row["date"] || "",
    pair: (row["pair"] || row["symbol"] || "").toUpperCase(),
    direction: mapDirection(row["direction"] || "long"),
    lot_size: parseNumber(row["lot"] || row["size"]) ?? 0,
    entry_price: parseNumber(row["entry"]) ?? 0,
    exit_price: parseNumber(row["exit"]) ?? 0,
    sl: parseNumber(row["sl"]),
    tp: parseNumber(row["tp"]),
    commission: null,
    swap: null,
    pnl,
  };
}

// ─── Generic CSV/XLSX parser ──────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function parseGeneric(lines: string[]): { trades: ParsedTrade[]; needsMapping?: boolean; rawHeaders?: string[]; rawRows?: Record<string, string>[] } {
  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  if (filtered.length < 2) return { trades: [] };

  const delimiter = filtered[0].includes("\t") ? "\t" : filtered[0].includes(";") ? ";" : ",";
  const rawHeaders = filtered[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const headers = rawHeaders.map(normalizeHeader);

  const rawRows: Record<string, string>[] = filtered.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, i) => { row[h] = (values[i] || "").trim().replace(/^["']|["']$/g, ""); });
    return row;
  });

  const normalizedRows: Record<string, string>[] = filtered.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] || "").trim().replace(/^["']|["']$/g, ""); });
    return row;
  });

  // 1. Try MT4 header-based format
  const isMT4 = headers.some((h) => h === "ticket" || h === "open_time" || h === "open_price");
  if (isMT4) {
    const trades = normalizedRows.map((row) => parseMTRow(row)).filter((t): t is ParsedTrade => t !== null);
    if (trades.length > 0) return { trades };
  }

  // 2. Try cTrader format
  const ctraderResult = tryParsecTrader(rawHeaders, rawRows);
  if (ctraderResult && ctraderResult.length > 0) return { trades: ctraderResult };

  // 3. Try TradingView format
  const tvResult = tryParseTradingView(rawHeaders, rawRows);
  if (tvResult && tvResult.length > 0) return { trades: tvResult };

  // 4. Try simple TradeDiscipline template format
  const isSimple = headers.some((h) => h === "pnl");
  if (isSimple) {
    const trades = normalizedRows.map((row) => parseSimpleRow(row)).filter((t): t is ParsedTrade => t !== null);
    if (trades.length > 0) return { trades };
  }

  // 5. Fuzzy column detection (Binance, Bybit, OKX, generic)
  const cm = detectColumns(rawHeaders);
  if (cm.pair !== -1 && cm.pnl !== -1) {
    const trades = parseWithColumnMap(cm, rawHeaders, rawRows);
    if (trades.length > 0) return { trades };
  }

  // 6. Mandatory columns not found — request manual mapping
  return { trades: [], needsMapping: true, rawHeaders, rawRows };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const accountNumber = extractAccountNumber(lines);

  const mt5Result = tryParseMT5(lines);
  if (mt5Result.length > 0) return { trades: mt5Result, accountNumber };

  const generic = parseGeneric(lines);
  return { ...generic, accountNumber };
}

/**
 * Parse an XLSX file (MT5, cTrader, Binance, generic).
 * Each sheet row is flattened to a semicolon-delimited line.
 */
export async function parseXlsx(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { trades: [], accountNumber: null };
  const sheet = wb.Sheets[firstSheetName];

  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false }) as string[][];
  const lines = rows.map((r) => r.map((c) => (c == null ? "" : String(c))).join(";"));

  const accountNumber = extractAccountNumber(lines);
  const mt5Result = tryParseMT5(lines);
  if (mt5Result.length > 0) return { trades: mt5Result, accountNumber };

  // For XLSX, also re-parse as generic CSV treating ; as delimiter
  const csvText = lines.join("\n");
  const generic = parseGeneric(csvText.split("\n"));
  return { ...generic, accountNumber };
}

/**
 * Apply a manual column mapping chosen by the user in the mapping UI.
 * `columnMap` maps TradeDiscipline field names to original CSV header names.
 */
export function applyManualMapping(
  rawHeaders: string[],
  rawRows: Record<string, string>[],
  columnMap: Partial<Record<keyof ColumnMap, string>>
): ParsedTrade[] {
  const toIdx = (field: keyof ColumnMap): number => {
    const header = columnMap[field];
    return header ? rawHeaders.indexOf(header) : -1;
  };

  const cm: ColumnMap = {
    open_time: toIdx("open_time"),
    close_time: toIdx("close_time"),
    pair: toIdx("pair"),
    direction: toIdx("direction"),
    lot_size: toIdx("lot_size"),
    entry_price: toIdx("entry_price"),
    exit_price: toIdx("exit_price"),
    pnl: toIdx("pnl"),
    sl: toIdx("sl"),
    tp: toIdx("tp"),
    commission: toIdx("commission"),
    swap: toIdx("swap"),
  };

  return parseWithColumnMap(cm, rawHeaders, rawRows);
}
