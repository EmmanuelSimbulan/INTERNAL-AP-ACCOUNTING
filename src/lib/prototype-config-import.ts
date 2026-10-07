export type PrototypeConfigType = "projects" | "accounts" | "payees" | "natureOfPayments";
export type PrototypeConfigImportRow = {
  rowNumber: number;
  label: string;
  status: "new" | "existing" | "duplicate" | "invalid" | "empty";
  message: string;
};
export type PrototypeConfigImportPreview = {
  type: PrototypeConfigType;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  existingRecords: number;
  emptyRows: number;
  errors: string[];
  rows: PrototypeConfigImportRow[];
};

export const prototypeConfigDefinitions: Record<PrototypeConfigType, {
  title: string;
  headers: string[];
  maxLength: number;
  maxRecords: number;
  sampleRows: string[][];
}> = {
  projects: {
    title: "Project Codes",
    headers: ["Project Code"],
    maxLength: 200,
    maxRecords: 500,
    sampleRows: [["PRJ-001"]],
  },
  accounts: {
    title: "Accounts",
    headers: ["Account"],
    maxLength: 200,
    maxRecords: 500,
    sampleRows: [["Office Supplies"]],
  },
  payees: {
    title: "Payees / Vendors",
    headers: ["Payee/Vendor", "Currency"],
    maxLength: 300,
    maxRecords: 1_000,
    sampleRows: [["Sample Vendor PHP", "PHP"], ["Sample Vendor USD", "USD"], ["Sample Vendor Multi-Currency", "BOTH"]],
  },
  natureOfPayments: {
    title: "Nature of Payment",
    headers: ["Nature of Payment"],
    maxLength: 500,
    maxRecords: 200,
    sampleRows: [["Office Supplies"], ["Software License"]],
  },
};

export function escapePrototypeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function createPrototypeConfigTemplate(type: PrototypeConfigType) {
  const definition = prototypeConfigDefinitions[type];
  return [definition.headers, ...definition.sampleRows]
    .map((row) => row.map(escapePrototypeCsvCell).join(","))
    .join("\r\n") + "\r\n";
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let cellStarted = false;
  const errors: string[] = [];
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else { cell += character; if (character === "\n") line += 1; }
      continue;
    }
    if (character === '"') {
      if (cellStarted || cell.trim()) errors.push(`Line ${line}: unexpected quote in an unquoted value.`);
      else { cell = ""; quoted = true; cellStarted = true; }
    } else if (character === ",") {
      row.push(cell.trim()); cell = ""; cellStarted = false;
    } else if (character === "\r" || character === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = []; cell = ""; cellStarted = false;
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      line += 1; rowLine = line;
    } else {
      cell += character;
      if (!/\s/.test(character)) cellStarted = true;
    }
  }
  if (quoted) errors.push(`Line ${rowLine}: unclosed quoted value.`);
  if (cell.length || row.length || (csv.length && !/[\r\n]$/.test(csv))) {
    row.push(cell.trim());
    rows.push(row);
  }
  if (rows.length && rows[0][0]?.startsWith("\uFEFF")) rows[0][0] = rows[0][0].slice(1);
  return { rows, errors };
}

function normalizeCurrency(value: string): "PHP" | "USD" | "BOTH" | null {
  const currency = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (currency === "PHP") return "PHP";
  if (currency === "USD") return "USD";
  if (["BOTH", "BOTH CURRENCIES", "PHP & USD", "PHP AND USD"].includes(currency)) return "BOTH";
  return null;
}

