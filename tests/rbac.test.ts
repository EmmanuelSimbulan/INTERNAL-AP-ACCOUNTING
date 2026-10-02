import { describe, expect, it } from "vitest";
import { canAccessCompany, hasPermission, permissionsForRoles, requestReadScope } from "@/lib/rbac";

describe("RBAC permission matrix", () => {
  it("keeps the auditor read-only", () => {
    const permissions = permissionsForRoles(["AUDITOR"]);
    expect(permissions).toContain("request.audit");
    expect(permissions).toContain("report.export");
    expect(permissions).not.toContain("request.create");
    expect(permissions).not.toContain("document.upload");
  });

  it("grants administrators every registered permission", () => {
    expect(hasPermission({ roles: ["ADMIN"] }, "admin.manage")).toBe(true);
    expect(hasPermission({ roles: ["ADMIN"] }, "request.payment.manage")).toBe(true);
  });

  it("scopes approvers to assignments and finance users to their companies", () => {
    expect(requestReadScope({ id: "approver", roles: ["APPROVER"], companyIds: ["svi"] })).toEqual({ assignments: { some: { approverId: "approver", invalidatedAt: null } } });
    expect(requestReadScope({ id: "ap", roles: ["AP_PROCESSOR"], companyIds: ["svi"] })).toEqual({ companyId: { in: ["svi"] } });
    expect(canAccessCompany({ id: "ap", roles: ["AP_PROCESSOR"], companyIds: ["svi"] }, "other")).toBe(false);
  });
});
