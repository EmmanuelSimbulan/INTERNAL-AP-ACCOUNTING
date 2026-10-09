import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { demoProfiles } from "@/lib/demo-profiles";
import { accountIsApplicable } from "@/lib/prototype-project-account";
import { verifyBspUsdPhpRate } from "@/lib/bsp-fx";

export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().max(120),
  dataUrl: z.string().max(2_000_000).optional(),
});
const lineSchema = z.object({
  project: z.string().max(200),
  account: z.string().max(200),
  particulars: z.string().max(2_000),
  amount: z.string().max(80),
});
const requestSchema = z.object({
  id: z.string().min(1).max(100),
  number: z.string().max(200),
  requester: z.string().max(200),
  payee: z.string().max(300),
  company: z.string().max(300),
  date: z.string().max(40),
  currency: z.string().max(10),
  fxRate: z.string().regex(/^\d{1,3}(?:,\d{3})*(?:\.\d{1,8})?$/).optional(),
  fxRateDate: z.string().date().optional(),
  fxRateSource: z.string().url().refine((value) => new URL(value).hostname === "www.bsp.gov.ph", "FX source must be BSP").optional(),
  fxRateRetrievedAt: z.string().datetime().optional(),
  fxRateSignature: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  nature: z.string().max(500),
  other: z.string().max(500),
  status: z.string().max(100),
  invoiceNumber: z.string().max(200).optional(),
  lines: z.array(lineSchema).max(50),
  documents: z.array(attachmentSchema).max(30),
  timeline: z.array(z.string().max(1_000)).max(300),
  qbId: z.string().max(200).optional(),
  paymentRef: z.string().max(200).optional(),
  reconciliationRef: z.string().max(200).optional(),
  approvalPlan: z.array(z.enum(["Manager Approval", "Accounting Review", "AP Validation"])).max(12).optional(),
  approvalStep: z.number().int().min(0).max(12).optional(),
  requireApValidation: z.boolean().optional(),
  statusHistory: z.array(z.object({
    status: z.string().max(100),
    approvalPlan: z.array(z.enum(["Manager Approval", "Accounting Review", "AP Validation"])).max(12).optional(),
    approvalStep: z.number().int().min(0).max(12).optional(),
    requireApValidation: z.boolean().optional(),
    qbId: z.string().max(200).optional(),
    paymentRef: z.string().max(200).optional(),
    reconciliationRef: z.string().max(200).optional(),
    event: z.string().max(1_000),
  })).max(25).optional(),
});
const workflowControlSchema = z.object({
  managerApproval: z.boolean(),
  accountingReview: z.boolean(),
  accountingThreshold: z.string().max(80),
  requireApValidation: z.boolean(),
  slaHours: z.number().int().min(1).max(720),
  diagram: z.object({
    nodes: z.array(z.object({ id: z.string().min(1).max(100), role: z.enum(["request", "manager", "accounting", "apProcessor", "apReviewer", "treasury", "recipient", "quickbooks"]).optional(), x: z.number().min(0).max(900), y: z.number().min(0).max(420) })).min(2).max(50),
    edges: z.array(z.object({ from: z.string().min(1).max(100), to: z.string().min(1).max(100), condition: z.enum(["ALWAYS", "AMOUNT_GTE_THRESHOLD", "AMOUNT_LT_THRESHOLD"]).default("ALWAYS") })).max(100),
  }),
});
const masterDataSchema = z.object({
  projects: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
  accounts: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
  accountProjectCodes: z.record(z.string().max(200), z.array(z.string().trim().min(1).max(200)).max(500)).optional(),
  payees: z.array(z.string().trim().min(1).max(300)).min(1).max(1_000),
  vendorCurrencies: z.record(z.string().max(300), z.enum(["PHP", "USD", "BOTH"])).optional().default({}),
  natureOfPayments: z.array(z.string().trim().min(1).max(500)).min(1).max(200).optional(),
  workflows: z.record(z.string(), workflowControlSchema).optional().default({}),
}).superRefine((data, context) => {
  for (const [account, codes] of Object.entries(data.accountProjectCodes ?? {})) {
    if (!data.accounts.includes(account)) context.addIssue({ code: "custom", message: `Project mapping references unknown account: ${account}` });
    for (const code of codes) if (!data.projects.includes(code)) context.addIssue({ code: "custom", message: `Project mapping references unknown Project Code: ${code}` });
  }
});
const stateSchema = z.object({
  profileId: z.string(),
  rows: z.array(requestSchema).max(1_000),
  masterData: masterDataSchema,
});

