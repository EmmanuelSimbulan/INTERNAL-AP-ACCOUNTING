"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { requirePermission, requireRole, requireUser, canReadRequest } from "@/lib/access";
import { canAccessCompany } from "@/lib/rbac";
import { validatedRequest } from "@/lib/validation";
import { assertTransition, invalidatesApproval, type Status } from "@/lib/workflow";
import { generateRequestPdf } from "@/lib/pdf";
import { LocalRepositoryAdapter } from "@/lib/storage";
import { generateQuickBooksCsv } from "@/lib/quickbooks";
import { validateUpload } from "@/lib/validation";

const requesterText = "I certify that the information in this request is complete and accurate and that the supporting documents are authentic and relevant to the payment being requested.";
const approverText = "I have reviewed this request and its supporting documents and approve it for further accounting processing.";

async function requiredDocumentCategories(natureCode: string) {
  const nature = await db.natureOfPayment.findUnique({ where: { code: natureCode }, include: { rules: { where: { active: true, required: true, ruleType: "DOCUMENT_CATEGORY" } } } });
  return nature?.rules.map((rule) => String((rule.config as { category?: string } | null)?.category ?? rule.key)) ?? [];
}

function formJson(form: FormData, key: string) { const raw = form.get(key); if (typeof raw !== "string") throw new Error(`Missing ${key}`); return JSON.parse(raw) as unknown; }
async function audit(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], event: { requestId?: string; actorId: string; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown; metadata?: unknown }) {
  await tx.auditEvent.create({ data: { ...event, before: event.before as object | undefined, after: event.after as object | undefined, metadata: event.metadata as object | undefined } });
}

