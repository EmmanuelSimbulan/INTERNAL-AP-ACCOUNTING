import { money } from "./money";

export const statuses = ["DRAFT","SUBMITTED","PENDING_MANAGER_APPROVAL","RETURNED_FOR_REVISION","RESUBMITTED","REJECTED","MANAGER_APPROVED","PENDING_AP_VALIDATION","RETURNED_BY_AP","ON_HOLD","PENDING_ACCOUNTING_REVIEW","ACCOUNTING_APPROVED","READY_FOR_DOCUMENT_GENERATION","DOCUMENT_GENERATED","REPOSITORY_SAVE_PENDING","REPOSITORY_SAVE_FAILED","READY_FOR_QUICKBOOKS","QUICKBOOKS_FILE_GENERATED","QUICKBOOKS_POSTING_PENDING","POSTED_TO_QUICKBOOKS","PAYMENT_SCHEDULED","PAYMENT_PROCESSING","PAID","RECONCILIATION_PENDING","RECONCILED","CLOSED","CANCELLED","INTEGRATION_ERROR"] as const;
export type Status = typeof statuses[number];
export type WorkflowRole = "REQUESTER" | "APPROVER" | "AP_PROCESSOR" | "AP_REVIEWER" | "ADMIN";

type Transition = { to: Status; roles: WorkflowRole[]; commentRequired?: boolean };
const graph: Record<Status, Transition[]> = {
  DRAFT: [{ to: "PENDING_MANAGER_APPROVAL", roles: ["REQUESTER", "ADMIN"] }, { to: "CANCELLED", roles: ["REQUESTER", "ADMIN"] }],
  SUBMITTED: [{ to: "PENDING_MANAGER_APPROVAL", roles: ["ADMIN"] }],
  PENDING_MANAGER_APPROVAL: [{ to: "MANAGER_APPROVED", roles: ["APPROVER" ] }, { to: "RETURNED_FOR_REVISION", roles: ["APPROVER"], commentRequired: true }, { to: "REJECTED", roles: ["APPROVER"], commentRequired: true }, { to: "CANCELLED", roles: ["REQUESTER", "ADMIN"] }],
  RETURNED_FOR_REVISION: [{ to: "RESUBMITTED", roles: ["REQUESTER"] }, { to: "CANCELLED", roles: ["REQUESTER", "ADMIN"] }],
  RESUBMITTED: [{ to: "PENDING_MANAGER_APPROVAL", roles: ["ADMIN", "REQUESTER"] }],
  REJECTED: [],
  MANAGER_APPROVED: [{ to: "PENDING_AP_VALIDATION", roles: ["APPROVER", "ADMIN"] }, { to: "READY_FOR_DOCUMENT_GENERATION", roles: ["APPROVER", "ADMIN"] }],
  PENDING_AP_VALIDATION: [{ to: "READY_FOR_DOCUMENT_GENERATION", roles: ["AP_PROCESSOR"] }, { to: "PENDING_ACCOUNTING_REVIEW", roles: ["AP_PROCESSOR"] }, { to: "RETURNED_BY_AP", roles: ["AP_PROCESSOR"], commentRequired: true }, { to: "ON_HOLD", roles: ["AP_PROCESSOR"], commentRequired: true }],
  RETURNED_BY_AP: [{ to: "RESUBMITTED", roles: ["REQUESTER"] }],
  ON_HOLD: [{ to: "PENDING_AP_VALIDATION", roles: ["AP_PROCESSOR", "ADMIN"] }],
  PENDING_ACCOUNTING_REVIEW: [{ to: "ACCOUNTING_APPROVED", roles: ["AP_REVIEWER"] }, { to: "PENDING_AP_VALIDATION", roles: ["AP_REVIEWER"], commentRequired: true }],
  ACCOUNTING_APPROVED: [{ to: "READY_FOR_DOCUMENT_GENERATION", roles: ["AP_REVIEWER"] }],
  READY_FOR_DOCUMENT_GENERATION: [{ to: "DOCUMENT_GENERATED", roles: ["AP_PROCESSOR", "ADMIN"] }],
  DOCUMENT_GENERATED: [{ to: "REPOSITORY_SAVE_PENDING", roles: ["AP_PROCESSOR", "ADMIN"] }],
  REPOSITORY_SAVE_PENDING: [{ to: "READY_FOR_QUICKBOOKS", roles: ["AP_PROCESSOR", "ADMIN"] }, { to: "REPOSITORY_SAVE_FAILED", roles: ["AP_PROCESSOR", "ADMIN"] }],
  REPOSITORY_SAVE_FAILED: [{ to: "REPOSITORY_SAVE_PENDING", roles: ["AP_PROCESSOR", "ADMIN"] }],
  READY_FOR_QUICKBOOKS: [{ to: "QUICKBOOKS_FILE_GENERATED", roles: ["AP_PROCESSOR"] }],
  QUICKBOOKS_FILE_GENERATED: [{ to: "QUICKBOOKS_POSTING_PENDING", roles: ["AP_PROCESSOR"] }],
  QUICKBOOKS_POSTING_PENDING: [{ to: "POSTED_TO_QUICKBOOKS", roles: ["AP_PROCESSOR", "AP_REVIEWER"] }, { to: "INTEGRATION_ERROR", roles: ["AP_PROCESSOR"] }],
  POSTED_TO_QUICKBOOKS: [{ to: "PAYMENT_SCHEDULED", roles: ["AP_PROCESSOR"] }],
  PAYMENT_SCHEDULED: [{ to: "PAYMENT_PROCESSING", roles: ["AP_PROCESSOR"] }],
  PAYMENT_PROCESSING: [{ to: "PAID", roles: ["AP_PROCESSOR"] }, { to: "ON_HOLD", roles: ["AP_PROCESSOR"], commentRequired: true }],
  PAID: [{ to: "RECONCILIATION_PENDING", roles: ["AP_PROCESSOR"] }],
  RECONCILIATION_PENDING: [{ to: "RECONCILED", roles: ["AP_PROCESSOR", "AP_REVIEWER"] }],
  RECONCILED: [{ to: "CLOSED", roles: ["AP_PROCESSOR", "AP_REVIEWER"] }],
  CLOSED: [], CANCELLED: [], INTEGRATION_ERROR: [{ to: "QUICKBOOKS_POSTING_PENDING", roles: ["AP_PROCESSOR", "ADMIN"] }]
};

export function assertTransition(from: Status, to: Status, roles: string[], comment?: string) {
  const transition = graph[from].find((entry) => entry.to === to);
  if (!transition) throw new Error(`Transition ${from} -> ${to} is not allowed`);
  if (!transition.roles.some((role) => roles.includes(role))) throw new Error("You do not have permission for this transition");
  if (transition.commentRequired && !comment?.trim()) throw new Error("A comment is required");
  return transition;
}

export function canClose(values: { total: string; postedTotal: string; paidTotal: string; settledTotal: string; varianceApproved: boolean }) {
  const requested = money(values.total);
  return requested.eq(values.postedTotal) && requested.eq(values.paidTotal) && requested.eq(values.settledTotal) && values.varianceApproved;
}

export const significantFields = new Set(["companyId", "payeeId", "currency", "natureOfPaymentId", "projectCodeId", "accountId", "particulars", "amount", "totalAmount", "supportingDocuments", "paymentMethod"]);
export function invalidatesApproval(changedFields: string[]) { return changedFields.some((field) => significantFields.has(field)); }
