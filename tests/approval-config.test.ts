import { describe, expect, it } from "vitest";
import { approvalPlanSnapshot, approvalStatusForStage, initialApprovalStatus, postApprovalStatus, readApprovalPlanSnapshot, type ApprovalPlan } from "@/lib/approval-config";

const plan: ApprovalPlan = {
  workflowId: "workflow-1",
  stageKeys: ["MANAGER", "ACCOUNTING"],
  stages: [
    { id: "manager-stage", key: "MANAGER", name: "Manager Approval", requiredRole: "APPROVER" },
    { id: "accounting-stage", key: "ACCOUNTING", name: "Accounting Review", requiredRole: "AP_REVIEWER" }
  ],
  requireApValidation: true,
  slaHours: 24
};

describe("approval workflow configuration", () => {
  it("routes requests to the first configured stage", () => {
    expect(initialApprovalStatus(plan)).toBe("PENDING_MANAGER_APPROVAL");
    expect(approvalStatusForStage("ACCOUNTING")).toBe("PENDING_ACCOUNTING_REVIEW");
  });

  it("routes requests after the final approval according to AP validation control", () => {
    expect(postApprovalStatus(true)).toBe("PENDING_AP_VALIDATION");
    expect(postApprovalStatus(false)).toBe("READY_FOR_DOCUMENT_GENERATION");
  });

  it("round-trips the immutable workflow snapshot", () => {
    const snapshot = { approvalPlan: approvalPlanSnapshot(plan) };
    expect(readApprovalPlanSnapshot(snapshot)).toEqual({ workflowId: "workflow-1", stageKeys: ["MANAGER", "ACCOUNTING"], requireApValidation: true, slaHours: 24 });
  });
});