export async function createRequestAction(form: FormData) {
  const user = await requirePermission("request.create");
  const input = validatedRequest(formJson(form, "payload"));
  if (!canAccessCompany(user, input.companyId)) throw new Error("Company access denied");
  const attested = form.get("attested") === "true";
  const submit = form.get("intent") === "submit";
  if (submit && !attested) throw new Error("Requester attestation is required");
  if (submit && (await requiredDocumentCategories(input.natureOfPaymentCode)).length) throw new Error("Save the draft, upload the required supporting documents, then submit from Edit / resubmit");
  const result = await db.$transaction(async (tx) => {
    const sequence = await tx.numberSequence.upsert({ where: { companyId_kind_periodKey: { companyId: input.companyId, kind: "DRAFT", periodKey: new Date().getUTCFullYear().toString() } }, create: { companyId: input.companyId, kind: "DRAFT", prefix: "IAP", resetPeriod: "ANNUAL", periodKey: new Date().getUTCFullYear().toString(), nextValue: 2 }, update: { nextValue: { increment: 1 } } });
    const draftIdentifier = `IAP-${new Date().getUTCFullYear()}-${String(sequence.nextValue - 1).padStart(6, "0")}`;
    const payment = await tx.natureOfPayment.findUniqueOrThrow({ where: { code: input.natureOfPaymentCode } });
    const request = await tx.request.create({ data: { draftIdentifier, companyId: input.companyId, requesterId: user.id, createdById: user.id, payeeId: input.payeeId, natureOfPaymentId: payment.id, paymentOtherText: input.paymentOtherText, requestDate: input.requestDate, currency: input.currency, totalAmount: input.calculatedTotal, conditionalData: input.conditionalData as object, status: "DRAFT", lines: { create: input.lines.map((line, position) => ({ position, projectCodeId: line.projectCodeId, accountId: line.accountId || null, particulars: line.particulars, amount: line.amount })) } } });
    await tx.requestVersion.create({ data: { requestId: request.id, version: 1, reason: "Created", snapshot: { ...input, requesterName: user.name } as object } });
    await tx.statusHistory.create({ data: { requestId: request.id, toStatus: "DRAFT", actorId: user.id, requestVersion: 1, reason: "Created" } });
    await audit(tx, { requestId: request.id, actorId: user.id, action: "REQUEST_CREATED", entityType: "Request", entityId: request.id, after: { draftIdentifier, total: input.calculatedTotal } });
    if (!submit) return request;
    const number = await tx.numberSequence.upsert({ where: { companyId_kind_periodKey: { companyId: input.companyId, kind: "REQUEST", periodKey: new Date().getUTCFullYear().toString() } }, create: { companyId: input.companyId, kind: "REQUEST", prefix: "RFP", resetPeriod: "ANNUAL", periodKey: new Date().getUTCFullYear().toString(), nextValue: 2 }, update: { nextValue: { increment: 1 } } });
    const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId } });
    const requestNumber = `RFP-${company.code}-${new Date().getUTCFullYear()}-${String(number.nextValue - 1).padStart(6, "0")}`;
    const approver = await tx.user.findFirstOrThrow({ where: { active: true, roles: { some: { role: { code: "APPROVER" }, OR: [{ companyId: input.companyId }, { companyId: null }] } } } });
    const stage = await tx.approvalStage.findFirstOrThrow({ where: { workflow: { companyId: input.companyId, active: true }, key: "MANAGER" } });
    await tx.request.update({ where: { id: request.id }, data: { requestNumber, status: "PENDING_MANAGER_APPROVAL", submittedAt: new Date(), lockVersion: { increment: 1 } } });
    await tx.requestAttestation.create({ data: { requestId: request.id, userId: user.id, type: "REQUESTER", text: requesterText, textVersion: "1.0", requestVersion: 1, sessionIdHash: createHash("sha256").update(`${user.id}:${Date.now()}`).digest("hex") } });
    await tx.approvalAssignment.create({ data: { requestId: request.id, stageId: stage.id, approverId: approver.id, requestVersion: 1, dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
    await tx.statusHistory.create({ data: { requestId: request.id, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER_APPROVAL", actorId: user.id, requestVersion: 1 } });
    await audit(tx, { requestId: request.id, actorId: user.id, action: "REQUEST_SUBMITTED", entityType: "Request", entityId: request.id, after: { requestNumber, approverId: approver.id } });
    return request;
  }, { isolationLevel: "Serializable" });
  revalidatePath("/requests"); redirect(`/requests/${result.id}`);
}

export async function updateDraftAction(form: FormData) {
  const user = await requirePermission("request.create"); const requestId = String(form.get("requestId")); const input = validatedRequest(formJson(form, "payload")); const submit = form.get("intent") === "submit"; const attested = form.get("attested") === "true";
  if (!canAccessCompany(user, input.companyId)) throw new Error("Company access denied");
  if (submit && !attested) throw new Error("Requester attestation is required");
  if (submit) { const required = await requiredDocumentCategories(input.natureOfPaymentCode); const allowedScan = process.env.MOCK_MALWARE_SCANNER === "true" ? ["CLEAN","PENDING"] as const : ["CLEAN"] as const; const attached = await db.supportingDocument.findMany({ where: { requestId, deletedAt: null, scanStatus: { in: [...allowedScan] } }, select: { category: true } }); const available = new Set(attached.map((doc) => doc.category)); const missing = required.filter((category) => !available.has(category)); if (missing.length) throw new Error(`Missing or unscanned required documents: ${missing.join(", ")}`); }
  await db.$transaction(async (tx) => {
    const existing = await tx.request.findUniqueOrThrow({ where: { id: requestId }, include: { lines: true } });
    if (existing.requesterId !== user.id && !user.roles.includes("ADMIN")) throw new Error("Only the requester may edit this draft");
    if (!["DRAFT","RETURNED_FOR_REVISION","RETURNED_BY_AP"].includes(existing.status)) throw new Error("This request is not editable");
    const nextVersion = existing.currentVersion + 1; let requestNumber = existing.requestNumber;
    if (submit && !requestNumber) { const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId } }); const sequence = await tx.numberSequence.upsert({ where: { companyId_kind_periodKey: { companyId: input.companyId, kind: "REQUEST", periodKey: new Date().getUTCFullYear().toString() } }, create: { companyId: input.companyId, kind: "REQUEST", prefix: "RFP", resetPeriod: "ANNUAL", periodKey: new Date().getUTCFullYear().toString(), nextValue: 2 }, update: { nextValue: { increment: 1 } } }); requestNumber = `RFP-${company.code}-${new Date().getUTCFullYear()}-${String(sequence.nextValue - 1).padStart(6, "0")}`; }
    const payment = await tx.natureOfPayment.findUniqueOrThrow({ where: { code: input.natureOfPaymentCode } });
    await tx.requestLine.deleteMany({ where: { requestId } });
    await tx.approvalAssignment.updateMany({ where: { requestId, completedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.request.update({ where: { id: requestId }, data: { companyId: input.companyId, payeeId: input.payeeId, natureOfPaymentId: payment.id, paymentOtherText: input.paymentOtherText, requestDate: input.requestDate, currency: input.currency, totalAmount: input.calculatedTotal, conditionalData: input.conditionalData as object, currentVersion: nextVersion, lockVersion: { increment: 1 }, requestNumber, status: submit ? "PENDING_MANAGER_APPROVAL" : existing.status, submittedAt: submit ? new Date() : existing.submittedAt, lines: { create: input.lines.map((line, position) => ({ position, projectCodeId: line.projectCodeId, accountId: line.accountId || null, particulars: line.particulars, amount: line.amount })) } } });
    await tx.requestVersion.create({ data: { requestId, version: nextVersion, reason: submit ? "Revised and resubmitted" : "Draft edited", snapshot: { ...input, requesterName: user.name } as object } });
    await audit(tx, { requestId, actorId: user.id, action: submit ? "REQUEST_RESUBMITTED" : "DRAFT_UPDATED", entityType: "Request", entityId: requestId, before: { version: existing.currentVersion, total: existing.totalAmount.toString() }, after: { version: nextVersion, total: input.calculatedTotal } });
    if (submit) { const stage = await tx.approvalStage.findFirstOrThrow({ where: { workflow: { companyId: input.companyId, active: true }, key: "MANAGER" } }); const approver = await tx.user.findFirstOrThrow({ where: { active: true, id: { not: existing.requesterId }, roles: { some: { role: { code: "APPROVER" }, OR: [{ companyId: input.companyId }, { companyId: null }] } } } }); await tx.requestAttestation.create({ data: { requestId, userId: user.id, type: "REQUESTER", text: requesterText, textVersion: "1.0", requestVersion: nextVersion, sessionIdHash: createHash("sha256").update(`${user.id}:${Date.now()}`).digest("hex") } }); await tx.approvalAssignment.create({ data: { requestId, stageId: stage.id, approverId: approver.id, requestVersion: nextVersion, dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }); await tx.statusHistory.create({ data: { requestId, fromStatus: existing.status, toStatus: "PENDING_MANAGER_APPROVAL", actorId: user.id, requestVersion: nextVersion, reason: "Version-aware resubmission" } }); }
  }, { isolationLevel: "Serializable" });
  revalidatePath(`/requests/${requestId}`); redirect(`/requests/${requestId}`);
}

export async function copyRequestAction(form: FormData) {
  const user = await requireRole("REQUESTER", "ADMIN"); const sourceId = String(form.get("requestId")); const source = await db.request.findUniqueOrThrow({ where: { id: sourceId }, include: { lines: true } });
  if (source.requesterId !== user.id && !user.roles.includes("ADMIN")) throw new Error("Access denied");
  const seq = await db.numberSequence.upsert({ where: { companyId_kind_periodKey: { companyId: source.companyId, kind: "DRAFT", periodKey: new Date().getUTCFullYear().toString() } }, create: { companyId: source.companyId, kind: "DRAFT", prefix: "IAP", resetPeriod: "ANNUAL", periodKey: new Date().getUTCFullYear().toString(), nextValue: 2 }, update: { nextValue: { increment: 1 } } });
  const copy = await db.request.create({ data: { draftIdentifier: `IAP-${new Date().getUTCFullYear()}-${String(seq.nextValue - 1).padStart(6,"0")}`, companyId: source.companyId, requesterId: user.id, createdById: user.id, departmentId: source.departmentId, payeeId: source.payeeId, natureOfPaymentId: source.natureOfPaymentId, paymentOtherText: source.paymentOtherText, requestDate: new Date(), currency: source.currency, totalAmount: source.totalAmount, conditionalData: source.conditionalData ?? undefined, lines: { create: source.lines.map((line) => ({ position: line.position, projectCodeId: line.projectCodeId, projectCodeText: line.projectCodeText, accountId: line.accountId, accountText: line.accountText, particulars: line.particulars, amount: line.amount })) }, versions: { create: { version: 1, reason: `Copied from ${source.requestNumber ?? source.draftIdentifier}`, snapshot: { sourceId } } } } });
  await db.auditEvent.create({ data: { requestId: copy.id, actorId: user.id, action: "REQUEST_COPIED", entityType: "Request", entityId: copy.id, metadata: { sourceId } } }); redirect(`/requests/${copy.id}/edit`);
}

export async function confirmManualPostingAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "AP_REVIEWER", "ADMIN"); const requestId = String(form.get("requestId")); const transactionId = String(form.get("transactionId")); const apvNumber = String(form.get("apvNumber"));
  const request = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { qbExports: true, assignments: true } }); if (!canReadRequest(user, request)) throw new Error("Company access denied"); if (!request.qbExports.length) throw new Error("Generate and review QuickBooks input first"); assertTransition(request.status as Status, "POSTED_TO_QUICKBOOKS", user.roles);
  await db.$transaction(async (tx) => { const posting = await tx.quickBooksPosting.create({ data: { requestId, externalTransactionId: transactionId, manual: true, postingDate: new Date(String(form.get("postingDate"))), total: request.totalAmount, evidenceStorageKey: String(form.get("evidenceReference")), postedById: user.id, result: "MANUAL_CONFIRMED" } }); await tx.request.update({ where: { id: requestId }, data: { apvNumber, status: "POSTED_TO_QUICKBOOKS" } }); await audit(tx, { requestId, actorId: user.id, action: "QUICKBOOKS_POSTING_CONFIRMED", entityType: "QuickBooksPosting", entityId: posting.id, after: { transactionId, apvNumber, total: request.totalAmount.toString() } }); }); revalidatePath(`/requests/${requestId}`);
}

