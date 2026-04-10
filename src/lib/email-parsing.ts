/**
 * Bank email parsing rules for Gmail → n8n → FinanceOS pipeline.
 * Each rule matches a bank's transaction notification email body
 * and extracts: merchant, amount, date, last_four, cr_dr.
 *
 * Usage in n8n: Pass the email body text through these patterns
 * and POST the result to POST /api/import/webhook.
 */

export interface ParsedTransaction {
  merchant: string
  amount: number
  date: string          // YYYY-MM-DD
  last_four?: string
  cr_dr: 'debit' | 'credit'
  source: 'n8n'
  confidence: number    // 0–100
}

export interface BankParsingRule {
  bank: string
  match: RegExp          // matches the email subject or From header
  parse: (body: string, subject: string, date: Date) => ParsedTransaction | null
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Chase ─────────────────────────────────────────────────────────────────────
const chaseRule: BankParsingRule = {
  bank: 'Chase',
  match: /chase\.com|jpmorgan/i,
  parse(body, _subject, emailDate) {
    // Pattern: "Your $XX.XX transaction with MERCHANT on MM/DD/YYYY"
    const txnMatch = body.match(/Your\s+\$?([\d,]+\.?\d*)\s+transaction\s+with\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (txnMatch) {
      const amount = parseFloat(txnMatch[1].replace(',', ''))
      const merchant = txnMatch[2].trim()
      const [m, d, y] = txnMatch[3].split('/')
      return { merchant, amount, date: `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`, cr_dr: 'debit', source: 'n8n', confidence: 90 }
    }
    // Pattern: "A charge of $XX.XX was made to your card ending in XXXX"
    const chargeMatch = body.match(/charge of \$?([\d,]+\.?\d*)\s+was made.+ending in (\d{4})/i)
    if (chargeMatch) {
      const amount = parseFloat(chargeMatch[1].replace(',', ''))
      const merchantMatch = body.match(/at (.+?) on/i)
      return { merchant: merchantMatch?.[1]?.trim() ?? 'Unknown', amount, date: fmtDate(emailDate), last_four: chargeMatch[2], cr_dr: 'debit', source: 'n8n', confidence: 75 }
    }
    return null
  }
}

// ── Bank of America ───────────────────────────────────────────────────────────
const boaRule: BankParsingRule = {
  bank: 'Bank of America',
  match: /bankofamerica\.com|bofa/i,
  parse(body, _subject, emailDate) {
    // Pattern: "An authorized transaction of $XX.XX at MERCHANT"
    const match = body.match(/authorized transaction of \$?([\d,]+\.?\d*)\s+at\s+(.+?)[\.\n]/i)
    if (match) {
      return { merchant: match[2].trim(), amount: parseFloat(match[1].replace(',','')), date: fmtDate(emailDate), cr_dr: 'debit', source: 'n8n', confidence: 85 }
    }
    return null
  }
}

// ── SoFi ──────────────────────────────────────────────────────────────────────
const sofiRule: BankParsingRule = {
  bank: 'SoFi',
  match: /sofi\.com/i,
  parse(body, _subject, emailDate) {
    // Pattern: "You spent $XX.XX at MERCHANT"
    const match = body.match(/(?:You spent|Charge of) \$?([\d,]+\.?\d*)\s+at\s+(.+?)[\.\n]/i)
    if (match) {
      return { merchant: match[2].trim(), amount: parseFloat(match[1].replace(',','')), date: fmtDate(emailDate), cr_dr: 'debit', source: 'n8n', confidence: 85 }
    }
    return null
  }
}

// ── Discover ──────────────────────────────────────────────────────────────────
const discoverRule: BankParsingRule = {
  bank: 'Discover',
  match: /discover\.com|discovercard/i,
  parse(body, _subject, emailDate) {
    // Pattern: "A transaction of $XX.XX was made at MERCHANT"
    const match = body.match(/transaction of \$?([\d,]+\.?\d*)\s+was made at\s+(.+?)[\.\n]/i)
    if (match) {
      return { merchant: match[2].trim(), amount: parseFloat(match[1].replace(',','')), date: fmtDate(emailDate), cr_dr: 'debit', source: 'n8n', confidence: 82 }
    }
    return null
  }
}

// ── Apple Pay (receipt) ───────────────────────────────────────────────────────
const applePayRule: BankParsingRule = {
  bank: 'Apple Pay',
  match: /apple\.com|appleid/i,
  parse(body, _subject, emailDate) {
    // Apple purchase receipts: "MERCHANT $XX.XX"
    const match = body.match(/^(.+?)\s+\$?([\d,]+\.?\d*)$/m)
    if (match) {
      return { merchant: match[1].trim(), amount: parseFloat(match[2].replace(',','')), date: fmtDate(emailDate), cr_dr: 'debit', source: 'n8n', confidence: 70 }
    }
    return null
  }
}

// ── Remitly ───────────────────────────────────────────────────────────────────
const remitlyRule: BankParsingRule = {
  bank: 'Remitly',
  match: /remitly\.com/i,
  parse(body, _subject, emailDate) {
    // "You sent $XXX.XX to NAME"
    const match = body.match(/You sent \$?([\d,]+\.?\d*)\s+to\s+(.+?)[\.\n]/i)
    if (match) {
      return { merchant: `Remitly → ${match[2].trim()}`, amount: parseFloat(match[1].replace(',','')), date: fmtDate(emailDate), cr_dr: 'debit', source: 'n8n', confidence: 90 }
    }
    return null
  }
}

export const BANK_PARSING_RULES: BankParsingRule[] = [
  chaseRule,
  boaRule,
  sofiRule,
  discoverRule,
  applePayRule,
  remitlyRule,
]

/**
 * Main entry: try all rules against a bank email.
 * Returns the first successful parse, or null.
 */
export function parseEmailTransaction(
  body: string,
  subject: string,
  fromAddress: string,
  emailDate: Date = new Date()
): ParsedTransaction | null {
  for (const rule of BANK_PARSING_RULES) {
    if (rule.match.test(fromAddress) || rule.match.test(subject)) {
      const result = rule.parse(body, subject, emailDate)
      if (result) return result
    }
  }
  return null
}
