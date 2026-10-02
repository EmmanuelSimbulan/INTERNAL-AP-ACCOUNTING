import { createHash } from "node:crypto";
import { assertTotal } from "./money";

export type QuickBooksLine = { account: string; projectCode: string; memo: string; amount: string; class?: string; department?: string; taxCode?: string };
export type QuickBooksInput = { requestNumber: string; company: string; payee: string; date: string; currency: string; total: string; lines: QuickBooksLine[] };

export function validateQuickBooksInput(input: QuickBooksInput) {
  const errors: string[] = [];
  input.lines.forEach((line, i) => { if (!line.account) errors.push(`Line ${i + 1}: account mapping is required`); if (!line.projectCode) errors.push(`Line ${i + 1}: project code is required`); });
  try { assertTotal(input.lines.map((line) => line.amount), input.total); } catch (error) { errors.push((error as Error).message); }
  return errors;
}

function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
export function generateQuickBooksCsv(input: QuickBooksInput) {
  const errors = validateQuickBooksInput(input);
  if (errors.length) throw new Error(errors.join("; "));
  const header = ["Reference","Company","Payee","Date","Currency","Account","Project Code","Class","Department","Tax Code","Memo","Amount"];
  const rows = input.lines.map((line) => [input.requestNumber,input.company,input.payee,input.date,input.currency,line.account,line.projectCode,line.class ?? "",line.department ?? "",line.taxCode ?? "",line.memo,line.amount]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return { csv, checksum: createHash("sha256").update(csv).digest("hex") };
}
