import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { demoProfiles } from "@/lib/demo-profiles";
import { createDefaultPrototypeWorkflowControl } from "@/lib/prototype-workflow";
import {
  escapePrototypeCsvCell,
  previewPrototypeConfigImport,
  prototypeConfigDefinitions,
  prototypeConfigImportValues,
  type PrototypeConfigType,
} from "@/lib/prototype-config-import";

export const dynamic = "force-dynamic";

const configTypeSchema = z.enum(["projects", "accounts", "payees", "natureOfPayments"]);
const currencySchema = z.enum(["PHP", "USD", "BOTH"]);
const masterDataSchema = z.object({
  projects: z.array(z.string()).default([]),
  accounts: z.array(z.string()).default([]),
  accountProjectCodes: z.record(z.string(), z.array(z.string())).optional(),
  payees: z.array(z.string()).default([]),
  vendorCurrencies: z.record(z.string(), currencySchema).optional().default({}),
  natureOfPayments: z.array(z.string()).default([]),
  workflows: z.record(z.string(), z.unknown()).optional().default({}),
});
const importSchema = z.object({
  profileId: z.string().min(1),
  type: configTypeSchema,
  action: z.enum(["preview", "commit"]),
  csv: z.string().min(1).max(1_500_000),
});

function isAuthorized(profileId: string) {
  const profile = demoProfiles.find((item) => item.id === profileId);
  return profile?.role === "Administrator";
}

function readMasterData(value: unknown) {
  const parsed = masterDataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function valuesFor(masterData: z.infer<typeof masterDataSchema>, type: PrototypeConfigType) {
  return masterData[type];
}

function csvResponse(type: PrototypeConfigType, masterData: z.infer<typeof masterDataSchema>) {
  const headers = prototypeConfigDefinitions[type].headers;
  const rows = valuesFor(masterData, type).map((value) => {
    if (type === "payees") return [value, masterData.vendorCurrencies[value] ?? "BOTH"];
    if (type === "accounts") return [value, (masterData.accountProjectCodes?.[value] ?? (masterData.accountProjectCodes ? [] : masterData.projects)).join(", ")];
    return [value];
  });
  const csv = [headers, ...rows].map((row) => row.map(escapePrototypeCsvCell).join(",")).join("\r\n") + "\r\n";
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-settings.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId") ?? "";
  const type = configTypeSchema.safeParse(url.searchParams.get("type"));
  if (!isAuthorized(profileId)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  if (!type.success) return NextResponse.json({ error: "Unknown configuration type" }, { status: 400 });
  const workspace = await db.prototypeWorkspace.findUnique({ where: { id: "default" }, select: { masterData: true } });
  const masterData = readMasterData(workspace?.masterData);
  if (!masterData) return NextResponse.json({ error: "Saved configuration data is not available. Reload Settings after the workspace has synced." }, { status: 409 });
  const profile = demoProfiles.find((item) => item.id === profileId);
  const actor = profile ? await db.user.findUnique({ where: { email: profile.email }, select: { id: true } }) : null;
  await db.auditEvent.create({ data: {
    actorId: actor?.id,
    action: "PROTOTYPE_CONFIGURATION_EXPORTED",
    entityType: "PrototypeConfiguration",
    entityId: type.data,
    metadata: { recordCount: valuesFor(masterData, type.data).length },
  } });
  return csvResponse(type.data, masterData);
}

export async function POST(request: Request) {
  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid import request", issues: parsed.error.issues }, { status: 400 });
  const { profileId, type, action, csv } = parsed.data;
  if (!isAuthorized(profileId)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  if (action === "preview") {
    const workspace = await db.prototypeWorkspace.findUnique({ where: { id: "default" }, select: { masterData: true } });
    const masterData = readMasterData(workspace?.masterData);
    if (!masterData) return NextResponse.json({ error: "Saved configuration data is not available. Reload Settings after the workspace has synced." }, { status: 409 });
    return NextResponse.json(previewPrototypeConfigImport(type, csv, valuesFor(masterData, type), masterData.projects), { headers: { "Cache-Control": "no-store" } });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await db.$transaction(async (tx) => {
        const workspace = await tx.prototypeWorkspace.findUnique({ where: { id: "default" } });
        const masterData = readMasterData(workspace?.masterData);
        if (!workspace || !masterData) throw new Error("CONFIGURATION_NOT_SYNCED");
        const { preview, values, projectCodesByValue } = prototypeConfigImportValues(type, csv, valuesFor(masterData, type), masterData.projects);
        const additions = [...values.entries()];
        if (!additions.length) return { preview, importedRecords: 0, masterData };

        const updated = { ...masterData };
        if (type === "payees") {
          updated.payees = [...masterData.payees, ...additions.map(([name]) => name)];
          updated.vendorCurrencies = { ...masterData.vendorCurrencies, ...Object.fromEntries(additions) };
        } else if (type === "projects") updated.projects = [...masterData.projects, ...additions.map(([name]) => name)];
        else if (type === "accounts") {
          updated.accounts = [...masterData.accounts, ...additions.map(([name]) => name)];
          const existingMappings = masterData.accountProjectCodes ?? Object.fromEntries(masterData.accounts.map((account) => [account, [...masterData.projects]]));
          updated.accountProjectCodes = { ...existingMappings, ...Object.fromEntries(additions.map(([name]) => [name, projectCodesByValue.get(name) ?? []])) };
        }
        else {
          updated.natureOfPayments = [...masterData.natureOfPayments, ...additions.map(([name]) => name)];
          updated.workflows = { ...masterData.workflows, ...Object.fromEntries(additions.map(([name]) => [name, createDefaultPrototypeWorkflowControl()])) };
        }
        await tx.prototypeWorkspace.update({ where: { id: "default" }, data: { masterData: updated as unknown as Prisma.InputJsonValue } });
        const profile = demoProfiles.find((item) => item.id === profileId);
        const actor = profile ? await tx.user.findUnique({ where: { email: profile.email }, select: { id: true } }) : null;
        await tx.auditEvent.create({ data: {
          actorId: actor?.id,
          action: "PROTOTYPE_CONFIGURATION_IMPORTED",
          entityType: "PrototypeConfiguration",
          entityId: type,
          before: { recordCount: valuesFor(masterData, type).length },
          after: { importedRecords: additions.length, records: additions.map(([name]) => name) },
        } });
        return { preview, importedRecords: additions.length, masterData: updated };
      }, { isolationLevel: "Serializable" });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof Error && error.message === "CONFIGURATION_NOT_SYNCED") {
        return NextResponse.json({ error: "Saved configuration data is not available. Reload Settings after the workspace has synced." }, { status: 409 });
      }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2034" || attempt === 2) throw error;
    }
  }
  return NextResponse.json({ error: "Could not import these settings. Please retry." }, { status: 409 });
}