function databaseUnavailable(error: unknown) {
  console.error("Prototype workspace database request failed", error);
  const message = error instanceof Error ? error.message : String(error);
  const quotaExceeded = /quota/i.test(message);
  return NextResponse.json({
    code: quotaExceeded ? "DATABASE_QUOTA_EXCEEDED" : "DATABASE_UNAVAILABLE",
    error: quotaExceeded
      ? "The shared Neon database has reached its plan quota. Saved data is intact. The Neon project owner must restore quota or upgrade the plan; resetting the database will not resolve a quota limit."
      : "The shared database cannot currently be reached. Saved data has not changed. Ask the Neon project owner to check quota and compute status, then retry; resetting the database will not fix a connection issue.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function requestAuditSummary(row: z.infer<typeof requestSchema>) {
  return {
    number: row.number,
    status: row.status,
    company: row.company,
    payee: row.payee,
    currency: row.currency,
    fxRate: row.fxRate ?? null,
    fxRateDate: row.fxRateDate ?? null,
    fxRateSource: row.fxRateSource ?? null,
    nature: row.nature,
    invoiceNumber: row.invoiceNumber ?? null,
    total: row.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    lines: row.lines.map(({ project, account, particulars, amount }) => ({ project, account, particulars, amount })),
    supportingDocumentCount: row.documents.length,
  };
}

export async function GET() {
  try {
    const workspace = await db.prototypeWorkspace.findUnique({
      where: { id: "default" },
      select: { requests: true, masterData: true, updatedAt: true },
    });
    return NextResponse.json(workspace ?? null, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return databaseUnavailable(error);
  }
}

export async function PUT(request: Request) {
  const parsed = stateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prototype state", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
  const profile = demoProfiles.find((item) => item.id === parsed.data.profileId);
  if (!profile) return NextResponse.json({ error: "Unknown profile" }, { status: 403 });

  const existing = await db.prototypeWorkspace.findUnique({ where: { id: "default" } });
  if (profile.role === "Auditor" && existing) {
    return NextResponse.json({ error: "Auditor access is read-only" }, { status: 403 });
  }
  let saved;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      saved = await db.$transaction(async (tx) => {
        const current = await tx.prototypeWorkspace.findUnique({ where: { id: "default" } });
        const existingMasterData = masterDataSchema.safeParse(current?.masterData);
        const masterData = profile.role === "Administrator" || !existingMasterData.success
          ? parsed.data.masterData
          : existingMasterData.data;
        const currentRows = Array.isArray(current?.requests) ? current.requests : [];
        const rowsById = new Map<string, (typeof parsed.data.rows)[number]>();
        for (const row of currentRows) {
          if (row && typeof row === "object" && "id" in row && typeof row.id === "string") {
            rowsById.set(row.id, row as (typeof parsed.data.rows)[number]);
          }
        }
        const baselineRows = new Map(rowsById);
        for (const row of parsed.data.rows) {
          const previous = baselineRows.get(row.id);
          const fxSnapshotChanged = !previous || previous.currency !== "USD" || JSON.stringify([previous.fxRate, previous.fxRateDate, previous.fxRateSource, previous.fxRateRetrievedAt, previous.fxRateSignature]) !== JSON.stringify([row.fxRate, row.fxRateDate, row.fxRateSource, row.fxRateRetrievedAt, row.fxRateSignature]);
          if (row.currency === "USD" && fxSnapshotChanged) {
            if (!row.fxRate || Number(row.fxRate) <= 0 || !row.fxRateDate || !row.fxRateSource || !row.fxRateRetrievedAt || !row.fxRateSignature || !verifyBspUsdPhpRate({ rate: row.fxRate, effectiveDate: row.fxRateDate, source: row.fxRateSource, retrievedAt: row.fxRateRetrievedAt, signature: row.fxRateSignature })) {
              throw new Error(`USD_RATE_REQUIRED:${row.number}`);
            }
          }
          const priorPairCounts = new Map<string, number>();
          for (const line of previous?.lines ?? []) {
            const key = JSON.stringify([line.project, line.account]);
            priorPairCounts.set(key, (priorPairCounts.get(key) ?? 0) + 1);
          }
          for (const [index, line] of row.lines.entries()) {
            if (!line.account) continue;
            const pairKey = JSON.stringify([line.project, line.account]);
            const priorCount = priorPairCounts.get(pairKey) ?? 0;
            const pairAlreadyPresent = priorCount > 0;
            if (pairAlreadyPresent) priorPairCounts.set(pairKey, priorCount - 1);
            const changedPair = !pairAlreadyPresent;
            if (changedPair && !accountIsApplicable(line.project, line.account, masterData.accountProjectCodes, !masterData.accountProjectCodes)) {
              throw new Error(`INVALID_ACCOUNT_PROJECT:${JSON.stringify({ lineNumber: index + 1, account: line.account, project: line.project })}`);
            }
          }
        }
        const changedRequests = parsed.data.rows.flatMap((row) => {
          const before = baselineRows.get(row.id);
          if (before && JSON.stringify(before) === JSON.stringify(row)) return [];
          rowsById.set(row.id, row);
          return [{ before, after: row }];
        });
        const configSections = ["projects", "accounts", "accountProjectCodes", "payees", "vendorCurrencies", "natureOfPayments", "workflows"] as const;
        const changedConfigSections = profile.role === "Administrator"
          ? configSections.filter((section) => JSON.stringify(existingMasterData.success ? existingMasterData.data[section] : undefined) !== JSON.stringify(parsed.data.masterData[section]))
          : [];
        const hasChanges = !current || changedRequests.length > 0 || changedConfigSections.length > 0;
        if (!hasChanges && current) return { updatedAt: current.updatedAt, changed: false };
        const actor = await tx.user.findUnique({ where: { email: profile.email }, select: { id: true } });
        const auditEvents: Prisma.AuditEventCreateManyInput[] = [];
        for (const change of changedRequests) {
          const request = change.after;
          const previous = change.before;
          const isStatusChange = previous?.status !== undefined && previous.status !== request.status;
          auditEvents.push({
            actorId: actor?.id,
            action: previous ? (isStatusChange ? "PROTOTYPE_REQUEST_STATUS_CHANGED" : "PROTOTYPE_REQUEST_UPDATED") : "PROTOTYPE_REQUEST_CREATED",
            entityType: "PrototypeRequest",
            entityId: request.id,
            before: previous ? requestAuditSummary(previous) as Prisma.InputJsonValue : undefined,
            after: requestAuditSummary(request) as Prisma.InputJsonValue,
          });
        }
        for (const section of changedConfigSections) {
          auditEvents.push({
            actorId: actor?.id,
            action: "PROTOTYPE_CONFIGURATION_UPDATED",
            entityType: "PrototypeConfiguration",
            entityId: section,
            before: { values: existingMasterData.success ? existingMasterData.data[section] ?? {} : {} } as Prisma.InputJsonValue,
            after: { values: parsed.data.masterData[section] ?? {} } as Prisma.InputJsonValue,
          });
        }
        if (auditEvents.length) await tx.auditEvent.createMany({ data: auditEvents });
        const savedWorkspace = await tx.prototypeWorkspace.upsert({
          where: { id: "default" },
          create: { id: "default", requests: Array.from(rowsById.values()), masterData },
          update: { requests: Array.from(rowsById.values()), masterData },
          select: { updatedAt: true },
        });
        return { ...savedWorkspace, changed: true };
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 15_000 });
      break;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_ACCOUNT_PROJECT:")) {
        const details = JSON.parse(error.message.slice("INVALID_ACCOUNT_PROJECT:".length)) as { lineNumber: number; account: string; project: string };
        return NextResponse.json({ error: `${details.account} is not configured for Project Code ${details.project} (line ${details.lineNumber}).` }, { status: 400 });
      }
      if (error instanceof Error && error.message.startsWith("USD_RATE_REQUIRED:")) {
        return NextResponse.json({ error: "A valid server-verified BSP USD/PHP conversion rate and effective date are required for new or changed USD requests." }, { status: 400 });
      }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2034" || attempt === 2) throw error;
    }
  }
  return NextResponse.json(saved);
  } catch (error) {
    return databaseUnavailable(error);
  }
}
