export type CompanyNumberingRule = {
  name: string;
  code: string;
  requestPattern: string;
  invoicePattern: string;
  reset: "Annual" | "Monthly";
};

export const companyNumberingRules: CompanyNumberingRule[] = [
  { name: "CLARK DATA CENTER INC.", code: "CDC", requestPattern: "CDC-RFP-{YEAR}-{SEQ}", invoicePattern: "CDC-AP-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "SVI INFORMATION SERVICES CORP", code: "SVIIS", requestPattern: "SVIIS-RFP-{YEAR}-{SEQ}", invoicePattern: "SVIIS-INV-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "SVI ISC AMERICA", code: "ISC", requestPattern: "ISC-RFP-{YEAR}-{SEQ}", invoicePattern: "ISC-BILL-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "Philippine Business Profiles and Perspective, Inc.", code: "PBPP", requestPattern: "PBPP-RFP-{YEAR}-{SEQ}", invoicePattern: "PBPP-APV-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "SVI Software Services Corporation", code: "SVISS", requestPattern: "SVISS-RFP-{YEAR}-{SEQ}", invoicePattern: "SVISS-INV-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "SVI America", code: "SVIA", requestPattern: "SVIA-RFP-{YEAR}-{SEQ}", invoicePattern: "SVIA-BILL-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "Software Ventures International Corporation", code: "SVIC", requestPattern: "SVIC-RFP-{YEAR}-{SEQ}", invoicePattern: "SVIC-INV-{YEAR}-{SEQ}", reset: "Annual" },
  { name: "SVI TECHNOLOGIES INC", code: "SVIT", requestPattern: "SVIT-RFP-{YEAR}-{SEQ}", invoicePattern: "SVIT-INV-{YEAR}-{SEQ}", reset: "Annual" },
];

export function getCompanyNumberingRule(company: string) {
  return companyNumberingRules.find((rule) => rule.name === company) ?? companyNumberingRules.at(-1)!;
}

function sequenceFrom(source: string) {
  const numericSuffix = source.match(/(\d+)$/)?.[1] ?? source.replace(/\D/g, "");
  return numericSuffix.slice(-6).padStart(6, "0");
}

function applyPattern(pattern: string, date: string, source: string) {
  return pattern
    .replace("{YEAR}", date.slice(0, 4))
    .replace("{MONTH}", date.slice(5, 7))
    .replace("{SEQ}", sequenceFrom(source));
}

export function generateRequestNumber(company: string, date: string, source: string) {
  return applyPattern(getCompanyNumberingRule(company).requestPattern, date, source);
}

export function generateInvoiceNumber(company: string, date: string, source: string) {
  return applyPattern(getCompanyNumberingRule(company).invoicePattern, date, source);
}

export function patternExample(pattern: string, date = "2026-09-30") {
  return applyPattern(pattern, date, "000001");
}
