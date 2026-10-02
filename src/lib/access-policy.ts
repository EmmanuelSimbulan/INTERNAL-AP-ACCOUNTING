import { canAccessCompany, hasPermission, type RbacUser } from "./rbac";

export function canReadRequest(user: RbacUser, record: { requesterId: string; companyId: string; assignments?: { approverId: string; invalidatedAt?: Date | null }[]; confidentiality?: string }) {
  if (user.roles.includes("ADMIN")) return true;
  if (hasPermission(user, "request.read.own") && record.requesterId === user.id) return true;
  if (hasPermission(user, "request.read.assigned") && record.assignments?.some((item) => item.approverId === user.id && !item.invalidatedAt)) return true;
  if (hasPermission(user, "request.read.company") && canAccessCompany(user, record.companyId)) {
    if (record.confidentiality === "RESTRICTED_PAYROLL" && !user.roles.some((role) => ["AP_REVIEWER", "ADMIN", "AUDITOR"].includes(role))) return false;
    return true;
  }
  return false;
}