export async function adjustAccountingLineAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "AP_REVIEWER", "ADMIN"); const requestId = String(form.get("requestId")); const lineId = String(form.get("lineId")); const reason = String(form.get("reason") ?? "").trim(); if (!reason) throw new Error("Adjustment reason is required");
  const authorizedRequest = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { assignments: true } }); if (!canReadRequest(user, authorizedRequest)) throw new Error("Company access denied");
  await db.$transaction(async (tx) => { const line = await tx.requestLine.findUniqueOrThrow({ where: { id: lineId } }); if (line.requestId !== requestId) throw new Error("Line does not belong to request"); const nextProject = String(form.get("projectCodeId") ?? "") || null; const nextAccount = String(form.get("accountId") ?? "") || null; await tx.requestLine.update({ where: { id: lineId }, data: { adjustedProjectCodeId: nextProject, adjustedAccountId: nextAccount } }); for (const [field, oldValue, newValue] of [["projectCodeId",line.projectCodeId,nextProject],["accountId",line.accountId,nextAccount]] as const) if (oldValue !== newValue) await tx.accountingAdjustment.create({ data: { requestId, lineId, field, oldValue, newValue, reason, changedById: user.id, requiresApproval: user.roles.includes("AP_PROCESSOR") } }); await audit(tx, { requestId, actorId: user.id, action: "ACCOUNTING_LINE_ADJUSTED", entityType: "RequestLine", entityId: lineId, before: { projectCodeId: line.projectCodeId, accountId: line.accountId }, after: { projectCodeId: nextProject, accountId: nextAccount }, metadata: { reason } }); }); revalidatePath(`/requests/${requestId}`);
}

