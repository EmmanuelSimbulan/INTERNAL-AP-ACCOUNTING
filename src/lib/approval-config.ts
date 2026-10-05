import Decimal from "decimal.js";
import type { RoleCode } from "@prisma/client";
import { db } from "./db";

export type ApprovalPlan = {
  workflowId: string;
  stageKeys: string[];
  stages: { id: string; key: string; name: string; requiredRole: RoleCode }[];
  requireApValidation: boolean;
  slaHours: number;
};

type RuleConditions = {
  natureOfPaymentId?: string;
  requireApValidation?: boolean;
  accountingThreshold?: string | null;
  slaHours?: number;
};

function conditionsOf(value: unknown): RuleConditions {
  return value && typeof value === "object" ? value as RuleConditions : {};
}

function stageKeysOf(value: unknown) {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
}

export async function resolveApprovalPlan(companyId: string, natureOfPaymentId: string, totalAmount: string): Promise<ApprovalPlan> {
  const workflow = await db.approvalWorkflow.findFirst({
    where: { companyId, active: true },
    include: { stages: { orderBy: { order: "asc" } }, rules: { where: { active: true }, orderBy: { priority: "desc" } } },
    orderBy: { id: "asc" }
  });
  if (!workflow) throw new Error("No active approval workflow is configured for this company");

  const rule = workflow.rules.find((candidate) => conditionsOf(candidate.conditions).natureOfPaymentId === natureOfPaymentId)
    ?? workflow.rules.find((candidate) => !conditionsOf(candidate.conditions).natureOfPaymentId);
  const conditions = conditionsOf(rule?.conditions);
  let stageKeys = rule ? stageKeysOf(rule.stageKeys) : ["MANAGER"];
  if (conditions.accountingThreshold && new Decimal(totalAmount).lt(conditions.accountingThreshold)) {
    stageKeys = stageKeys.filter((key) => key !== "ACCOUNTING");
  }
  const stages = stageKeys.map((key) => workflow.stages.find((stage) => stage.key === key)).filter((stage): stage is NonNullable<typeof stage> => Boolean(stage));
  return {
    workflowId: workflow.id,
    stageKeys: stages.map((stage) => stage.key),
    stages: stages.map((stage) => ({ id: stage.id, key: stage.key, name: stage.name, requiredRole: stage.requiredRole })),
    requireApValidation: conditions.requireApValidation ?? true,
    slaHours: Math.min(720, Math.max(1, Number(conditions.slaHours) || 48))
  };
}

export function approvalStatusForStage(stageKey: string) {
  return stageKey === "ACCOUNTING" ? "PENDING_ACCOUNTING_REVIEW" as const : "PENDING_MANAGER_APPROVAL" as const;
}

export function postApprovalStatus(requireApValidation: boolean) {
  return requireApValidation ? "PENDING_AP_VALIDATION" as const : "READY_FOR_DOCUMENT_GENERATION" as const;
}

export function initialApprovalStatus(plan: ApprovalPlan) {
  return plan.stages[0] ? approvalStatusForStage(plan.stages[0].key) : postApprovalStatus(plan.requireApValidation);
}

export function approvalPlanSnapshot(plan: ApprovalPlan) {
  return { workflowId: plan.workflowId, stageKeys: plan.stageKeys, requireApValidation: plan.requireApValidation, slaHours: plan.slaHours };
}

export function readApprovalPlanSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const plan = (snapshot as { approvalPlan?: unknown }).approvalPlan;
  if (!plan || typeof plan !== "object") return null;
  const value = plan as { workflowId?: unknown; stageKeys?: unknown; requireApValidation?: unknown; slaHours?: unknown };
  if (typeof value.workflowId !== "string") return null;
  return {
    workflowId: value.workflowId,
    stageKeys: stageKeysOf(value.stageKeys),
    requireApValidation: value.requireApValidation !== false,
    slaHours: Math.min(720, Math.max(1, Number(value.slaHours) || 48))
  };
}
