import { z } from "zod";
import { sumAmounts } from "./money";

const moneyString = z.string().regex(/^\d{1,15}(\.\d{1,4})?$/, "Enter a positive amount with up to four decimals").refine((v) => Number(v) > 0, "Amount must be greater than zero");

export const requestLineSchema = z.object({
  id: z.string().optional(),
  projectCodeId: z.string().min(1, "Project code is required"),
  accountId: z.string().optional().nullable(),
  particulars: z.string().trim().min(10, "Describe the payment in at least 10 characters").max(1000),
  amount: moneyString
});

export const requestSchema = z.object({
  companyId: z.string().min(1),
  requestDate: z.coerce.date(),
  payeeId: z.string().min(1),
  currency: z.enum(["PHP", "USD"]).or(z.string().length(3)),
  natureOfPaymentCode: z.string().min(1),
  paymentOtherText: z.string().trim().max(200).optional(),
  conditionalData: z.record(z.string(), z.unknown()).default({}),
  lines: z.array(requestLineSchema).min(1).max(100)
}).superRefine((value, ctx) => {
  if (value.natureOfPaymentCode === "OTHERS" && !value.paymentOtherText?.trim()) {
    ctx.addIssue({ code: "custom", path: ["paymentOtherText"], message: "Please specify is required" });
  }
  const requirements: Record<string, string[]> = {
    PAYROLL: ["payrollBreakdown"], GCASH: ["recipientName", "mobileNumber"], CASH_ADVANCE: ["custodian", "businessPurpose", "liquidationDate"], CREDIT_CARD: ["cardReference"], CONSULTANCY: ["agreementReference"], GOVERNMENT_REMITTANCE: ["agency", "period", "dueDate", "remittanceType"], BANK_TRANSFER: ["approvedBankDetailsRef"], DOLLAR_PURCHASE: ["foreignCurrencyDetails"], DEBIT_MEMO: ["relatedTransaction"], REIMBURSEMENT: ["proofOfPayment"]
  };
  for (const key of requirements[value.natureOfPaymentCode] ?? []) {
    if (!value.conditionalData[key]) ctx.addIssue({ code: "custom", path: ["conditionalData", key], message: `${key} is required` });
  }
});

export type RequestInput = z.infer<typeof requestSchema>;
export function validatedRequest(input: unknown) {
  const value = requestSchema.parse(input);
  return { ...value, calculatedTotal: sumAmounts(value.lines.map((line) => line.amount)) };
}

const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "message/rfc822"]);
export function validateUpload(file: { name: string; type: string; size: number }, maxBytes = 10 * 1024 * 1024) {
  if (!acceptedTypes.has(file.type)) throw new Error("Unsupported document type");
  if (file.size <= 0 || file.size > maxBytes) throw new Error("File size is outside the permitted range");
  if (/[\\/:*?\"<>|\x00-\x1F]/.test(file.name)) throw new Error("Unsafe filename");
}

export function validateUploadBatch(files: { name: string; type: string; size: number }[], maxBytes = 10 * 1024 * 1024, maxFiles = 20) {
  if (!files.length) throw new Error("Select at least one file");
  if (files.length > maxFiles) throw new Error(`Select no more than ${maxFiles} files at a time`);
  files.forEach((file) => validateUpload(file, maxBytes));
}
