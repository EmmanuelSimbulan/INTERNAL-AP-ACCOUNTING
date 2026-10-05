import { describe, expect, it } from "vitest";
import { clonePrototypeDiagram, resolvePrototypeApproval, type PrototypeWorkflowControl } from "@/lib/prototype-workflow";

const configured: PrototypeWorkflowControl = { managerApproval: true, accountingReview: true, accountingThreshold: "100,000", requireApValidation: true, slaHours: 48, diagram: clonePrototypeDiagram() };

describe("prototype workflow controls", () => {
  it("applies accounting review when the configured threshold is reached", () => {
    const result = resolvePrototypeApproval("Consultancy Fee", 125000, { "Consultancy Fee": configured });
    expect(result.approvalPlan).toEqual(["Manager Approval", "AP Validation", "Accounting Review"]);
    expect(result.status).toBe("Pending Manager Approval");
  });

  it("skips accounting review below the configured threshold", () => {
    const result = resolvePrototypeApproval("Consultancy Fee", 50000, { "Consultancy Fee": configured });
    expect(result.approvalPlan).toEqual(["Manager Approval", "AP Validation"]);
  });

  it("supports direct AP routing when approval stages are disabled", () => {
    const result = resolvePrototypeApproval("Fund Transfer", 50000, { "Fund Transfer": { ...configured, managerApproval: false, accountingReview: false } });
    expect(result.status).toBe("Pending AP Validation");
  });

  it("uses the connected diagram order for approval stages", () => {
    const diagram = clonePrototypeDiagram();
    diagram.edges = [{ from: "request", to: "accounting", condition: "ALWAYS" }, { from: "accounting", to: "manager", condition: "ALWAYS" }, { from: "manager", to: "ap", condition: "ALWAYS" }, { from: "ap", to: "quickbooks", condition: "ALWAYS" }];
    const result = resolvePrototypeApproval("Consultancy Fee", 125000, { "Consultancy Fee": { ...configured, diagram } });
    expect(result.approvalPlan).toEqual(["Accounting Review", "Manager Approval", "AP Validation"]);
    expect(result.status).toBe("Pending Accounting Review");
  });

  it("selects different next steps from conditional arrows", () => {
    const diagram = clonePrototypeDiagram();
    diagram.edges = [
      { from: "request", to: "manager", condition: "ALWAYS" },
      { from: "manager", to: "accounting", condition: "AMOUNT_GTE_THRESHOLD" },
      { from: "manager", to: "ap", condition: "AMOUNT_LT_THRESHOLD" },
      { from: "accounting", to: "ap", condition: "ALWAYS" },
      { from: "ap", to: "quickbooks", condition: "ALWAYS" },
    ];
    const high = resolvePrototypeApproval("Consultancy Fee", 125000, { "Consultancy Fee": { ...configured, diagram } });
    const low = resolvePrototypeApproval("Consultancy Fee", 50000, { "Consultancy Fee": { ...configured, diagram } });
    expect(high.approvalPlan).toEqual(["Manager Approval", "Accounting Review", "AP Validation"]);
    expect(low.approvalPlan).toEqual(["Manager Approval", "AP Validation"]);
  });

  it("executes self and backward connections as one bounded loop pass", () => {
    const selfDiagram = clonePrototypeDiagram();
    selfDiagram.edges = [{ from: "request", to: "manager", condition: "ALWAYS" }, { from: "manager", to: "manager", condition: "ALWAYS" }];
    expect(resolvePrototypeApproval("Consultancy Fee", 125000, { "Consultancy Fee": { ...configured, diagram: selfDiagram } }).approvalPlan).toEqual(["Manager Approval", "Manager Approval", "AP Validation"]);

    const backDiagram = clonePrototypeDiagram();
    backDiagram.edges = [{ from: "request", to: "manager", condition: "ALWAYS" }, { from: "manager", to: "accounting", condition: "ALWAYS" }, { from: "accounting", to: "manager", condition: "ALWAYS" }];
    expect(resolvePrototypeApproval("Consultancy Fee", 125000, { "Consultancy Fee": { ...configured, diagram: backDiagram } }).approvalPlan).toEqual(["Manager Approval", "Accounting Review", "Manager Approval", "AP Validation"]);
  });
});
