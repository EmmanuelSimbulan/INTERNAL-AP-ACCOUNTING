import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { demoProfiles } from "@/lib/demo-profiles";

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
  payees: z.array(z.string().trim().min(1).max(300)).min(1).max(1_000),
  natureOfPayments: z.array(z.string().trim().min(1).max(500)).min(1).max(200).optional(),
  workflows: z.record(z.string(), workflowControlSchema).optional().default({}),
});
const stateSchema = z.object({
  profileId: z.string(),
  rows: z.array(requestSchema).max(1_000),
  masterData: masterDataSchema,
});

export async function GET() {
  const workspace = await db.prototypeWorkspace.findUnique({
    where: { id: "default" },
    select: { requests: true, masterData: true, updatedAt: true },
  });
  return NextResponse.json(workspace ?? null, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const parsed = stateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prototype state", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const profile = demoProfiles.find((item) => item.id === parsed.data.profileId);
  if (!profile) return NextResponse.json({ error: "Unknown profile" }, { status: 403 });

  const existing = await db.prototypeWorkspace.findUnique({ where: { id: "default" } });
  if (profile.role === "Auditor" && existing) {
    return NextResponse.json({ error: "Auditor access is read-only" }, { status: 403 });
  }
  const existingMasterData = masterDataSchema.safeParse(existing?.masterData);
  const masterData =
    profile.role === "Administrator" || !existingMasterData.success
      ? parsed.data.masterData
      : existingMasterData.data;
  let saved;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      saved = await db.$transaction(async (tx) => {
        const current = await tx.prototypeWorkspace.findUnique({ where: { id: "default" } });
        const currentRows = Array.isArray(current?.requests) ? current.requests : [];
        const rowsById = new Map<string, (typeof parsed.data.rows)[number]>();
        for (const row of currentRows) {
          if (row && typeof row === "object" && "id" in row && typeof row.id === "string") {
            rowsById.set(row.id, row as (typeof parsed.data.rows)[number]);
          }
        }
        for (const row of parsed.data.rows) rowsById.set(row.id, row);
        return tx.prototypeWorkspace.upsert({
          where: { id: "default" },
          create: { id: "default", requests: Array.from(rowsById.values()), masterData },
          update: { requests: Array.from(rowsById.values()), masterData },
          select: { updatedAt: true },
        });
      }, { isolationLevel: "Serializable" });
      break;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2034" || attempt === 2) throw error;
    }
  }
  return NextResponse.json(saved);
}
