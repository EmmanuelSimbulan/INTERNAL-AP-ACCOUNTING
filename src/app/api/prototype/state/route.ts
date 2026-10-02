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
});
const masterDataSchema = z.object({
  projects: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
  accounts: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
  payees: z.array(z.string().trim().min(1).max(300)).min(1).max(1_000),
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
  const saved = await db.prototypeWorkspace.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      requests: parsed.data.rows,
      masterData,
    },
    update: {
      requests: parsed.data.rows,
      masterData,
    },
    select: { updatedAt: true },
  });
  return NextResponse.json(saved);
}
