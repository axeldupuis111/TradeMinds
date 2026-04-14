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

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Parse a number that may use European formatting: spaces for thousands, comma for decimal */
function parseEuropeanNumber(val: string | undefined): number | null {
  if (!val) return null;
  // Normalize: "- 55,46" → "-55.46", "24 137,28" → "24137.28"
  let s = val.trim();
  // Handle spaced negative sign: "- 55,46"
  s = s.replace(/^-\s+/, "-");
  // Remove thousand separators (spaces between digits)
  s = s.replace(/(\d)\s+(\d)/g, "$1$2");
  // Replace decimal comma with dot
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Parse a number in standard format (dot decimal, no special formatting) */
function parseNumber(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function mapDirection(val: string): "long" | "short" {
  const v = val.trim().toLowerCase();
  if (v === "buy" || v === "long") return "long";
  return "short";
}

export interface ParseResult {
  trades: ParsedTrade[];
  accountNumber: string | null;
}

/** Extract account number from MT5 CSV metadata header */
function extractAccountNumber(lines: string[]): string | null {
  // Look for "Compte:" or "Account:" in the first ~20 lines
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    // French: "Compte:	1512882131 (EUR, FTMO-Demo)" or "Compte;1512882131"
    // English: "Account:	1512882131" or "Account;1512882131"
    const match = line.match(/^(?:Compte|Account)\s*[;:\t]\s*(.+)/i);
    if (match) {
      // Clean: keep only digits before first space, parenthesis, or comma
      const raw = match[1].trim();
      const cleaned = raw.replace(/[^0-9].*$/, "").trim();
      console.log("[csv-parser] Raw account value:", JSON.stringify(raw), "→ cleaned:", JSON.stringify(cleaned));
      if (cleaned) return cleaned;
    }
  }
  return null;
}

export function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const accountNumber = extractAccountNumber(lines);

  // Try MT5/FTMO format first
  const mt5Result = tryParseMT5(lines);
  if (mt5Result.length > 0) return { trades: mt5Result, accountNumber };

  // Fallback to generic format
  return { trades: parseGeneric(lines), accountNumber };
}

/**
 * Parse an MT5 xlsx export (exported via "Report > Open XML (MS Office Excel 2007)").
 * The .xlsx has the same structure as the CSV: metadata rows, then a "Positions"
 * header row, then the trade rows. We flatten each row to a semicolon-delimited
 * line so the existing MT5 parser handles it verbatim.
 */
export async function parseXlsx(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { trades: [], accountNumber: null };
  const sheet = wb.Sheets[firstSheetName];

  // Get the full grid as arrays of strings. defval:"" keeps empty cells so
  // column indexes align with the CSV layout.
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as string[][];

  // Flatten each row into a ";"-joined line, matching the MT5 CSV format.
  const lines = rows.map((r) => r.map((c) => (c == null ? "" : String(c))).join(";"));

  const accountNumber = extractAccountNumber(lines);
  const mt5Result = tryParseMT5(lines);
  if (mt5Result.length > 0) return { trades: mt5Result, accountNumber };
  return { trades: parseGeneric(lines), accountNumber };
}

/**
 * MT5/FTMO format:
 * - Metadata lines before "Positions" marker
 * - Headers: Heure;Position;Symbole;Type;Volume;Prix;S / L;T / P;Heure;Prix;Commission;Echange;Profit;;
 * - Duplicate column names (Heure x2, Prix x2) — we map by index
 * - European number formatting (comma decimal, space thousands)
 */
function tryParseMT5(lines: string[]): ParsedTrade[] {
  // Find the header line: look for "Positions" marker or the header pattern
  let headerLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();

    // "Positions" marker — headers are on the next non-empty line
    if (trimmed === "positions") {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          headerLineIndex = j;
          break;
        }
      }
      break;
    }

    // Direct header detection: line starts with "Heure;Position;Symbole"
    if (trimmed.startsWith("heure;position;symbole")) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) return [];

  // MT5 columns by index:
  // 0: Heure (open)
  // 1: Position (ticket)
  // 2: Symbole
  // 3: Type
  // 4: Volume
  // 5: Prix (entry)
  // 6: S / L
  // 7: T / P
  // 8: Heure (close)
  // 9: Prix (exit)
  // 10: Commission
  // 11: Echange (swap)
  // 12: Profit
  const COL = {
    OPEN_TIME: 0,
    TICKET: 1,
    SYMBOL: 2,
    TYPE: 3,
    VOLUME: 4,
    ENTRY_PRICE: 5,
    SL: 6,
    TP: 7,
    CLOSE_TIME: 8,
    EXIT_PRICE: 9,
    COMMISSION: 10,
    SWAP: 11,
    PROFIT: 12,
  };

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

    // Skip balance/history lines (lot=0, entry=0, or exit=0)
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

/** Generic parser for MT4 and simplified CSV formats */
function parseGeneric(lines: string[]): ParsedTrade[] {
  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  if (filtered.length < 2) return [];

  const delimiter = filtered[0].includes("\t")
    ? "\t"
    : filtered[0].includes(";")
      ? ";"
      : ",";

  const rawHeaders = filtered[0].split(delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  const rows = filtered.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || "").trim();
    });
    return row;
  });

  const isMT = headers.some(
    (h) => h === "ticket" || h === "open_time" || h === "open_price"
  );

  return rows
    .map((row): ParsedTrade | null => {
      if (isMT) return parseMTRow(row);
      return parseSimpleRow(row);
    })
    .filter((t): t is ParsedTrade => t !== null);
}

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