export async function decisionAction(form: FormData) {
  const user = await requireRole("APPROVER", "ADMIN");
  const requestId = String(form.get("requestId"));
  const decision = String(form.get("decision")) as "APPROVED" | "RETURNED" | "REJECTED";
  const comment = String(form.get("comment") ?? "");
  const attested = form.get("attested") === "true";
  if (decision === "APPROVED" && !attested) throw new Error("Approver attestation is required");
  const to = decision === "APPROVED" ? "MANAGER_APPROVED" : decision === "RETURNED" ? "RETURNED_FOR_REVISION" : "REJECTED";
  await db.$transaction(async (tx) => {
    const request = await tx.request.findUniqueOrThrow({ where: { id: requestId }, include: { assignments: { where: { approverId: user.id, completedAt: null, invalidatedAt: null } } } });
    if (request.requesterId === user.id) throw new Error("Self-approval is prohibited");
    if (!request.assignments.length && !user.roles.includes("ADMIN")) throw new Error("This request is not assigned to you");
    assertTransition(request.status as Status, to, user.roles, comment);
    const assignment = request.assignments[0] ?? await tx.approvalAssignment.findFirstOrThrow({ where: { requestId, completedAt: null } });
    await tx.approvalDecision.create({ data: { assignmentId: assignment.id, requestId, approverId: user.id, decision, comment: comment || null, attestationText: decision === "APPROVED" ? approverText : null, attestationVersion: decision === "APPROVED" ? "1.0" : null, requestVersion: request.currentVersion } });
    await tx.approvalAssignment.update({ where: { id: assignment.id }, data: { completedAt: new Date() } });
    await tx.request.update({ where: { id: requestId }, data: { status: to } });
    await tx.statusHistory.create({ data: { requestId, fromStatus: request.status, toStatus: to, actorId: user.id, requestVersion: request.currentVersion, reason: comment || null } });
    await audit(tx, { requestId, actorId: user.id, action: `APPROVAL_${decision}`, entityType: "Request", entityId: requestId, metadata: { comment } });
  });
  revalidatePath(`/requests/${requestId}`); revalidatePath("/approvals");
}

