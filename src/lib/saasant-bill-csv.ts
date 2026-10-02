import { generateInvoiceNumber } from "@/lib/company-numbering";

export type SaasantBillLine = {
  project: string;
  account: string;
  particulars: string;
  amount: string;
};

export type SaasantBillRequest = {
  id: string;
  number: string;
  company: string;
  invoiceNumber?: string;
  payee: string;
  date: string;
  currency: string;
  nature: string;
  other: string;
  lines: SaasantBillLine[];
};

const headers = [
  "Bill No",
  "Vendor",
  "Bill Date",
  "Due Date",
  "Terms",
  "Memo",
  "Currency",
  "Expense Account",
  "Expense Description",
  "Expense Amount",
  "Customer/Project",
  "Class",
  "Location",
  "Billable",
  "Reference No",
] as const;

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function billNumber(request: SaasantBillRequest) {
  return (
    request.invoiceNumber ??
    generateInvoiceNumber(request.company, request.date, request.number)
  );
}

function rowsForRequest(request: SaasantBillRequest) {
  const memo = `${request.nature}${request.other ? ` - ${request.other}` : ""} | ${request.number}`;
  return request.lines.map((line) => [
    billNumber(request),
    request.payee,
    request.date,
    addDays(request.date, 30),
    "Net 30",
    memo,
    request.currency,
    line.account || "Uncategorized Expense",
    line.particulars,
    (Number(line.amount) || 0).toFixed(2),
    line.project,
    "",
    "",
    "No",
    request.number,
  ]);
}

export function buildSaasantBulkBillCsv(requests: SaasantBillRequest[]) {
  if (!requests.length) throw new Error("At least one bill is required");
  const rows = requests.flatMap(rowsForRequest);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => csvCell(String(value))).join(","))
    .join("\r\n")}`;
}

export function buildSaasantBillCsv(request: SaasantBillRequest) {
  return buildSaasantBulkBillCsv([request]);
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadSaasantBillCsv(request: SaasantBillRequest) {
  downloadCsv(buildSaasantBillCsv(request), `SAASANT-BILL-${request.number}.csv`);
}

export function downloadSaasantBulkBillCsv(requests: SaasantBillRequest[]) {
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(
    buildSaasantBulkBillCsv(requests),
    `SAASANT-BILLS-${date}-${requests.length}.csv`,
  );
}
