import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { SimpleRegister } from "@/components/SimpleRegister";
import { requestReadScope } from "@/lib/rbac";

export default async function Reconciliation() {
  const user = await requirePermission("request.reconcile", "request.audit");
  const rows = await db.reconciliation.findMany({ where: { request: requestReadScope(user) }, include: { request: true }, orderBy: { createdAt: "desc" } });
  return <SimpleRegister eyebrow="Financial control" title="Reconciliation Queue" description="Requested, posted, paid and settled amounts with approved variance evidence." rows={rows.map((row) => ({ id: row.id, reference: row.request.requestNumber ?? row.id, detail: `Settled ${row.settledAmount.toFixed(2)} · Variance ${row.variance.toFixed(2)}`, status: row.approvedAt ? "RECONCILED" : "REVIEW_REQUIRED", href: `/requests/${row.requestId}` }))}/>;
}
