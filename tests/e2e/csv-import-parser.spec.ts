// Validation checkpoint for the India bank-statement CSV parser (Sprint 7/3 · 3).
// Pure parser tests — no browser, server, or auth needed. Covers the
// mixed-currency import scenario: one USD (generic) + one INR (HDFC/ICICI/SBI)
// statement parsed in the same session with correct per-file currency detection.
import { test, expect } from "@playwright/test";
import {
  parseStatementCsv,
  detectStatementFormat,
} from "../../src/lib/csv-import";

const HDFC_CSV = [
  "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
  '01/06/26,"UPI-SWIGGY-BANGALORE",UPI123,01/06/26,"1,249.00",,"98,751.00"',
  '05/06/26,"NEFT-SALARY ACME CORP",NEFT456,05/06/26,,"1,00,000.00","1,98,751.00"',
].join("\n");

const ICICI_CSV = [
  "S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR),Deposit Amount (INR),Balance (INR)",
  '1,02-06-2026,02-06-2026,,"BIL/ONL/Airtel Postpaid",599.00,,45000.00',
  '2,03-06-2026,03-06-2026,,"UPI/Refund Amazon",,1299.00,46299.00',
].join("\n");

const SBI_CSV = [
  "Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance",
  '01 Jun 2026,01 Jun 2026,"POS 1234 BIG BAZAAR",REF1,"2,500.00",,50000.00',
  '02 Jun 2026,02 Jun 2026,"INTEREST CREDIT",REF2,,125.50,50125.50',
].join("\n");

const GENERIC_USD_CSV = [
  "date,description,amount,last_four",
  "2026-06-01,Starbucks,6.75,4242",
  "2026-06-02,Paycheck,-2500.00,4242",
].join("\n");

test.describe("CSV statement format detection", () => {
  test("detects HDFC via Narration header", () => {
    expect(detectStatementFormat(["Date", "Narration", "Withdrawal Amt.", "Deposit Amt."])).toBe("hdfc");
  });

  test("detects ICICI via Transaction Remarks header", () => {
    expect(detectStatementFormat(["Value Date", "Transaction Remarks", "Withdrawal Amount (INR)"])).toBe("icici");
  });

  test("detects SBI via Txn Date header", () => {
    expect(detectStatementFormat(["Txn Date", "Description", "Debit", "Credit"])).toBe("sbi");
  });

  test("detects generic and unknown formats", () => {
    expect(detectStatementFormat(["date", "description", "amount", "last_four"])).toBe("generic");
    expect(detectStatementFormat(["foo", "bar", "baz"])).toBe("unknown");
  });
});

test.describe("HDFC statement parsing", () => {
  test("parses withdrawals/deposits, Indian grouping, DD/MM/YY dates, INR currency", () => {
    const result = parseStatementCsv(HDFC_CSV);
    expect(result.format).toBe("hdfc");
    expect(result.currency).toBe("INR");
    expect(result.rows).toHaveLength(2);

    const [debit, credit] = result.rows;
    expect(debit.merchant).toBe("UPI-SWIGGY-BANGALORE");
    expect(debit.amount).toBe(1249);
    expect(debit.date).toBe("2026-06-01");
    expect(debit.isCredit).toBe(false);

    expect(credit.merchant).toBe("NEFT-SALARY ACME CORP");
    expect(credit.amount).toBe(100000); // "1,00,000.00" Indian grouping
    expect(credit.isCredit).toBe(true);
  });
});

test.describe("ICICI statement parsing", () => {
  test("parses DD-MM-YYYY dates and INR headers", () => {
    const result = parseStatementCsv(ICICI_CSV);
    expect(result.format).toBe("icici");
    expect(result.currency).toBe("INR");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe("2026-06-02");
    expect(result.rows[0].amount).toBe(599);
    expect(result.rows[0].isCredit).toBe(false);
    expect(result.rows[1].isCredit).toBe(true);
    expect(result.rows[1].amount).toBe(1299);
  });
});

test.describe("SBI statement parsing", () => {
  test('parses "01 Jun 2026" dates and Debit/Credit columns', () => {
    const result = parseStatementCsv(SBI_CSV);
    expect(result.format).toBe("sbi");
    expect(result.currency).toBe("INR");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe("2026-06-01");
    expect(result.rows[0].amount).toBe(2500);
    expect(result.rows[0].isCredit).toBe(false);
    expect(result.rows[1].amount).toBe(125.5);
    expect(result.rows[1].isCredit).toBe(true);
  });
});

test.describe("Generic statement parsing", () => {
  test("keeps existing US format behavior — USD, negative = credit", () => {
    const result = parseStatementCsv(GENERIC_USD_CSV);
    expect(result.format).toBe("generic");
    expect(result.currency).toBe("USD");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amount).toBe(6.75);
    expect(result.rows[0].isCredit).toBe(false);
    expect(result.rows[0].lastFour).toBe("4242");
    expect(result.rows[1].isCredit).toBe(true);
  });

  test("₹ symbol flips generic statements to INR", () => {
    const csv = ["date,description,amount", "2026-06-01,Chai Point,₹150.00"].join("\n");
    const result = parseStatementCsv(csv);
    expect(result.currency).toBe("INR");
    expect(result.rows[0].amount).toBe(150);
  });
});

test.describe("Mixed-currency import session (NRI checkpoint)", () => {
  test("one USD + one INR statement parse independently with correct currencies", () => {
    const usd = parseStatementCsv(GENERIC_USD_CSV);
    const inr = parseStatementCsv(HDFC_CSV);

    expect(usd.currency).toBe("USD");
    expect(inr.currency).toBe("INR");
    // Amounts stay native — no cross-contamination between parses
    expect(usd.rows[0].amount).toBe(6.75);
    expect(inr.rows[1].amount).toBe(100000);
  });

  test("unparseable files degrade to unknown with zero rows", () => {
    const result = parseStatementCsv("just some text\nnot a csv");
    expect(result.format).toBe("unknown");
    expect(result.rows).toHaveLength(0);
  });
});
