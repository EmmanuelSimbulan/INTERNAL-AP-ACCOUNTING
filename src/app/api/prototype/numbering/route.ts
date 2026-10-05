import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCompanyNumberingRule } from "@/lib/company-numbering";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  company: z.string().min(1).max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["preview", "allocate"]),
});

function periodKey(date: string, reset: "Annual" | "Monthly") {
  return reset === "Monthly" ? date.slice(0, 7) : date.slice(0, 4);
}

function render(pattern: string, date: string, sequence: number) {
  return pattern
    .replace("{YEAR}", date.slice(0, 4))
    .replace("{MONTH}", date.slice(5, 7))
    .replace("{SEQ}", String(sequence).padStart(6, "0"));
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid numbering request" }, { status: 400 });

  const { company: companyName, date, action } = parsed.data;
  const rule = getCompanyNumberingRule(companyName);
  const existingCompany = await db.company.findFirst({
    where: { name: { equals: rule.name, mode: "insensitive" } },
    select: { id: true },
  });
  const company = existingCompany ?? await db.company.upsert({
    where: { code: rule.code },
    create: { code: rule.code, name: rule.name },
    update: {},
    select: { id: true },
  });

  const key = periodKey(date, rule.reset);
  const makeResult = (requestSequence: number, invoiceSequence: number) => ({
    requestNumber: render(rule.requestPattern, date, requestSequence),
    invoiceNumber: render(rule.invoicePattern, date, invoiceSequence),
  });

  if (action === "preview") {
    const [requestSequence, invoiceSequence] = await Promise.all([
      db.numberSequence.findUnique({ where: { companyId_kind_periodKey: { companyId: company.id, kind: "PROTOTYPE_REQUEST", periodKey: key } }, select: { nextValue: true } }),
      db.numberSequence.findUnique({ where: { companyId_kind_periodKey: { companyId: company.id, kind: "PROTOTYPE_INVOICE", periodKey: key } }, select: { nextValue: true } }),
    ]);
    return NextResponse.json(makeResult(requestSequence?.nextValue ?? 1, invoiceSequence?.nextValue ?? 1), { headers: { "Cache-Control": "no-store" } });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const numbers = await db.$transaction(async (tx) => {
        const [requestSequence, invoiceSequence] = await Promise.all([
          tx.numberSequence.upsert({
            where: { companyId_kind_periodKey: { companyId: company.id, kind: "PROTOTYPE_REQUEST", periodKey: key } },
            create: { companyId: company.id, kind: "PROTOTYPE_REQUEST", prefix: rule.code, resetPeriod: rule.reset.toUpperCase(), periodKey: key, nextValue: 2 },
            update: { nextValue: { increment: 1 } },
          }),
          tx.numberSequence.upsert({
            where: { companyId_kind_periodKey: { companyId: company.id, kind: "PROTOTYPE_INVOICE", periodKey: key } },
            create: { companyId: company.id, kind: "PROTOTYPE_INVOICE", prefix: rule.code, resetPeriod: rule.reset.toUpperCase(), periodKey: key, nextValue: 2 },
            update: { nextValue: { increment: 1 } },
          }),
        ]);
        return makeResult(requestSequence.nextValue - 1, invoiceSequence.nextValue - 1);
      }, { isolationLevel: "Serializable" });
      return NextResponse.json(numbers, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "P2034" && attempt < 2) continue;
      console.error("Unable to allocate prototype request numbers", error);
      return NextResponse.json({ error: "Could not allocate request numbers. Please try again." }, { status: 503 });
    }
  }
  return NextResponse.json({ error: "Could not allocate request numbers. Please try again." }, { status: 503 });
}
