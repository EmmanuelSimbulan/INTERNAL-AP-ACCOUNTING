import { describe, expect, it } from "vitest";
import {
  createPrototypeConfigTemplate,
  previewPrototypeConfigImport,
  prototypeConfigImportValues,
} from "@/lib/prototype-config-import";

describe("prototype configuration CSV import", () => {
  it("uses the current simple project and account setting fields in templates", () => {
    expect(createPrototypeConfigTemplate("projects")).toContain('"Project Code"');
    expect(createPrototypeConfigTemplate("accounts")).toContain('"Account"');
    expect(createPrototypeConfigTemplate("accounts")).not.toContain("Account Type");
  });

  it("previews new, existing, duplicate, invalid, and empty rows separately", () => {
    const preview = previewPrototypeConfigImport(
      "projects",
      'Project Code\r\nPRJ-NEW\r\nPRJ-OLD\r\nPRJ-NEW\r\n\r\nPRJ-EXTRA,X\r\n',
      ["PRJ-OLD"],
    );
    expect(preview).toMatchObject({
      totalRecords: 4,
      validRecords: 1,
      existingRecords: 1,
      duplicateRecords: 1,
      invalidRecords: 1,
      emptyRows: 1,
    });
  });

  it("uses existing payee currencies and rejects unsupported currency values", () => {
    const result = prototypeConfigImportValues(
      "payees",
      'Payee/Vendor,Currency\r\n"A, Inc.",PHP\r\nB Vendor,USD\r\nBoth Vendor,Both\r\nBad Vendor,EUR\r\n',
      [],
    );
    expect(result.preview).toMatchObject({ validRecords: 3, invalidRecords: 1 });
    expect([...result.values.entries()]).toEqual([
      ["A, Inc.", "PHP"],
      ["B Vendor", "USD"],
      ["Both Vendor", "BOTH"],
    ]);
  });

  it("does not mark malformed CSV or invalid headers as importable", () => {
    const invalidHeaders = previewPrototypeConfigImport("natureOfPayments", "Nature,Status\nSupplies,Active", []);
    const malformed = previewPrototypeConfigImport("accounts", 'Account\n"Unclosed', []);
    expect(invalidHeaders.validRecords).toBe(0);
    expect(invalidHeaders.invalidRecords).toBe(1);
    expect(invalidHeaders.errors[0]).toContain("Invalid column headers");
    expect(malformed.validRecords).toBe(0);
    expect(malformed.invalidRecords).toBe(1);
    expect(malformed.errors[0]).toContain("unclosed quoted value");
  });
});
