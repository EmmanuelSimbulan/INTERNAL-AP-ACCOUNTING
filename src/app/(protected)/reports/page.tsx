import Link from "next/link";
import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { hasPermission, requestReadScope } from "@/lib/rbac";

export default async function Reports({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("report.view");
  const { q } = await searchParams;
  const scope = requestReadScope(user);
  const rows = await db.request.findMany({ where: { ...scope, ...(q ? { OR: [{ requestNumber: { contains: q, mode: "insensitive" } }, { invoiceNumber: { contains: q, mode: "insensitive" } }, { apvNumber: { contains: q, mode: "insensitive" } }, { payee: { displayName: { contains: q, mode: "insensitive" } } }, { lines: { some: { particulars: { contains: q, mode: "insensitive" } } } }] } : {}) }, include: { company: true, payee: true, natureOfPayment: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return <><span className="eyebrow">Permission-aware reporting</span><h1>Global Search & Reports</h1><form className="card actions"><input name="q" defaultValue={q} placeholder="Request, invoice, APV, payee, particulars"/><button className="button">Search</button>{hasPermission(user, "report.export") && <a className="button secondary" href={`/api/reports/requests.csv?q=${encodeURIComponent(q ?? "")}`}>Export CSV</a>}</form><div className="table-wrap section"><table><thead><tr><th>Request</th><th>Company</th><th>Payee</th><th>Nature</th><th>Value</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/requests/${row.id}`}><strong>{row.requestNumber ?? row.draftIdentifier}</strong></Link></td><td>{row.company.code}</td><td>{row.payee.displayName}</td><td>{row.natureOfPayment.displayLabel}</td><td>{row.currency} {row.totalAmount.toFixed(2)}</td><td><span className="badge">{row.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></>;
}