export async function transitionAction(form: FormData) {
  const user = await requireUser(); const requestId = String(form.get("requestId")); const to = String(form.get("to")) as Status; const comment = String(form.get("comment") ?? "");
  await db.$transaction(async (tx) => {
    const request = await tx.request.findUniqueOrThrow({ where: { id: requestId }, include: { assignments: true } });
    if (!canReadRequest(user, request)) throw new Error("Record-level access denied");
    assertTransition(request.status as Status, to, user.roles, comment);
    if (request.requesterId !== user.id && user.roles.every((r) => !["ADMIN","AP_PROCESSOR","AP_REVIEWER"].includes(r))) throw new Error("Record-level access denied");
    await tx.request.update({ where: { id: requestId }, data: { status: to } });
    await tx.statusHistory.create({ data: { requestId, fromStatus: request.status, toStatus: to, actorId: user.id, requestVersion: request.currentVersion, reason: comment || null } });
    await audit(tx, { requestId, actorId: user.id, action: "STATUS_TRANSITION", entityType: "Request", entityId: requestId, before: { status: request.status }, after: { status: to }, metadata: { comment } });
  });
  revalidatePath(`/requests/${requestId}`);
}

export async function generatePdfAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "ADMIN"); const requestId = String(form.get("requestId"));
  const record = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { company: { include: { branding: true } }, requester: true, payee: true, natureOfPayment: true, lines: { include: { projectCode: true, account: true, adjustedProjectCode: true, adjustedAccount: true }, orderBy: { position: "asc" } }, attestations: { include: { user: true }, orderBy: { createdAt: "desc" } }, decisions: { where: { decision: "APPROVED" }, include: { approver: true }, orderBy: { createdAt: "desc" } } } });
  if (!canReadRequest(user, record)) throw new Error("Access denied");
  if (!record.requestNumber) throw new Error("Permanent request number is required");
  const version = (await db.generatedDocument.aggregate({ where: { requestId, type: "RFP" }, _max: { version: true } }))._max.version ?? 0;
  const generated = await generateRequestPdf({ company: { name: record.company.branding?.legalDisplayName ?? record.company.name, address: record.company.branding?.address ?? "", telephone: record.company.branding?.telephone ?? "", fax: record.company.branding?.fax }, requestNumber: record.requestNumber, invoiceNumber: record.invoiceNumber, version: version + 1, status: record.status, date: record.requestDate.toISOString().slice(0, 10), requester: record.requester.fullName, payee: record.payee.displayName, currency: record.currency, natureOfPayment: record.natureOfPayment.displayLabel, paymentOtherText: record.paymentOtherText, lines: record.lines.map((line) => ({ projectCode: line.adjustedProjectCode?.code ?? line.projectCode?.code ?? line.projectCodeText ?? "", account: line.adjustedAccount?.name ?? line.account?.name ?? line.accountText ?? "", particulars: line.particulars, amount: line.amount.toFixed(2) })), totalAmount: record.totalAmount.toFixed(2), requesterAttestation: record.attestations[0] ? { name: record.attestations[0].user.fullName, at: record.attestations[0].createdAt.toISOString() } : null, approverAttestation: record.decisions[0] ? { name: record.decisions[0].approver.fullName, at: record.decisions[0].createdAt.toISOString(), status: "Approved" } : null, confidential: record.confidentiality !== "INTERNAL", generatedAt: new Date().toISOString() });
  const stored = await new LocalRepositoryAdapter().put({ requestId, category: "generated", originalFilename: `${record.requestNumber}-v${version + 1}.pdf`, bytes: generated.bytes, expectedHash: generated.sha256 });
  await db.generatedDocument.create({ data: { requestId, type: "RFP", version: version + 1, storageKey: stored.storageKey, sha256: generated.sha256, requestVersion: record.currentVersion, generatedById: user.id } });
  await db.auditEvent.create({ data: { requestId, actorId: user.id, action: "PDF_GENERATED", entityType: "GeneratedDocument", entityId: stored.storageKey, metadata: { sha256: generated.sha256, pages: generated.pageCount } } });
  revalidatePath(`/requests/${requestId}`);
}

