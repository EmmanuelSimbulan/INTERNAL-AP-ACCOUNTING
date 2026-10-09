import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { demoProfiles } from "@/lib/demo-profiles";

export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  company: z.string().trim().min(1).max(300).optional(),
  payee: z.string().trim().min(1).max(300).optional(),
  nature: z.string().trim().min(1).max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoiceNumber: z.string().trim().max(200).optional(),
}).strict().refine((fields) => Object.keys(fields).length > 0, "Choose at least one field to update.");

const bulkEditSchema = z.object({
  profileId: z.string().min(1),
  requestIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  fields: fieldsSchema,
  reason: z.string().trim().min(1).max(500),
}).refine((input) => new Set(input.requestIds).size === input.requestIds.length, "Remove duplicate requests from the selection.");

type StoredRequest = Record<string, unknown> & {
  id: string;
  company?: string;
  payee?: string;
  nature?: string;
  date?: string;
  invoiceNumber?: string;
  currency?: string;
  timeline?: string[];
};

const canBulkEdit = (role: string) => ["Administrator", "AP Reviewer", "AP Processor"].includes(role);
function isStoredRequest(row: unknown): row is StoredRequest {
  return Boolean(row && typeof row === "object" && "id" in row && typeof row.id === "string");
}

function validCalendarDate(value: string) {
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function PATCH(request: Request) {
  const parsed = bulkEditSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid bulk edit." }, { status: 400 });
  }
  const profile = demoProfiles.find((item) => item.id === parsed.data.profileId);
  if (!profile || !canBulkEdit(profile.role)) {
    return NextResponse.json({ error: "Only Administrators, AP Reviewers, and AP Processors can bulk edit requests." }, { status: 403 });
  }
  if (parsed.data.fields.date && !validCalendarDate(parsed.data.fields.date)) {
    return NextResponse.json({ error: "Enter a valid request date." }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const workspace = await tx.prototypeWorkspace.findUnique({ where: { id: "default" } });
      if (!workspace) return { error: "The shared request workspace is unavailable." as const };
      const rawRows: unknown[] = Array.isArray(workspace.requests) ? workspace.requests as unknown[] : [];
      const rows = rawRows.filter(isStoredRequest);
      const selected = rows.filter((row) => parsed.data.requestIds.includes(row.id));
      if (selected.length !== parsed.data.requestIds.length) return { error: "One or more selected requests no longer exist. Refresh the Requests page." as const };

      const masterData = workspace.masterData && typeof workspace.masterData === "object" && !Array.isArray(workspace.masterData)
        ? workspace.masterData as Record<string, unknown>
        : {};
      const payees = Array.isArray(masterData.payees) ? masterData.payees.filter((value): value is string => typeof value === "string") : [];
      const natures = Array.isArray(masterData.natureOfPayments) ? masterData.natureOfPayments.filter((value): value is string => typeof value === "string") : [];
      const companies = new Set(rows.map((row) => row.company).filter((value): value is string => typeof value === "string" && Boolean(value)));
      const currencies = masterData.vendorCurrencies && typeof masterData.vendorCurrencies === "object" && !Array.isArray(masterData.vendorCurrencies)
        ? masterData.vendorCurrencies as Record<string, unknown>
        : {};
      const fields = parsed.data.fields;
      if (fields.company && !companies.has(fields.company)) return { error: "Choose a company already configured in the workspace." as const };
      if (fields.payee && !payees.includes(fields.payee)) return { error: "Choose a vendor from the configured vendor list." as const };
      if (fields.nature && natures.length && !natures.includes(fields.nature)) return { error: "Choose a Nature of Payment from the configured list." as const };
      for (const row of selected) {
        if (fields.payee) {
          const vendorCurrency = currencies[fields.payee];
          if (vendorCurrency && vendorCurrency !== "BOTH" && vendorCurrency !== row.currency) {
            return { error: fields.payee + " is not configured for " + (row.currency ?? "this") + " currency." };
          }
        }
      }

      const actor = await tx.user.findUnique({ where: { email: profile.email }, select: { id: true } });
      const updatedRows: StoredRequest[] = rows.map((row): StoredRequest => {
        if (!parsed.data.requestIds.includes(row.id)) return row;
        const changes: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(fields)) changes[field] = field === "invoiceNumber" && !value ? undefined : value;
        const next: StoredRequest = { ...row, ...changes, timeline: [...(row.timeline ?? []), profile.role + " bulk edited request · " + parsed.data.reason].slice(-300) };
        if (fields.invoiceNumber === "") delete next.invoiceNumber;
        return next;
      });
      const updates = selected.flatMap((before) => {
        const after = updatedRows.find((row) => row.id === before.id);
        if (!after) return [];
        const changedFields = Object.keys(fields).filter((field) => before[field] !== after[field]);
        if (!changedFields.length) return [];
        const summary = (row: StoredRequest) => Object.fromEntries(changedFields.map((field) => [field, row[field] ?? null]));
        return [{
          actorId: actor?.id,
          action: "PROTOTYPE_REQUEST_BULK_EDITED",
          entityType: "PrototypeRequest",
          entityId: before.id,
          before: summary(before) as Prisma.InputJsonValue,
          after: summary(after) as Prisma.InputJsonValue,
          metadata: { role: profile.role, reason: parsed.data.reason, fields: changedFields, operation: "bulk_edit" } as Prisma.InputJsonValue,
        }];
      });
      if (!updates.length) return { updatedAt: workspace.updatedAt, requests: selected, updatedCount: 0 };
      await tx.auditEvent.createMany({ data: updates });
      const savedWorkspace = await tx.prototypeWorkspace.update({
        where: { id: "default" },
        data: { requests: updatedRows as unknown as Prisma.InputJsonValue },
        select: { updatedAt: true },
      });
      return {
        updatedAt: savedWorkspace.updatedAt,
        requests: updatedRows.filter((row) => parsed.data.requestIds.includes(row.id)),
        updatedCount: updates.length,
      };
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 15_000 });
    if ("error" in result && typeof result.error === "string") return NextResponse.json({ error: result.error }, { status: result.error.includes("unavailable") ? 503 : 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Prototype bulk request edit failed", error);
    return NextResponse.json({ error: "Could not save the bulk edit. Your requests were not changed; please retry." }, { status: 500 });
  }
}
