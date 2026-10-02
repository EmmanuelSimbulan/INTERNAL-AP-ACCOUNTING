import Link from "next/link";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requestReadScope } from "@/lib/rbac";

export default async function Dashboard() {
  const user = await requireUser();
  const where = requestReadScope(user);
  const [total, pending, returned, paid, recent] = await Promise.all([
    db.request.count({ where }), db.request.count({ where: { ...where, status: { in: ["PENDING_MANAGER_APPROVAL","PENDING_AP_VALIDATION","PENDING_ACCOUNTING_REVIEW"] } } }),
    db.request.count({ where: { ...where, status: { in: ["RETURNED_FOR_REVISION","RETURNED_BY_AP"] } } }), db.request.count({ where: { ...where, status: { in: ["PAID","RECONCILED","CLOSED"] } } }),
    db.request.findMany({ where, include: { company: true, payee: true }, orderBy: { updatedAt: "desc" }, take: 8 })
  ]);
  return <><div className="topbar"><div><span className="eyebrow">Role-aware overview</span><h1>Good day, {user.name?.split(" ")[0]}</h1><p className="muted">Requests, approvals, accounting and payment work in one controlled flow.</p></div><Link className="button" href="/requests/new">+ New request</Link></div><div className="grid grid-4"><Metric label="All requests" value={total}/><Metric label="Awaiting action" value={pending}/><Metric label="Returned" value={returned}/><Metric label="Paid / closed" value={paid}/></div><section className="section card"><div className="form-head"><h2>Recent requests</h2><Link href="/requests">View all →</Link></div>{recent.length ? <div className="table-wrap"><table><thead><tr><th>Request</th><th>Company</th><th>Payee</th><th>Total</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recent.map((row) => <tr key={row.id}><td><Link href={`/requests/${row.id}`}><strong>{row.requestNumber ?? row.draftIdentifier}</strong></Link></td><td>{row.company.code}</td><td>{row.payee.displayName}</td><td>{row.currency} {row.totalAmount.toFixed(2)}</td><td><span className="badge">{row.status.replaceAll("_", " ")}</span></td><td>{row.updatedAt.toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="empty">No requests yet.</div>}</section></>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="card metric"><small>{label}</small><strong>{value}</strong></div>; }
