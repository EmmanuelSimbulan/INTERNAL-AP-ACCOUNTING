import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { SimpleRegister } from "@/components/SimpleRegister";
import { requestReadScope } from "@/lib/rbac";

export default async function Payments() {
  const user = await requirePermission("request.payment.manage", "request.accounting.review", "request.audit");
  const rows = await db.payment.findMany({ where: { request: requestReadScope(user) }, include: { request: true }, orderBy: { createdAt: "desc" } });
  return <SimpleRegister eyebrow="Treasury evidence" title="Payment Queue" description="Scheduled, processing, paid, failed and reversed payment records." rows={rows.map((payment) => ({ id: payment.id, reference: payment.reference ?? payment.id, detail: `${payment.request.requestNumber} · ${payment.request.currency} ${payment.amount.toFixed(2)} · ${payment.method}`, status: payment.status, href: `/requests/${payment.requestId}` }))}/>;
}
