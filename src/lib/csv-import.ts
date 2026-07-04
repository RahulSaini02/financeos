// Client-safe CSV import parser — no server/supabase imports.

export type StatementFormat = 'generic' | 'hdfc' | 'icici' | 'sbi' | 'unknown';
export type StatementCurrency = 'USD' | 'INR' | null;

export interface ParsedImportRow {
  merchant: string;
  /** Positive number in native (non-converted) currency */
  amount: number;
  /** ISO YYYY-MM-DD */
  date: string;
  lastFour: string | null;
  isCredit: boolean;
  raw: Record<string, string | null>;
}

export interface ParseStatementResult {
  format: StatementFormat;
  currency: StatementCurrency;
  rows: ParsedImportRow[];
  skipped: number;
}

// ─── CSV tokenizer ────────────────────────────────────────────────────────────

/** Tokenize one CSV line, honoring quoted fields and double-quote escapes. */
function tokenizeCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped double-quote inside a quoted field
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    i++;
  }

  fields.push(current.trim());
  return fields;
}

// ─── Format detection ─────────────────────────────────────────────────────────

/**
 * Identify the bank statement format from its header row.
 * Detection order matters — check the most-distinctive substring first.
 */
export function detectStatementFormat(headerCells: string[]): StatementFormat {
  const normalized = headerCells.map((h) => h.toLowerCase().trim());
  const joined = normalized.join('|');

  // HDFC: "Narration" is unique to this format
  if (joined.includes('narration')) return 'hdfc';

  // ICICI: "Transaction Remarks" is unique to this format
  if (joined.includes('transaction remarks')) return 'icici';

  // SBI: "Txn Date" is unique to this format
  if (joined.includes('txn date')) return 'sbi';

  // Generic: needs a date-like first column plus description and amount columns
  const hasDateCol = normalized.some((h) => h === 'date' || h.startsWith('date'));
  const hasDescCol = normalized.some((h) => h.includes('description'));
  const hasAmtCol = normalized.some((h) => h.includes('amount') || h === 'amount');
  if (hasDateCol && (hasDescCol || hasAmtCol)) return 'generic';

  return 'unknown';
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** Parse various date formats to ISO YYYY-MM-DD, or return null if unparseable. */
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD/MM/YY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, dd, mm, yy] = slashMatch;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD-MM-YY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const [, dd, mm, yy] = dashMatch;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // "01 Jan 2026" or "01-Jan-2026"
  const wordMatch = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/);
  if (wordMatch) {
    const [, dd, mon, yyyy] = wordMatch;
    const mm = MONTH_MAP[mon.toLowerCase()];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  return null;
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

/**
 * Strip currency symbols and Indian digit grouping, return a float.
 * Returns NaN if the value is empty or unparseable.
 */
function parseAmount(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/[₹$]/g, '')
    .replace(/\bINR\b/gi, '')
    .replace(/\bRs\.?/gi, '')
    .replace(/,/g, '')
    .trim();

  if (cleaned === '' || cleaned === '-') return NaN;
  return parseFloat(cleaned);
}

// ─── Column index helpers ─────────────────────────────────────────────────────

