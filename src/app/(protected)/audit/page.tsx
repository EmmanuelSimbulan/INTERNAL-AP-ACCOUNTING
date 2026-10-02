import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { requestReadScope } from "@/lib/rbac";

export default async function Audit() {
  const user = await requirePermission("request.audit", "admin.manage");
  const rows = await db.auditEvent.findMany({ where: user.roles.includes("ADMIN") ? {} : { OR: [{ request: requestReadScope(user) }, { requestId: null }] }, include: { actor: true, request: true }, orderBy: { createdAt: "desc" }, take: 250 });
  return <><span className="eyebrow">Immutable event stream</span><h1>Audit Log Viewer</h1><p className="muted">Audit events are append-only; the application exposes no update or delete action.</p><div className="table-wrap section"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Request</th></tr></thead><tbody>{rows.map((event) => <tr key={event.id}><td>{event.createdAt.toLocaleString()}</td><td>{event.actor?.fullName ?? "System"}</td><td><strong>{event.action}</strong></td><td>{event.entityType} · {event.entityId.slice(0, 12)}</td><td>{event.request?.requestNumber ?? "—"}</td></tr>)}</tbody></table></div></>;
}