export async function quickBooksAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "AP_REVIEWER"); const requestId = String(form.get("requestId"));
  const record = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { company: true, payee: true, lines: { include: { projectCode: true, account: true, adjustedProjectCode: true, adjustedAccount: true } } } });
  if (!canAccessCompany(user, record.companyId)) throw new Error("Company access denied");
  if (!record.requestNumber) throw new Error("Request number missing");
  const output = generateQuickBooksCsv({ requestNumber: record.requestNumber, company: record.company.name, payee: record.payee.displayName, date: record.requestDate.toISOString().slice(0, 10), currency: record.currency, total: record.totalAmount.toString(), lines: record.lines.map((line) => ({ account: line.adjustedAccount?.code ?? line.account?.code ?? "", projectCode: line.adjustedProjectCode?.code ?? line.projectCode?.code ?? "", memo: line.particulars, amount: line.amount.toString(), class: line.qbClass ?? undefined, department: line.departmentCode ?? undefined, taxCode: line.taxCode ?? undefined })) });
  const version = (await db.quickBooksExport.aggregate({ where: { requestId }, _max: { version: true } }))._max.version ?? 0;
  const stored = await new LocalRepositoryAdapter().put({ requestId, category: "quickbooks", originalFilename: `${record.requestNumber}-qb-v${version + 1}.csv`, bytes: new TextEncoder().encode(output.csv), expectedHash: output.checksum });
  await db.quickBooksExport.create({ data: { requestId, version: version + 1, format: "CSV", storageKey: stored.storageKey, checksum: output.checksum, total: record.totalAmount, generatedById: user.id } });
  await db.auditEvent.create({ data: { requestId, actorId: user.id, action: "QUICKBOOKS_EXPORT_GENERATED", entityType: "QuickBooksExport", entityId: stored.storageKey, metadata: { checksum: output.checksum } } });
  revalidatePath(`/requests/${requestId}`);
}

