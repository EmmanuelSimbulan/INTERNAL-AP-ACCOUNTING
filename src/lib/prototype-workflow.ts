export type PrototypeWorkflowNodeRole = "request" | "manager" | "accounting" | "apProcessor" | "apReviewer" | "treasury" | "recipient" | "quickbooks";
export type PrototypeWorkflowNodeId = string;
export type PrototypeBranchCondition = "ALWAYS" | "AMOUNT_GTE_THRESHOLD" | "AMOUNT_LT_THRESHOLD";
export type PrototypeWorkflowDiagram = {
  nodes: { id: PrototypeWorkflowNodeId; role?: PrototypeWorkflowNodeRole; x: number; y: number }[];
  edges: { from: PrototypeWorkflowNodeId; to: PrototypeWorkflowNodeId; condition: PrototypeBranchCondition }[];
};

export type PrototypeWorkflowControl = {
  managerApproval: boolean;
  accountingReview: boolean;
  accountingThreshold: string;
  requireApValidation: boolean;
  slaHours: number;
  diagram: PrototypeWorkflowDiagram;
};

export type PrototypeApprovalStage = "Manager Approval" | "Accounting Review" | "AP Validation";

export const defaultPrototypeDiagram: PrototypeWorkflowDiagram = {
  nodes: [
    { id: "request", x: 28, y: 160 },
    { id: "manager", role: "manager", x: 165, y: 55 },
    { id: "ap", role: "apProcessor", x: 320, y: 185 },
    { id: "accounting", role: "accounting", x: 475, y: 55 },
    { id: "ap-final", role: "apProcessor", x: 630, y: 185 },
    { id: "quickbooks", role: "quickbooks", x: 755, y: 55 },
  ],
  edges: [
    { from: "request", to: "manager", condition: "ALWAYS" },
    { from: "manager", to: "ap", condition: "ALWAYS" },
    { from: "ap", to: "accounting", condition: "ALWAYS" },
    { from: "accounting", to: "ap-final", condition: "ALWAYS" },
    { from: "ap-final", to: "quickbooks", condition: "ALWAYS" },
  ],
};

export function clonePrototypeDiagram(): PrototypeWorkflowDiagram {
  return { nodes: defaultPrototypeDiagram.nodes.map((node) => ({ ...node })), edges: defaultPrototypeDiagram.edges.map((edge) => ({ ...edge })) };
}

export function normalizePrototypeDiagram(diagram?: PrototypeWorkflowDiagram): PrototypeWorkflowDiagram {
  if (!diagram?.nodes?.length) return clonePrototypeDiagram();
  const legacyRole = (id: string): PrototypeWorkflowNodeRole => id === "ap" ? "apProcessor" : ["request", "manager", "accounting", "quickbooks"].includes(id) ? id as PrototypeWorkflowNodeRole : "apProcessor";
  return { nodes: diagram.nodes.map((node) => ({ ...node, role: node.role ?? legacyRole(node.id) })), edges: (diagram.edges ?? []).map((edge) => ({ ...edge, condition: edge.condition ?? "ALWAYS" })) };
}

export function tracePrototypeDiagram(control: PrototypeWorkflowControl, amount: number) {
  const diagram = normalizePrototypeDiagram(control.diagram);
  const edges = diagram.edges;
  const threshold = Number(control.accountingThreshold.replaceAll(",", ""));
  const steps: PrototypeWorkflowNodeRole[] = [];
  const visited = new Set<PrototypeWorkflowNodeId>();
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  let current: PrototypeWorkflowNodeId = "request";
  let loopDetected = false;
  while (steps.length < 12) {
    if (visited.has(current)) { steps.push(nodeById.get(current)?.role ?? "apProcessor"); loopDetected = true; break; }
    visited.add(current);
    steps.push(nodeById.get(current)?.role ?? "apProcessor");
    if (nodeById.get(current)?.role === "quickbooks") break;
    const outgoing = edges.filter((edge) => edge.from === current);
    const conditional = outgoing.find((edge) => edge.condition === "AMOUNT_GTE_THRESHOLD" && Number.isFinite(threshold) && amount >= threshold)
      ?? outgoing.find((edge) => edge.condition === "AMOUNT_LT_THRESHOLD" && Number.isFinite(threshold) && amount < threshold);
    const next = (conditional ?? outgoing.find((edge) => edge.condition === "ALWAYS"))?.to;
    if (!next) break;
    current = next;
  }
  return { steps, loopDetected, reachedQuickBooks: steps.includes("quickbooks") };
}

export function resolvePrototypeApproval(nature: string, amount: number, workflows: Record<string, PrototypeWorkflowControl>) {
  const control = workflows[nature] ?? { managerApproval: true, accountingReview: true, accountingThreshold: "", requireApValidation: true, slaHours: 48, diagram: clonePrototypeDiagram() };
  const threshold = Number(control.accountingThreshold.replaceAll(",", ""));
  const hasConditionalBranches = normalizePrototypeDiagram(control.diagram).edges.some((edge) => edge.condition !== "ALWAYS");
  const needsAccounting = control.accountingReview && (hasConditionalBranches || !control.accountingThreshold.trim() || (Number.isFinite(threshold) && amount >= threshold));
  const route = tracePrototypeDiagram(control, amount).steps;
  const finalProcessor = route.lastIndexOf("apProcessor");
  const hasEarlierProcessor = finalProcessor > 0 && route.slice(0, finalProcessor).includes("apProcessor");
  const approvalPlan = route.map((node, index): PrototypeApprovalStage | null => {
    if (node === "manager") return control.managerApproval ? "Manager Approval" : null;
    if (node === "accounting" || node === "apReviewer") return needsAccounting ? "Accounting Review" : null;
    if (node === "apProcessor" && control.requireApValidation && !(hasEarlierProcessor && index === finalProcessor)) return "AP Validation";
    return null;
  }).filter((stage): stage is PrototypeApprovalStage => Boolean(stage));
  if (control.requireApValidation && !approvalPlan.includes("AP Validation")) approvalPlan.push("AP Validation");
  const status = approvalPlan[0] === "Manager Approval" ? "Pending Manager Approval" as const : approvalPlan[0] === "Accounting Review" ? "Pending Accounting Review" as const : approvalPlan[0] === "AP Validation" || control.requireApValidation ? "Pending AP Validation" as const : "Ready for QuickBooks" as const;
  return { approvalPlan, approvalStep: 0, requireApValidation: control.requireApValidation, status };
}
