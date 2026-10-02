import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, requestReadScope } from "@/lib/rbac";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user, "report.export")) return new Response("Forbidden", { status: 403 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const rows = await db.request.findMany({ where: { ...requestReadScope(session.user), ...(q ? { OR: [{ requestNumber: { contains: q, mode: "insensitive" } }, { payee: { displayName: { contains: q, mode: "insensitive" } } }] } : {}) }, include: { company: true, payee: true, natureOfPayment: true }, take: 5000 });
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [["Request", "Company", "Payee", "Nature", "Currency", "Total", "Status", "Date"], ...rows.map((row) => [row.requestNumber ?? row.draftIdentifier, row.company.name, row.payee.displayName, row.natureOfPayment.displayLabel, row.currency, row.totalAmount.toString(), row.status, row.requestDate.toISOString().slice(0, 10)])].map((values) => values.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=request-report.csv", "Cache-Control": "no-store" } });
}