export async function uploadDocumentAction(form: FormData) {
  const user = await requirePermission("document.upload"); const requestId = String(form.get("requestId")); const category = String(form.get("category") ?? "OTHER"); const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Select a file");
  validateUpload(file, Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024));
  const request = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { assignments: true } });
  if (!canReadRequest(user, request)) throw new Error("Access denied");
  const bytes = new Uint8Array(await file.arrayBuffer()); const sha256 = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await db.supportingDocument.findFirst({ where: { requestId, sha256, deletedAt: null } }); if (duplicate) throw new Error("This document is already attached");
  const stored = await new LocalRepositoryAdapter().put({ requestId, category: "supporting", originalFilename: file.name, bytes, expectedHash: sha256 });
  await db.$transaction(async (tx) => {
    const doc = await tx.supportingDocument.create({ data: { requestId, category, originalFilename: file.name, safeFilename: stored.storageKey.split("/").at(-1)!, storageKey: stored.storageKey, mimeType: file.type, sizeBytes: file.size, sha256, scanStatus: process.env.MOCK_MALWARE_SCANNER === "true" ? "CLEAN" : "PENDING", uploadedById: user.id } });
    await tx.documentVersion.create({ data: { documentId: doc.id, version: 1, storageKey: stored.storageKey, sha256, sizeBytes: file.size } });
    await audit(tx, { requestId, actorId: user.id, action: "DOCUMENT_UPLOADED", entityType: "SupportingDocument", entityId: doc.id, after: { category, filename: file.name, sha256 } });
  });
  revalidatePath(`/requests/${requestId}`);
}

export async function recordPaymentAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "ADMIN"); const requestId = String(form.get("requestId")); const amount = String(form.get("amount")); const method = String(form.get("method")); const reference = String(form.get("reference"));
  const request = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { qbPostings: true, payments: true, assignments: true } }); if (!canReadRequest(user, request)) throw new Error("Company access denied"); if (!request.qbPostings.length) throw new Error("Posting must be confirmed before payment");
  await db.$transaction(async (tx) => { const payment = await tx.payment.create({ data: { requestId, amount, status: "PAID", method, reference, paidAt: new Date(), processedById: user.id } }); await audit(tx, { requestId, actorId: user.id, action: "PAYMENT_RECORDED", entityType: "Payment", entityId: payment.id, after: { amount, method, reference } }); });
  revalidatePath(`/requests/${requestId}`); revalidatePath("/payments");
}

export async function reconcileAction(form: FormData) {
  const user = await requireRole("AP_PROCESSOR", "AP_REVIEWER", "ADMIN"); const requestId = String(form.get("requestId"));
  const request = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { qbPostings: true, payments: true, assignments: true } }); if (!canReadRequest(user, request)) throw new Error("Company access denied"); if (!request.qbPostings[0]) throw new Error("Posting is required");
  const paid = request.payments.filter((p) => p.status === "PAID").reduce((x, p) => x.plus(p.amount), new (await import("decimal.js")).default(0)); const settled = String(form.get("settledAmount")); const variance = new (await import("decimal.js")).default(settled).minus(request.totalAmount);
  await db.$transaction(async (tx) => { const rec = await tx.reconciliation.upsert({ where: { requestId }, create: { requestId, bankReference: String(form.get("bankReference")), settlementDate: new Date(String(form.get("settlementDate"))), requestedAmount: request.totalAmount, postedAmount: request.qbPostings[0].total, paidAmount: paid.toString(), settledAmount: settled, variance: variance.toString(), varianceReason: String(form.get("varianceReason") ?? "") || null, reconciledById: user.id, approvedAt: variance.isZero() ? new Date() : null }, update: { bankReference: String(form.get("bankReference")), settledAmount: settled, variance: variance.toString(), varianceReason: String(form.get("varianceReason") ?? "") || null, reconciledById: user.id } }); await audit(tx, { requestId, actorId: user.id, action: "RECONCILIATION_RECORDED", entityType: "Reconciliation", entityId: rec.id, after: { settled, variance: variance.toString() } }); });
  revalidatePath(`/requests/${requestId}`); revalidatePath("/reconciliation");
}

export async function updateDraftMaterialChange(changedFields: string[]) { return invalidatesApproval(changedFields); }