export function previewPrototypeConfigImport(type: PrototypeConfigType, csv: string, currentValues: string[]) {
  const definition = prototypeConfigDefinitions[type];
  const parsed = parseCsv(csv);
  const allRows = parsed.rows;
  if (allRows.length > 5_001) parsed.errors.push("CSV exceeds the 5,000-row processing limit.");
  const headers = allRows.shift() ?? [];
  const expected = definition.headers.map((header) => header.trim().toLowerCase());
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const duplicateHeader = new Set(normalizedHeaders).size !== normalizedHeaders.length;
  const headerValid = parsed.errors.length === 0 && !duplicateHeader && normalizedHeaders.length === expected.length && expected.every((header) => normalizedHeaders.includes(header));
  const columnIndexes = Object.fromEntries(expected.map((header) => [header, normalizedHeaders.indexOf(header)]));
  const errors = [...parsed.errors];
  if (!headerValid) errors.push(`Invalid column headers. Expected: ${definition.headers.join(", ")}.`);
  const current = new Set(currentValues.map((value) => value.trim().toLocaleLowerCase()));
  const seen = new Set<string>();
  const records: PrototypeConfigImportRow[] = [];
  let validRecords = 0;
  let invalidRecords = 0;
  let duplicateRecords = 0;
  let existingRecords = 0;
  let emptyRows = 0;
  for (const [index, cells] of allRows.entries()) {
    const rowNumber = index + 2;
    if (cells.every((value) => !value.trim())) {
      emptyRows += 1;
      records.push({ rowNumber, label: "(empty row)", status: "empty", message: "Skipped empty row." });
      continue;
    }
    const valueIndex = columnIndexes[expected[0]];
    const value = headerValid && valueIndex >= 0 ? cells[valueIndex]?.trim() ?? "" : cells[0]?.trim() ?? "";
    const label = value || `(row ${rowNumber})`;
    let problem = "";
    if (parsed.errors.length) problem = `CSV formatting error: ${parsed.errors[0]}`;
    else if (!headerValid) problem = "Column headers do not match this configuration's template.";
    else if (cells.length !== headers.length) problem = `Expected ${headers.length} columns but found ${cells.length}.`;
    else if (!value) problem = `${definition.headers[0]} is required.`;
    else if (value.length > definition.maxLength) problem = `${definition.headers[0]} exceeds ${definition.maxLength} characters.`;
    const currency = type === "payees" && headerValid && cells.length === headers.length
      ? normalizeCurrency(cells[columnIndexes.currency] ?? "")
      : null;
    if (!problem && type === "payees" && !currency) problem = "Currency must be PHP, USD, or BOTH (PHP & USD).";
    if (problem) {
      invalidRecords += 1;
      records.push({ rowNumber, label, status: "invalid", message: problem });
      continue;
    }
    const normalized = value.toLocaleLowerCase();
    if (seen.has(normalized)) {
      duplicateRecords += 1;
      records.push({ rowNumber, label, status: "duplicate", message: "Duplicate within this file; skipped." });
      continue;
    }
    seen.add(normalized);
    if (current.has(normalized)) {
      existingRecords += 1;
      records.push({ rowNumber, label, status: "existing", message: "Already exists in Settings; no changes made." });
      continue;
    }
    validRecords += 1;
    records.push({ rowNumber, label, status: "new", message: type === "payees" ? `Ready to add (${currency}).` : "Ready to add." });
  }
  if (validRecords + currentValues.length > definition.maxRecords) {
    const available = Math.max(0, definition.maxRecords - currentValues.length);
    let allowed = 0;
    for (const row of records) {
      if (row.status !== "new") continue;
      if (allowed < available) allowed += 1;
      else {
        row.status = "invalid";
        row.message = `This configuration can contain at most ${definition.maxRecords} records.`;
        validRecords -= 1;
        invalidRecords += 1;
      }
    }
  }
  const totalRecords = allRows.filter((row) => row.some((value) => value.trim())).length;
  return {
    type,
    totalRecords,
    validRecords,
    invalidRecords,
    duplicateRecords,
    existingRecords,
    emptyRows,
    errors,
    rows: records,
  } satisfies PrototypeConfigImportPreview;
}

export function prototypeConfigImportValues(type: PrototypeConfigType, csv: string, currentValues: string[]) {
  const preview = previewPrototypeConfigImport(type, csv, currentValues);
  const { rows: parsedRows } = parseCsv(csv);
  const headers = parsedRows.shift() ?? [];
  const expected = prototypeConfigDefinitions[type].headers.map((header) => header.trim().toLowerCase());
  const indexes = Object.fromEntries(expected.map((header) => [header, headers.findIndex((item) => item.trim().toLowerCase() === header)]));
  const values = new Map<string, "PHP" | "USD" | "BOTH">();
  for (const result of preview.rows) {
    if (result.status !== "new") continue;
    const cells = parsedRows[result.rowNumber - 2] ?? [];
    const value = cells[indexes[expected[0]]]?.trim();
    if (value) values.set(value, type === "payees" ? normalizeCurrency(cells[indexes.currency] ?? "") ?? "BOTH" : "BOTH");
  }
  return { preview, values };
}