/** Return the first header index whose lowercased value contains any of the given substrings. */
function findCol(headers: string[], ...substrings: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const sub of substrings) {
    const idx = lower.findIndex((h) => h.includes(sub.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Return the first header index whose lowercased value exactly equals any of the given values. */
function findExactCol(headers: string[], ...values: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const val of values) {
    const idx = lower.indexOf(val.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

// ─── Currency auto-detection ──────────────────────────────────────────────────

function detectCurrency(
  rawText: string,
  headerCells: string[],
  format: StatementFormat,
): StatementCurrency {
  // Indian bank formats are always INR
  if (format === 'hdfc' || format === 'icici' || format === 'sbi') return 'INR';

  // Explicit INR markers anywhere in the file
  if (rawText.includes('₹')) return 'INR';
  const headerJoined = headerCells.join('').toLowerCase();
  if (headerJoined.includes('(inr)') || headerJoined.includes(' inr')) return 'INR';

  // USD markers
  if (rawText.includes('$')) return 'USD';

  // Generic format without explicit markers defaults to USD (original US-focused format)
  if (format === 'generic') return 'USD';

  return null;
}

// ─── Row parsers ──────────────────────────────────────────────────────────────

function parseHdfcRows(
  headers: string[],
  dataLines: string[],
): { rows: ParsedImportRow[]; skipped: number } {
  const dateIdx = findCol(headers, 'date');
  const merchantIdx = findCol(headers, 'narration');
  const withdrawalIdx = findCol(headers, 'withdrawal');
  const depositIdx = findCol(headers, 'deposit');

  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cols = tokenizeCsvRow(line);
    const rawDate = cols[dateIdx] ?? '';
    const rawMerchant = cols[merchantIdx] ?? '';
    const rawWithdrawal = cols[withdrawalIdx] ?? '';
    const rawDeposit = cols[depositIdx] ?? '';

    const date = parseDate(rawDate);
    if (!date || !rawMerchant.trim()) { skipped++; continue; }

    const withdrawal = parseAmount(rawWithdrawal);
    const deposit = parseAmount(rawDeposit);

    const isCredit = !isNaN(deposit) && deposit > 0 && (isNaN(withdrawal) || withdrawal === 0);
    const amount = isCredit ? deposit : (isNaN(withdrawal) ? NaN : withdrawal);
    if (isNaN(amount) || amount === 0) { skipped++; continue; }

    const raw: Record<string, string | null> = {};
    headers.forEach((h, i) => { raw[h] = cols[i] ?? null; });

    rows.push({ merchant: rawMerchant.trim(), amount, date, lastFour: null, isCredit, raw });
  }

  return { rows, skipped };
}

function parseIciciRows(
  headers: string[],
  dataLines: string[],
): { rows: ParsedImportRow[]; skipped: number } {
  const lower = headers.map((h) => h.toLowerCase().trim());

  // Prefer "Transaction Date" over "Value Date"
  let dateIdx = lower.findIndex((h) => h.includes('transaction date'));
  if (dateIdx === -1) dateIdx = lower.findIndex((h) => h.includes('value date'));

  const merchantIdx = findCol(headers, 'transaction remarks');
  const withdrawalIdx = findCol(headers, 'withdrawal amount');
  const depositIdx = findCol(headers, 'deposit amount');

  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cols = tokenizeCsvRow(line);
    const rawDate = cols[dateIdx] ?? '';
    const rawMerchant = cols[merchantIdx] ?? '';
    const rawWithdrawal = cols[withdrawalIdx] ?? '';
    const rawDeposit = cols[depositIdx] ?? '';

    const date = parseDate(rawDate);
    if (!date || !rawMerchant.trim()) { skipped++; continue; }

    const withdrawal = parseAmount(rawWithdrawal);
    const deposit = parseAmount(rawDeposit);

    const isCredit = !isNaN(deposit) && deposit > 0 && (isNaN(withdrawal) || withdrawal === 0);
    const amount = isCredit ? deposit : (isNaN(withdrawal) ? NaN : withdrawal);
    if (isNaN(amount) || amount === 0) { skipped++; continue; }

    const raw: Record<string, string | null> = {};
    headers.forEach((h, i) => { raw[h] = cols[i] ?? null; });

    rows.push({ merchant: rawMerchant.trim(), amount, date, lastFour: null, isCredit, raw });
  }

  return { rows, skipped };
}

function parseSbiRows(
  headers: string[],
  dataLines: string[],
): { rows: ParsedImportRow[]; skipped: number } {
  const dateIdx = findCol(headers, 'txn date');
  const merchantIdx = findCol(headers, 'description');
  // SBI uses exact "Debit" / "Credit" column names
  const debitIdx = findExactCol(headers, 'debit');
  const creditIdx = findExactCol(headers, 'credit');

  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cols = tokenizeCsvRow(line);
    const rawDate = cols[dateIdx] ?? '';
    const rawMerchant = cols[merchantIdx] ?? '';
    const rawDebit = debitIdx !== -1 ? (cols[debitIdx] ?? '') : '';
    const rawCredit = creditIdx !== -1 ? (cols[creditIdx] ?? '') : '';

    const date = parseDate(rawDate);
    if (!date || !rawMerchant.trim()) { skipped++; continue; }

    const debitAmt = parseAmount(rawDebit);
    const creditAmt = parseAmount(rawCredit);

    const isCredit = !isNaN(creditAmt) && creditAmt > 0 && (isNaN(debitAmt) || debitAmt === 0);
    const amount = isCredit ? creditAmt : (isNaN(debitAmt) ? NaN : debitAmt);
    if (isNaN(amount) || amount === 0) { skipped++; continue; }

    const raw: Record<string, string | null> = {};
    headers.forEach((h, i) => { raw[h] = cols[i] ?? null; });

    rows.push({ merchant: rawMerchant.trim(), amount, date, lastFour: null, isCredit, raw });
  }

  return { rows, skipped };
}

function parseGenericRows(
  dataLines: string[],
): { rows: ParsedImportRow[]; skipped: number } {
  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cols = tokenizeCsvRow(line);
    const [rawDate, rawDesc, rawAmount, rawLastFour] = cols;
    if (!rawDate || !rawDesc || !rawAmount) { skipped++; continue; }

    const date = parseDate(rawDate) ?? rawDate;
    const numAmount = parseAmount(rawAmount);
    if (isNaN(numAmount)) { skipped++; continue; }

    // Negative amounts are credits (income) in the generic format
    const isCredit = numAmount < 0;
    const amount = Math.abs(numAmount);

    const raw: Record<string, string | null> = {
      date: rawDate,
      description: rawDesc,
      amount: rawAmount,
      last_four: rawLastFour ?? null,
    };

    rows.push({
      merchant: rawDesc.trim(),
      amount,
      date,
      lastFour: rawLastFour ? rawLastFour.trim().slice(-4) : null,
      isCredit,
      raw,
    });
  }

  return { rows, skipped };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function parseStatementCsv(text: string): ParseStatementResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return { format: 'unknown', currency: null, rows: [], skipped: 0 };
  }

  const headerCells = tokenizeCsvRow(lines[0]);
  const format = detectStatementFormat(headerCells);

  if (format === 'unknown') {
    return { format, currency: null, rows: [], skipped: 0 };
  }

  const currency = detectCurrency(text, headerCells, format);
  const dataLines = lines.slice(1);

  let rows: ParsedImportRow[] = [];
  let skipped = 0;

  if (format === 'hdfc') {
    ({ rows, skipped } = parseHdfcRows(headerCells, dataLines));
  } else if (format === 'icici') {
    ({ rows, skipped } = parseIciciRows(headerCells, dataLines));
  } else if (format === 'sbi') {
    ({ rows, skipped } = parseSbiRows(headerCells, dataLines));
  } else {
    ({ rows, skipped } = parseGenericRows(dataLines));
  }

  return { format, currency, rows, skipped };
}
