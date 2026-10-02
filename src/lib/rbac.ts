export const permissionCodes = [
  "request.create",
  "request.read.own",
  "request.read.assigned",
  "request.read.company",
  "request.approve",
  "request.ap.process",
  "request.accounting.review",
  "request.payment.manage",
  "request.reconcile",
  "request.audit",
  "admin.manage",
  "document.download",
  "document.upload",
  "report.view",
  "report.export",
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const rolePermissions = {
  REQUESTER: ["request.create", "request.read.own", "document.download", "document.upload"],
  APPROVER: ["request.read.assigned", "request.approve", "document.download", "document.upload", "report.view"],
  AP_PROCESSOR: ["request.read.company", "request.ap.process", "request.payment.manage", "request.reconcile", "document.download", "document.upload", "report.view", "report.export"],
  AP_REVIEWER: ["request.read.company", "request.accounting.review", "request.reconcile", "document.download", "document.upload", "report.view", "report.export"],
  ADMIN: [...permissionCodes],
  AUDITOR: ["request.read.company", "request.audit", "document.download", "report.view", "report.export"],
} as const satisfies Record<string, readonly PermissionCode[]>;

export type RbacUser = {
  id: string;
  roles: string[];
  permissions?: string[];
  companyIds: string[];
};

export function permissionsForRoles(roles: string[]): PermissionCode[] {
  return [...new Set(roles.flatMap((role) => rolePermissions[role as keyof typeof rolePermissions] ?? []))];
}

export function hasPermission(user: Pick<RbacUser, "roles" | "permissions">, permission: PermissionCode) {
  // The role fallback keeps old sessions usable immediately after an RBAC deployment.
  const effective = user.permissions?.length ? user.permissions : permissionsForRoles(user.roles);
  return effective.includes(permission);
}

export function canAccessCompany(user: RbacUser, companyId: string) {
  return user.roles.includes("ADMIN") || user.companyIds.length === 0 || user.companyIds.includes(companyId);
}

export function requestReadScope(user: RbacUser) {
  if (user.roles.includes("ADMIN")) return {};
  if (hasPermission(user, "request.read.company")) {
    return user.companyIds.length ? { companyId: { in: user.companyIds } } : {};
  }
  if (hasPermission(user, "request.read.assigned")) {
    return { assignments: { some: { approverId: user.id, invalidatedAt: null } } };
  }
  return { requesterId: user.id };
}
