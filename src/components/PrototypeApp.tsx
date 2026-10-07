"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadInvoicePdf } from "@/lib/prototype-invoice-pdf";
import {
  downloadSaasantBillCsv,
  downloadSaasantBulkBillCsv,
} from "@/lib/saasant-bill-csv";
import {
  companyNumberingRules,
  generateInvoiceNumber,
  getCompanyNumberingRule,
} from "@/lib/company-numbering";
import { demoProfiles, type DemoRole as Role } from "@/lib/demo-profiles";
import {
  getPrototypeRequestErrors,
  parsePrototypeAmount,
} from "@/lib/prototype-validation";
import { clonePrototypeDiagram, normalizePrototypeDiagram, resolvePrototypeApproval, tracePrototypeDiagram, type PrototypeBranchCondition, type PrototypeWorkflowControl as WorkflowControl, type PrototypeWorkflowDiagram, type PrototypeWorkflowNodeId, type PrototypeWorkflowNodeRole } from "@/lib/prototype-workflow";
type Status =
  | "Draft"
  | "Pending Manager Approval"
  | "Pending Accounting Review"
  | "Returned for Revision"
  | "Rejected"
  | "Manager Approved"
  | "Pending AP Validation"
  | "Ready for QuickBooks"
  | "Posted to QuickBooks"
  | "Paid"
  | "Reconciled"
  | "Closed";
type Line = {
  project: string;
  account: string;
  particulars: string;
  amount: string;
};
type Attachment = {
  name: string;
  type: string;
  dataUrl?: string;
};
type StatusCheckpoint = {
  status: Status;
  approvalPlan?: Array<"Manager Approval" | "Accounting Review" | "AP Validation">;
  approvalStep?: number;
  requireApValidation?: boolean;
  qbId?: string;
  paymentRef?: string;
  reconciliationRef?: string;
  event: string;
};
type ApprovalPlanStep = "Manager Approval" | "Accounting Review" | "AP Validation";
type Req = {
  id: string;
  number: string;
  requester: string;
  payee: string;
  company: string;
  date: string;
  currency: string;
  nature: string;
  other: string;
  status: Status;
  invoiceNumber?: string;
  lines: Line[];
  documents: Attachment[];
  timeline: string[];
  qbId?: string;
  paymentRef?: string;
  reconciliationRef?: string;
  approvalPlan?: ApprovalPlanStep[];
  approvalStep?: number;
  requireApValidation?: boolean;
  statusHistory?: StatusCheckpoint[];
};
type RequestSort = "newest" | "oldest" | "company-asc" | "company-desc";
const requestSortOptions: Array<{ value: RequestSort; label: string }> = [
  { value: "newest", label: "Date: newest to oldest" },
  { value: "oldest", label: "Date: oldest to newest" },
  { value: "company-asc", label: "Company: A to Z" },
  { value: "company-desc", label: "Company: Z to A" },
];
function sortRequests(requests: Req[], sort: RequestSort) {
  return [...requests].sort((a, b) => {
    if (sort === "company-asc" || sort === "company-desc") {
      const comparison = a.company.localeCompare(b.company, undefined, { sensitivity: "base" });
      return (sort === "company-asc" ? comparison : -comparison) || b.date.localeCompare(a.date);
    }
    const comparison = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10));
    return sort === "newest" ? -comparison : comparison;
  });
}
const standardRequestApprovalPlan: ApprovalPlanStep[] = ["Manager Approval", "AP Validation", "Accounting Review"];
function requestApprovalPlan(request: Pick<Req, "approvalPlan" | "requireApValidation" | "status">): ApprovalPlanStep[] {
  const plan = [...(request.approvalPlan ?? (request.status === "Draft" ? [] : standardRequestApprovalPlan))];
  if (request.requireApValidation !== false && !plan.includes("AP Validation")) {
    const accountingIndex = plan.indexOf("Accounting Review");
    plan.splice(accountingIndex < 0 ? plan.length : accountingIndex, 0, "AP Validation");
  }
  return plan;
}
function requestApprovalStepIndex(request: Pick<Req, "approvalPlan" | "requireApValidation" | "status" | "approvalStep">, plan: ApprovalPlanStep[]) {
  const migratedStageInserted = Boolean(request.approvalPlan && plan.length > request.approvalPlan.length);
  if (request.approvalStep !== undefined && !migratedStageInserted) return request.approvalStep;
  const currentStage = request.status === "Pending Manager Approval" ? "Manager Approval" : request.status === "Pending Accounting Review" ? "Accounting Review" : request.status === "Pending AP Validation" || request.status === "Manager Approved" ? "AP Validation" : undefined;
  return currentStage ? Math.max(0, plan.indexOf(currentStage)) : 0;
}
function normalizeRequestWorkflow(request: Req): Req {
  if (request.status === "Draft") return request;
  const plan = requestApprovalPlan(request);
  const needsApCatchup = request.status === "Pending Accounting Review" && request.requireApValidation !== false && !request.approvalPlan?.includes("AP Validation");
  return {
    ...request,
    approvalPlan: plan,
    approvalStep: needsApCatchup ? plan.indexOf("AP Validation") : requestApprovalStepIndex(request, plan),
    ...(needsApCatchup ? { status: "Pending AP Validation" as const, timeline: [...request.timeline, "Workflow updated: sent to AP Processor for validation before Accounting review"] } : {}),
  };
}
const defaultNatureOfPayments = [
  "Cash Advance",
  "Taxes and Licenses Remittance (BIR, CDC, City Treasurer of Pasig, etc.)",
  "Fund Replenishment (PCF, Revolving, etc.)",
  "Per Diem/Allowance",
  "Payroll Disbursement",
  "Reimbursement (includes Notarization)",
  "Payroll Government Remittance",
  "Intercompany DM",
  "Intercompany Invoice",
  "Last Pay",
  "Consultancy Fee",
  "Interest Payment (RCPS, Short-Term Loan)",
  "Dollar Conversion",
  "Commission Payment",
  "Facilitation Payment",
  "Representation",
  "Gratuity",
  "Fund Transfer",
  "ERP",
];
const projects = [
    "HR",
    "Admin",
    "IT",
    "Finance",
    "BPI",
    "Dealership",
    "Digitization",
  ],
  accounts = [
    "Transportation",
    "Notary",
    "Meals",
    "Software",
    "Office Supplies",
    "Professional Fees",
  ];
type VendorCurrency = "PHP" | "USD" | "BOTH";
type MasterData = { projects: string[]; accounts: string[]; payees: string[]; vendorCurrencies: Record<string, VendorCurrency>; natureOfPayments: string[]; workflows: Record<string, WorkflowControl> };
const defaultWorkflow: WorkflowControl = { managerApproval: true, accountingReview: true, accountingThreshold: "", requireApValidation: true, slaHours: 48, diagram: clonePrototypeDiagram() };
const defaultWorkflows = Object.fromEntries(defaultNatureOfPayments.map((nature) => [nature, { ...defaultWorkflow, diagram: clonePrototypeDiagram() }]));
const defaultMasterData: MasterData = {
  projects: [...projects],
  accounts: [...accounts],
  payees: ["Northstar Demo Supplies", "Bluebird Sample Consulting", "Alex Rivera", "Demo Payroll Clearing", "Sample Mobile Recipient", "Atlas Demo Services"],
  vendorCurrencies: Object.fromEntries(["Northstar Demo Supplies", "Bluebird Sample Consulting", "Alex Rivera", "Demo Payroll Clearing", "Sample Mobile Recipient", "Atlas Demo Services"].map((payee) => [payee, "BOTH"])),
  natureOfPayments: defaultNatureOfPayments,
  workflows: defaultWorkflows,
};
function usesLegacyDefaultRoute(diagram?: PrototypeWorkflowDiagram) {
  if (!diagram || diagram.nodes.length !== 5 || diagram.edges.length !== 4) return false;
  const routeEdges = new Set(diagram.edges.map((edge) => `${edge.from}>${edge.to}`));
  return diagram.edges.every((edge) => edge.condition === "ALWAYS") && ["request>manager", "manager>accounting", "accounting>ap", "ap>quickbooks"].every((edge) => routeEdges.has(edge));
}
function normalizeMasterData(value: Partial<MasterData>): MasterData {
  const savedWorkflows = value.workflows ?? {};
  const payees = value.payees ?? defaultMasterData.payees;
  const vendorCurrencies = Object.fromEntries(payees.map((payee) => {
    const currency = value.vendorCurrencies?.[payee];
    return [payee, currency === "PHP" || currency === "USD" || currency === "BOTH" ? currency : "BOTH"];
  })) as Record<string, VendorCurrency>;
  const natureOfPayments = value.natureOfPayments?.length ? value.natureOfPayments : defaultNatureOfPayments;
  const workflows = Object.fromEntries(natureOfPayments.map((nature) => { const saved = savedWorkflows[nature]; const migrateDefault = usesLegacyDefaultRoute(saved?.diagram); return [nature, { ...defaultWorkflow, ...(saved ?? {}), ...(migrateDefault ? { accountingReview: true } : {}), diagram: migrateDefault ? clonePrototypeDiagram() : normalizePrototypeDiagram(saved?.diagram) }]; }));
  return { projects: value.projects ?? defaultMasterData.projects, accounts: value.accounts ?? defaultMasterData.accounts, payees, vendorCurrencies, natureOfPayments, workflows };
}
function isVendorCurrencyAllowed(payee: string, currency: string, vendorCurrencies: MasterData["vendorCurrencies"]) {
  const allowedCurrency = vendorCurrencies[payee] ?? "BOTH";
  return allowedCurrency === "BOTH" || allowedCurrency === currency;
}
const companies = companyNumberingRules.map((rule) => rule.name);
/* Demo-only sample requests are intentionally excluded from the UAT workspace.
const seed: Req[] = [
  {
    id: "1",
    number: "RFP-SVI-2026-000101",
    requester: "Alex Rivera",
    payee: "Northstar Demo Supplies",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-30",
    currency: "PHP",
    nature: "Reimbursement (includes Notarization)",
    other: "",
    status: "Pending Manager Approval",
    lines: [
      {
        project: "IT",
        account: "Software",
        particulars: "Annual collaboration software license renewal",
        amount: "18500.00",
      },
    ],
    documents: [
      { name: "Official Receipt.pdf", type: "application/pdf" },
      { name: "Proof of Payment.png", type: "image/png", dataUrl: demoImagePreview("Proof of Payment") },
    ],
    timeline: [
      "Draft created",
      "Requester attested and submitted",
      "Assigned to Jordan Reyes",
    ],
  },
  {
    id: "2",
    number: "RFP-SVI-2026-000100",
    requester: "Morgan Santos",
    payee: "Bluebird Sample Consulting",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-29",
    currency: "PHP",
    nature: "Consultancy Fee",
    other: "",
    status: "Pending AP Validation",
    lines: [
      {
        project: "Digitization",
        account: "Professional Fees",
        particulars: "Approved process documentation engagement",
        amount: "75000.00",
      },
    ],
    documents: [
      { name: "Consultancy Agreement.pdf", type: "application/pdf" },
      { name: "Invoice.pdf", type: "application/pdf" },
    ],
    timeline: [
      "Submitted",
      "Manager approved",
      "PDF generated",
      "Queued for AP validation",
    ],
  },
  {
    id: "3",
    number: "RFP-SVI-2026-000099",
    requester: "Alex Rivera",
    payee: "Alex Rivera",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-28",
    currency: "PHP",
    nature: "Cash Advance",
    other: "",
    status: "Closed",
    lines: [
      {
        project: "Admin",
        account: "Meals",
        particulars: "Fictitious internal training activity",
        amount: "12000.00",
      },
    ],
    documents: [
      { name: "Approved Cash Advance.pdf", type: "application/pdf" },
      { name: "Liquidation.pdf", type: "application/pdf" },
    ],
    timeline: [
      "Submitted",
      "Manager approved",
      "AP validated",
      "Posted: QB-DEMO-099",
      "Paid",
      "Reconciled",
      "Closed",
    ],
  },
  {
    id: "4",
    number: "RFP-SVI-2026-000098",
    requester: "Jamie Cruz",
    payee: "Demo Payroll Clearing",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-27",
    currency: "PHP",
    nature: "Payroll Disbursement",
    other: "",
    status: "Pending Manager Approval",
    lines: [
      {
        project: "HR",
        account: "Professional Fees",
        particulars: "September sample payroll processing",
        amount: "245000.00",
      },
    ],
    documents: [
      { name: "Protected Payroll Summary.pdf", type: "application/pdf" },
    ],
    timeline: [
      "Draft created",
      "Confidential documents uploaded",
      "Submitted for approval",
    ],
  },
  {
    id: "5",
    number: "RFP-SVI-2026-000097",
    requester: "Taylor Lim",
    payee: "Sample Mobile Recipient",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-26",
    currency: "PHP",
    nature: "Fund Transfer",
    other: "",
    status: "Ready for QuickBooks",
    lines: [
      {
        project: "Admin",
        account: "Transportation",
        particulars: "Local delivery and document handling",
        amount: "3200.00",
      },
    ],
    documents: [{ name: "Delivery Acknowledgement.jpg", type: "image/jpeg", dataUrl: demoImagePreview("Delivery Acknowledgement") }],
    timeline: ["Submitted", "Manager approved", "AP validated"],
  },
  {
    id: "6",
    number: "RFP-SVI-2026-000096",
    requester: "Sam Garcia",
    payee: "Atlas Demo Services",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-25",
    currency: "PHP",
    nature: "Fund Transfer",
    other: "",
    status: "Paid",
    lines: [
      {
        project: "Finance",
        account: "Professional Fees",
        particulars: "Quarterly financial advisory services",
        amount: "125000.00",
      },
    ],
    documents: [
      { name: "Service Invoice.pdf", type: "application/pdf" },
      { name: "Payment Confirmation.png", type: "image/png", dataUrl: demoImagePreview("Payment Confirmation") },
    ],
    timeline: [
      "Submitted",
      "Approved",
      "Posted to QuickBooks",
      "Payment completed",
    ],
  },
  {
    id: "7",
    number: "RFP-SVI-2026-000095",
    requester: "Casey Flores",
    payee: "Global Demo Software LLC",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-24",
    currency: "USD",
    nature: "Dollar Conversion",
    other: "",
    status: "Pending AP Validation",
    lines: [
      {
        project: "IT",
        account: "Software",
        particulars: "Cloud platform annual subscription",
        amount: "4800.00",
      },
    ],
    documents: [
      { name: "USD Subscription Invoice.pdf", type: "application/pdf" },
    ],
    timeline: [
      "Submitted",
      "Manager approved",
      "Queued for foreign currency review",
    ],
  },
  {
    id: "8",
    number: "RFP-SVI-2026-000094",
    requester: "Riley Mendoza",
    payee: "Riley Mendoza",
    company: "SVI TECHNOLOGIES INC",
    date: "2026-09-23",
    currency: "PHP",
    nature: "Fund Replenishment (PCF, Revolving, etc.)",
    other: "",
    status: "Returned for Revision",
    lines: [
      {
        project: "Admin",
        account: "Office Supplies",
        particulars: "Office and pantry supply replenishment",
        amount: "17850.00",
      },
      {
        project: "Finance",
        account: "Transportation",
        particulars: "Courier and local transport expenses",
        amount: "10000.00",
      },
    ],
    documents: [
      {
        name: "Expense Breakdown.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
    timeline: [
      "Submitted",
      "Reviewed by manager",
      "Returned: attach missing receipts",
    ],
  },
]; */
const total = (l: Line[]) =>
    l.reduce((sum, line) => {
      const amount = parsePrototypeAmount(line.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0),
  cash = (n: number, c: string) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: c }).format(
      n,
    );
export function PrototypeApp() {
  const [activeProfileId, setActiveProfileId] = useState(demoProfiles[0].id),
    [profileMenuOpen, setProfileMenuOpen] = useState(false),
    [masterData, setMasterData] = useState<MasterData>(defaultMasterData),
    [rows, setRows] = useState<Req[]>([]),
    [selected, setSelected] = useState(""),
    [view, setView] = useState<
      "dashboard" | "new" | "detail" | "queue" | "reports" | "settings"
    >("dashboard"),
    [toast, setToast] = useState(""),
    [databaseHydrated, setDatabaseHydrated] = useState(false),
    [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "offline">("loading"),
    [syncError, setSyncError] = useState("");
  const serverUpdatedAtRef = useRef<string | null>(null);
  const applyingRemoteStateRef = useRef(false);
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;
  const activeProfile = demoProfiles.find((profile) => profile.id === activeProfileId) ?? demoProfiles[0];
  const role = activeProfile.role;
  useEffect(() => {
    const savedProfile = localStorage.getItem("iap-active-profile");
    if (savedProfile && demoProfiles.some((profile) => profile.id === savedProfile)) setActiveProfileId(savedProfile);
    const loadDatabaseState = async () => {
      try {
        const response = await fetch("/api/prototype/state", { cache: "no-store" });
        if (!response.ok) throw new Error(`Database returned ${response.status}`);
        const saved = await response.json() as null | { requests: Req[]; masterData: Partial<MasterData>; updatedAt?: string };
        serverUpdatedAtRef.current = saved?.updatedAt ?? null;
        const savedRows = (saved?.requests ?? []).map(normalizeRequestWorkflow);
        setRows(savedRows);
        setSelected(savedRows[0]?.id ?? "");
        setMasterData(saved?.masterData ? normalizeMasterData(saved.masterData) : defaultMasterData);
        setSyncError("");
        setSyncStatus("synced");
      } catch (error) {
        console.error("Prototype database load failed", error);
        setRows([]);
        setSelected("");
        setSyncError("The shared database could not be reached. Changes will not be saved until you reconnect.");
        setSyncStatus("offline");
      } finally {
        setDatabaseHydrated(true);
      }
    };
    void loadDatabaseState();
  }, []);
  useEffect(() => {
    if (applyingRemoteStateRef.current) {
      applyingRemoteStateRef.current = false;
      return;
    }
    if (!databaseHydrated || syncStatusRef.current !== "synced") return;
    const profile = demoProfiles.find((item) => item.id === activeProfileId);
    if (profile?.role === "Auditor") {
      setSyncStatus("synced");
      return;
    }
    setSyncStatus("saving");
    const timeout = window.setTimeout(async () => {
      const databaseRows = rows.map((request) => ({
        ...request,
        documents: request.documents.map((document) =>
          document.dataUrl && document.dataUrl.length > 1_900_000
            ? { name: document.name, type: document.type }
            : document,
        ),
      }));
      try {
        const response = await fetch("/api/prototype/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: activeProfileId, rows: databaseRows, masterData }),
        });
        if (!response.ok) throw new Error(`Database returned ${response.status}`);
        const saved = await response.json() as { updatedAt?: string };
        if (!saved.updatedAt) throw new Error("Database did not confirm the save");
        serverUpdatedAtRef.current = saved.updatedAt;
        setSyncError("");
        setSyncStatus("synced");
      } catch (error) {
        console.error("Prototype database save failed", error);
        setSyncError("The latest changes were not saved. Reconnect to load the last saved data.");
        setSyncStatus("offline");
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [activeProfileId, databaseHydrated, masterData, rows]);
  useEffect(() => {
    if (!databaseHydrated || syncStatus !== "synced") return;
    let active = true;
    let checking = false;
    const refreshSharedState = async () => {
      if (checking || syncStatusRef.current !== "synced") return;
      checking = true;
      try {
        const response = await fetch("/api/prototype/state", { cache: "no-store" });
        if (!response.ok) {
          setSyncError("The shared database connection was lost. Reconnect before continuing UAT.");
          setSyncStatus("offline");
          return;
        }
        const saved = await response.json() as null | { requests: Req[]; masterData: Partial<MasterData>; updatedAt?: string };
        if (!active || !saved?.updatedAt || saved.updatedAt === serverUpdatedAtRef.current) return;
        if (syncStatusRef.current !== "synced") return;
        const remoteRows = (saved.requests ?? []).map(normalizeRequestWorkflow);
        serverUpdatedAtRef.current = saved.updatedAt;
        applyingRemoteStateRef.current = true;
        setRows(remoteRows);
        setSelected((current) => remoteRows.some((request) => request.id === current) ? current : remoteRows[0]?.id ?? "");
        setMasterData(normalizeMasterData(saved.masterData ?? {}));
      } catch (error) {
        console.error("Prototype database refresh failed", error);
        if (active) {
          setSyncError("The shared database connection was lost. Reconnect before continuing UAT.");
          setSyncStatus("offline");
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void refreshSharedState(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [databaseHydrated, syncStatus]);
  const current = rows.find((r) => r.id === selected),
    reconnectDatabase = async () => {
      setSyncStatus("loading");
      try {
        const response = await fetch("/api/prototype/state", { cache: "no-store" });
        if (!response.ok) throw new Error(`Database returned ${response.status}`);
        const saved = await response.json() as null | { requests: Req[]; masterData: Partial<MasterData>; updatedAt?: string };
        const savedRows = (saved?.requests ?? []).map(normalizeRequestWorkflow);
        serverUpdatedAtRef.current = saved?.updatedAt ?? null;
        setRows(savedRows);
        setSelected((selectedId) => savedRows.some((request) => request.id === selectedId) ? selectedId : savedRows[0]?.id ?? "");
        setMasterData(saved?.masterData ? normalizeMasterData(saved.masterData) : defaultMasterData);
        setSyncError("");
        setSyncStatus("synced");
      } catch (error) {
        console.error("Prototype database reconnect failed", error);
        setSyncError("Could not reconnect to the shared database. Your last saved data is unchanged; try again.");
        setSyncStatus("offline");
      }
    },
    notify = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 2200);
    },
    open = (id: string) => {
      setSelected(id);
      setView("detail");
    },
    update = (id: string, c: Partial<Req>, event: string) =>
      setRows((a) => a.map((r) => {
        if (r.id !== id) return r;
        const statusAction = (c.status !== undefined && c.status !== r.status) || (c.approvalStep !== undefined && c.approvalStep !== r.approvalStep);
        const checkpoint: StatusCheckpoint = { status: r.status, approvalPlan: r.approvalPlan, approvalStep: r.approvalStep, requireApValidation: r.requireApValidation, qbId: r.qbId, paymentRef: r.paymentRef, reconciliationRef: r.reconciliationRef, event };
        return { ...r, ...c, ...(statusAction ? { statusHistory: [...(r.statusHistory ?? []), checkpoint].slice(-25) } : {}), timeline: [...r.timeline, event] };
      }));
  const undoStatusAction = (id: string) => setRows((currentRows) => currentRows.map((r) => {
    if (r.id !== id || !r.statusHistory?.length) return r;
    const checkpoint = r.statusHistory[r.statusHistory.length - 1];
    return { ...r, status: checkpoint.status, approvalPlan: checkpoint.approvalPlan, approvalStep: checkpoint.approvalStep, requireApValidation: checkpoint.requireApValidation, qbId: checkpoint.qbId, paymentRef: checkpoint.paymentRef, reconciliationRef: checkpoint.reconciliationRef, statusHistory: r.statusHistory.slice(0, -1), timeline: [...r.timeline, `Undid status action: ${checkpoint.event}; restored ${checkpoint.status}`] };
  }));
  return (
    <div className="prototype">
      <header className="proto-top">
        <div className="proto-bar">
          <button className="proto-brand" onClick={() => setView("dashboard")}>
            <span className="brand-mark">S</span>
            <span>
              <strong>SVI Payables</strong>
              <small>Finance workspace</small>
            </span>
          </button>
          <nav className="proto-nav">
            <button
              className={view === "dashboard" ? "active" : ""}
              onClick={() => setView("dashboard")}
            >
              Overview
            </button>
            <button
              className={view === "queue" ? "active" : ""}
              onClick={() => setView("queue")}
            >
              {role === "Approver"
                ? "Approvals"
                : role.includes("AP")
                  ? "Work queue"
                  : "Requests"}
            </button>
            {role !== "Auditor" && (
              <button
                className={view === "new" ? "active" : ""}
                onClick={() => setView("new")}
              >
                New request
              </button>
            )}
            <button
              className={view === "reports" ? "active" : ""}
              onClick={() => setView("reports")}
            >
              Reports
            </button>
            {role === "Administrator" && (
              <button
                className={view === "settings" ? "active" : ""}
                onClick={() => setView("settings")}
              >
                Settings
              </button>
            )}
          </nav>
          <div className="proto-tools">
            <span className={`sync-indicator ${syncStatus}`} title="Production database status">
              <i />{syncStatus === "loading" ? "Connecting" : syncStatus === "saving" ? "Saving" : syncStatus === "synced" ? "Database saved" : "Database unavailable"}
            </span>
            <div className="profile-switcher">
              <button className="profile-trigger" type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
                <span className="profile-avatar" style={{ background: activeProfile.accent }}>{activeProfile.initials}</span>
                <span className="profile-trigger-copy"><strong>{activeProfile.name}</strong><small>{activeProfile.role}</small></span>
                <span className="profile-chevron">⌄</span>
              </button>
              {profileMenuOpen && <>
                <button className="profile-backdrop" type="button" aria-label="Close profile switcher" onClick={() => setProfileMenuOpen(false)} />
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-head"><span className="eyebrow">Switch account</span><strong>Choose a profile</strong></div>
                  <div className="profile-list">{demoProfiles.map((profile) => <button key={profile.id} type="button" role="menuitem" className={`profile-option ${profile.id === activeProfile.id ? "active" : ""}`} onClick={() => { setActiveProfileId(profile.id); localStorage.setItem("iap-active-profile", profile.id); setProfileMenuOpen(false); setView("dashboard"); notify(`Switched to ${profile.name}`); }}>
                    <span className="profile-avatar" style={{ background: profile.accent }}>{profile.initials}</span>
                    <span className="profile-option-copy"><strong>{profile.name}</strong><small>{profile.email}</small><span>{profile.role} · {profile.description}</span></span>
                    {profile.id === activeProfile.id && <span className="profile-check">✓</span>}
                  </button>)}</div>
                  <div className="profile-menu-foot">Profiles and access are configurable in Administration.</div>
                </div>
              </>}
            </div>
          </div>
        </div>
      </header>
      <main className="proto-main">
        {toast && <div className="toast">{toast}</div>}
        {syncStatus === "offline" && <div className="database-warning" role="alert"><span>{syncError || "The shared database is unavailable. Changes will not be saved. Reconnecting reloads the last saved version."}</span><button type="button" className="button secondary" onClick={() => void reconnectDatabase()}>Reconnect to database</button></div>}
        <div className="view-stage" key={`${view}-${selected}`} inert={syncStatus === "offline" || syncStatus === "loading"}>
          {view === "dashboard" && (
            <Dashboard
              role={role}
              rows={rows}
              open={open}
              create={() => setView("new")}
              showAll={() => setView("queue")}
              notify={notify}
            />
          )}{" "}
          {view === "queue" && <Queue role={role} rows={rows} open={open} />}{" "}
          {view === "new" && (
            <NewRequest
              projectCodes={masterData.projects}
              accountOptions={masterData.accounts}
              payeeOptions={masterData.payees}
              vendorCurrencies={masterData.vendorCurrencies}
              natureOptions={masterData.natureOfPayments}
              workflows={masterData.workflows}
              save={(r) => {
                setRows((a) => [r, ...a]);
                setSelected(r.id);
                setView("detail");
                notify("Request saved");
              }}
            />
          )}{" "}
          {view === "detail" && current && (
            <Details
              role={role}
              request={current}
              update={update}
              undoStatusAction={undoStatusAction}
              notify={notify}
              projectCodes={masterData.projects}
              accountOptions={masterData.accounts}
              payeeOptions={masterData.payees}
              vendorCurrencies={masterData.vendorCurrencies}
              natureOptions={masterData.natureOfPayments}
              workflows={masterData.workflows}
            />
          )}{" "}
          {view === "reports" && <Reports rows={rows} />}
          {view === "settings" && role === "Administrator" && (
            <Settings
              masterData={masterData}
              onChange={setMasterData}
              notify={notify}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function Dashboard({
  role,
  rows,
  open,
  create,
  showAll,
  notify,
}: {
  role: Role;
  rows: Req[];
  open: (x: string) => void;
  create: () => void;
  showAll: () => void;
  notify: (message: string) => void;
}) {
  const [recentSort, setRecentSort] = useState<RequestSort>("newest");
  const recentRows = sortRequests(rows, recentSort).slice(0, 5);
  const bulkBills = rows.filter(
    (request) =>
      ![
        "Draft",
        "Pending Manager Approval",
        "Returned for Revision",
        "Rejected",
      ].includes(request.status),
  );
  const exportBulkBills = () => {
    downloadSaasantBulkBillCsv(bulkBills);
    notify(`${bulkBills.length} SaaSAnt bills exported`);
  };
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">{role} workspace</span>
          <h1>Good afternoon, Alex.</h1>
          <p className="muted">
            Here’s what’s happening with your payment requests.
          </p>
        </div>
        {role !== "Auditor" && (
          <button className="button" onClick={create}>
            <span>＋</span> New request
          </button>
        )}
      </div>
      <div className="grid grid-4 metrics">
        <Metric label="Total requests" value={rows.length} />
        <Metric
          label="Awaiting action"
          value={rows.filter((r) => r.status.includes("Pending")).length}
        />
        <Metric
          label="Total value"
          value={cash(
            rows.reduce((n, r) => n + total(r.lines), 0),
            "PHP",
          )}
        />
        <Metric
          label="Completed"
          value={rows.filter((r) => r.status === "Closed").length}
        />
      </div>
      <div className="dashboard-layout">
        <section className="list-section">
          <div className="section-heading">
            <div>
              <span className="module-kicker">Workspace</span>
              <h2>Recent requests</h2>
              <p>Latest requests by request date</p>
            </div>
            <div className="recent-request-actions">
              <label className="recent-sort-control"><span>Sort by</span><select aria-label="Sort recent requests" value={recentSort} onChange={(event) => setRecentSort(event.target.value as RequestSort)}>{requestSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <button type="button" className="show-more-link" onClick={showAll} aria-label={`Show all ${rows.length} requests`}>
                Show more <span aria-hidden="true">›</span>
              </button>
            </div>
          </div>
          <Table rows={recentRows} open={open} />
        </section>
        <aside className="module-rail">
          <section className="card module-card workflow-card">
            <div className="module-heading">
              <div>
                <span className="module-kicker">Live workflow</span>
                <h2>Pipeline</h2>
              </div>
              <span className="live-dot" aria-label="Live" />
            </div>
            <div className="workflow-row">
              <span>
                <i className="step-dot purple" />
                Accounting review
              </span>
              <strong>{rows.filter((request) => request.status === "Pending Accounting Review").length}</strong>
            </div>
            <div className="workflow-row">
              <span>
                <i className="step-dot amber" />
                Manager review
              </span>
              <strong>
                {
                  rows.filter(
                    (request) => request.status === "Pending Manager Approval",
                  ).length
                }
              </strong>
            </div>
            <div className="workflow-row">
              <span>
                <i className="step-dot blue" />
                AP processing
              </span>
              <strong>
                {
                  rows.filter((request) =>
                    [
                      "Pending AP Validation",
                      "Ready for QuickBooks",
                      "Posted to QuickBooks",
                    ].includes(request.status),
                  ).length
                }
              </strong>
            </div>
            <div className="workflow-row">
              <span>
                <i className="step-dot green" />
                Completed
              </span>
              <strong>
                {
                  rows.filter((request) =>
                    ["Paid", "Reconciled", "Closed"].includes(request.status),
                  ).length
                }
              </strong>
            </div>
          </section>
          <section className="card module-card tools-card">
            <span className="module-kicker">Quick tools</span>
            <h2>Create & export</h2>
            {role !== "Auditor" && (
              <button className="tool-action" onClick={create}>
                <span className="tool-icon">+</span>
                <span>
                  <strong>New request</strong>
                  <small>Create a payment request</small>
                </span>
                <b>›</b>
              </button>
            )}
            <button
              className="tool-action"
              disabled={!bulkBills.length}
              onClick={exportBulkBills}
            >
              <span className="tool-icon csv">CSV</span>
              <span>
                <strong>Bulk SaaSAnt export</strong>
                <small>{bulkBills.length} bills ready</small>
              </span>
              <b>↓</b>
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  const icon =
    label === "Total value"
      ? "$"
      : label === "Completed"
        ? "OK"
        : label === "Awaiting action"
          ? "!"
          : "#";
  return (
    <div className="card metric">
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Queue({
  role,
  rows,
  open,
}: {
  role: Role;
  rows: Req[];
  open: (x: string) => void;
}) {
  const queueRows =
    role === "Approver"
      ? rows.filter((r) => r.status === "Pending Manager Approval")
      : role.includes("AP")
        ? rows.filter(
            (r) =>
              ![
                "Draft",
                "Pending Manager Approval",
                "Rejected",
                "Closed",
              ].includes(r.status),
          )
        : rows;
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<RequestSort>("newest");
  const companies = [...new Set(queueRows.map((request) => request.company).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const statuses = [...new Set(queueRows.map((request) => request.status))].sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLocaleLowerCase();
  const filtered = queueRows.filter((request) => {
    const matchesSearch = !query || [request.number, request.requester, request.payee, request.nature, request.invoiceNumber, request.company].some((value) => value?.toLocaleLowerCase().includes(query));
    const requestDate = request.date.slice(0, 10);
    return matchesSearch && (!company || request.company === company) && (!fromDate || requestDate >= fromDate) && (!toDate || requestDate <= toDate) && (!status || request.status === status);
  });
  const sorted = sortRequests(filtered, sortBy);
  const hasFilters = Boolean(search || company || fromDate || toDate || status);
  const clearFilters = () => { setSearch(""); setCompany(""); setFromDate(""); setToDate(""); setStatus(""); };
  return (
    <>
      <span className="eyebrow">Action queue</span>
      <h1>
        {role === "Approver"
          ? "Approval Inbox"
          : role.includes("AP")
            ? "AP Work Queue"
            : "My Requests"}
      </h1>
      <section className="request-filters" aria-label="Filter AP requests">
        <label className="request-filter search-filter">
          <span>Search requests</span>
          <input type="search" placeholder="Request number, payee, requester…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="request-filter">
          <span>Company</span>
          <select value={company} onChange={(event) => setCompany(event.target.value)}>
            <option value="">All companies</option>
            {companies.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="request-filter">
          <span>From date</span>
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="request-filter">
          <span>To date</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label className="request-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="request-filter">
          <span>Sort requests</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RequestSort)}>
            {requestSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {hasFilters && <button type="button" className="clear-request-filters" onClick={clearFilters}>Clear filters</button>}
        <p className="request-filter-count">Showing {sorted.length} of {queueRows.length} requests</p>
      </section>
      <Table rows={sorted} open={open} />
    </>
  );
}
function Table({ rows, open }: { rows: Req[]; open: (x: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Company</th>
            <th>Requester / Payee</th>
            <th>Type</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td className="empty-requests" colSpan={7}>No AP requests match these filters.</td></tr> : rows.map((r) => (
            <tr key={r.id} onClick={() => open(r.id)}>
              <td>
                <strong>{r.number}</strong>
                <div className="fine">{r.date}</div>
              </td>
              <td>{r.company}</td>
              <td>
                {r.requester}
                <div className="fine">{r.payee}</div>
              </td>
              <td>{r.nature}</td>
              <td className="amount-cell">
                {cash(total(r.lines), r.currency)}
              </td>
              <td>
                <span
                  className={`badge status-${r.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {r.status}
                </span>
              </td>
              <td>
                <button
                  className="row-action"
                  aria-label={`Open ${r.number}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    open(r.id);
                  }}
                >
                  ›
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function NewRequest({
  save,
  projectCodes,
  accountOptions,
  payeeOptions,
  vendorCurrencies,
  natureOptions,
  workflows,
}: {
  save: (r: Req) => void;
  projectCodes: string[];
  accountOptions: string[];
  payeeOptions: string[];
  vendorCurrencies: MasterData["vendorCurrencies"];
  natureOptions: string[];
  workflows: MasterData["workflows"];
}) {
  const [company, setCompany] = useState("SVI TECHNOLOGIES INC"),
    [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10)),
    [payee, setPayee] = useState(""),
    [nature, setNature] = useState(natureOptions[0] ?? ""),
    [other] = useState(""),
    [currency, setCurrency] = useState("PHP"),
    [docs, setDocs] = useState<Attachment[]>([]),
    [isDraggingDocuments, setIsDraggingDocuments] = useState(false),
    [documentError, setDocumentError] = useState(""),
    [predictedInvoiceNumber, setPredictedInvoiceNumber] = useState("Loading…"),
    [saving, setSaving] = useState(false),
    [validationErrors, setValidationErrors] = useState<string[]>([]),
    [lines, setLines] = useState<Line[]>([
      {
        project: projectCodes[0] ?? "",
        account: "",
        particulars: "",
        amount: "",
      },
    ]);
  const applicablePayees = payeeOptions.filter((option) => isVendorCurrencyAllowed(option, currency, vendorCurrencies));
  const numberingRule = getCompanyNumberingRule(company);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/prototype/numbering", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ company, date: requestDate, action: "preview" }),
        });
        const result = await response.json();
        if (active && response.ok) setPredictedInvoiceNumber(result.invoiceNumber);
        else if (active) setPredictedInvoiceNumber("Unavailable");
      } catch {
        if (active) setPredictedInvoiceNumber("Unavailable");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [company, requestDate]);
  const change = (i: number, k: keyof Line, v: string) =>
      setLines((a) => a.map((l, n) => (n === i ? { ...l, [k]: v } : l))),
    readDocuments = async (files: FileList | null) => {
      const selectedFiles = Array.from(files ?? []);
      if (!selectedFiles.length) return;
      const availableSlots = Math.max(0, 30 - docs.length);
      if (!availableSlots) {
        setDocumentError("You can attach up to 30 supporting documents.");
        return;
      }
      const filesToAdd = selectedFiles.slice(0, availableSlots);
      setDocumentError(
        selectedFiles.length > availableSlots
          ? `Only ${availableSlots} more document${availableSlots === 1 ? "" : "s"} can be added (30 max).`
          : "",
      );
      const attachments = await Promise.all(
        filesToAdd.map(async (file): Promise<Attachment> => {
          const canPreview =
            file.type.startsWith("image/") || file.type === "application/pdf";
          if (!canPreview) return { name: file.name, type: file.type };
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          return { name: file.name, type: file.type, dataUrl };
        }),
      );
      setDocs((current) => [...current, ...attachments]);
    },
    done = async (submit: boolean) => {
      const errors = submit
        ? [...getPrototypeRequestErrors(payee, nature, lines), ...(!isVendorCurrencyAllowed(payee, currency, vendorCurrencies) ? ["Choose a vendor available for the selected currency."] : [])]
        : [];
      setValidationErrors(errors);
      if (errors.length) {
        return;
      }
      if (saving) return;
      setSaving(true);
      try {
        const response = await fetch("/api/prototype/numbering", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ company, date: requestDate, action: "allocate" }),
        });
        const allocation = await response.json();
        if (!response.ok) throw new Error(allocation.error ?? "Could not allocate request numbers");
        const id = crypto.randomUUID();
        const approval = resolvePrototypeApproval(nature, total(lines), workflows);
        save({
        id,
        number: allocation.requestNumber,
        invoiceNumber: allocation.invoiceNumber,
        requester: "Alex Rivera",
        payee,
        company,
        date: requestDate,
        currency,
        nature,
        other,
        status: submit ? approval.status : "Draft",
        approvalPlan: submit ? approval.approvalPlan : undefined,
        approvalStep: submit ? approval.approvalStep : undefined,
        requireApValidation: submit ? approval.requireApValidation : undefined,
        lines,
        documents: docs,
        timeline: [
          "Draft created",
          ...(submit ? [`Requester attested and submitted · ${approval.approvalPlan.length ? approval.approvalPlan.join(" → ") : approval.requireApValidation ? "AP validation" : "Direct to QuickBooks"}`] : []),
        ],
      });
      } catch (error) {
        setValidationErrors([error instanceof Error ? error.message : "Could not save this request. Please try again."]);
      } finally {
        setSaving(false);
      }
    };
  return (
    <>
      <span className="eyebrow">Requester workspace</span>
      <div className="paper">
        <div className="company-head">
          <div className="svi-logo">{numberingRule.code}</div>
          <div>
            <strong>{company}</strong>
          </div>
        </div>
        <h1 className="form-title">REQUEST FOR PAYMENT FORM</h1>
        <div className="grid grid-2">
          <Field label="COMPANY NAME">
            <select
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            >
              {companies.map((companyName) => (
                <option key={companyName} value={companyName}>
                  {companyName}
                </option>
              ))}
            </select>
          </Field>
          <div className="numbering-rule-card">
            <span>NUMBERING RULE</span>
            <strong>{predictedInvoiceNumber}</strong>
            <small>
              Expected invoice number · updates live; {numberingRule.reset.toLowerCase()} reset
            </small>
          </div>
          <Field label="DATE">
            <input
              type="date"
              value={requestDate}
              onChange={(event) => setRequestDate(event.target.value)}
            />
          </Field>
          <Field label="REQUESTOR">
            <input value="Alex Rivera" readOnly />
          </Field>
          <Field label="PAYEE">
            <select
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
            >
              <option value="">Select a payee</option>
              {applicablePayees.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="CURRENCY">
            <select
              value={currency}
              onChange={(e) => {
                const nextCurrency = e.target.value;
                setCurrency(nextCurrency);
                if (payee && !isVendorCurrencyAllowed(payee, nextCurrency, vendorCurrencies)) setPayee("");
              }}
            >
              <option>PHP</option>
              <option>USD</option>
            </select>
          </Field>
        </div>
        <h2 className="section">Request line items</h2>
        {lines.map((l, i) => (
          <div className="line-grid" key={i}>
            <Field label="PROJECT CODE">
              <select
                value={l.project}
                onChange={(e) => change(i, "project", e.target.value)}
              >
                {projectCodes.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="ACCOUNT">
              <select
                value={l.account}
                onChange={(e) => change(i, "account", e.target.value)}
              >
                <option value="">Accounting to complete</option>
                {accountOptions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="PARTICULARS">
              <textarea
                value={l.particulars}
                onChange={(e) => change(i, "particulars", e.target.value)}
                placeholder="Describe the business purpose"
              />
            </Field>
            <Field label="AMOUNT">
              <input
                value={l.amount}
                onChange={(e) => change(i, "amount", e.target.value)}
              />
            </Field>
            <button
              className="button secondary"
              disabled={lines.length === 1}
              onClick={() => setLines((a) => a.filter((_, n) => n !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="button secondary"
          onClick={() =>
            setLines((a) => [
              ...a,
              {
                project: projectCodes[0] ?? "",
                account: "",
                particulars: "",
                amount: "",
              },
            ])
          }
        >
          + Add line
        </button>
        <div className="total">
          <span>TOTAL AMOUNT</span>
          <span>{cash(total(lines), currency)}</span>
        </div>
        <section className="nature-section"><div><span className="eyebrow">Payment classification</span><h2>NATURE OF PAYMENT</h2><p className="muted">Choose the category that best describes this request.</p></div><NaturePicker value={nature} options={natureOptions} onChange={setNature}/></section>
        <section className="supporting-documents" aria-labelledby="supporting-documents-title">
          <div className="supporting-documents-heading">
            <div>
              <h2 id="supporting-documents-title">Supporting Documents</h2>
              <p>Add receipts, invoices, or other files related to this request.</p>
            </div>
            <span className="document-count">{docs.length} / 30</span>
          </div>
          <label
            className={`document-dropzone${isDraggingDocuments ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingDocuments(true);
            }}
            onDragLeave={() => setIsDraggingDocuments(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingDocuments(false);
              void readDocuments(event.dataTransfer.files);
            }}
          >
            <input
              className="document-file-input"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
              aria-label="Choose supporting documents"
              onChange={(event) => {
                void readDocuments(event.target.files);
                event.target.value = "";
              }}
            />
            <span className="document-upload-icon" aria-hidden="true">↑</span>
            <span className="document-drop-title">Drop files here, or <strong>browse</strong></span>
            <span className="document-drop-note">PDF, images, Word, or Excel · Up to 30 files</span>
          </label>
          {documentError && <p className="document-error" role="alert">{documentError}</p>}
          {docs.length > 0 && (
            <ul className="document-list" aria-label="Attached supporting documents">
              {docs.map((document, index) => (
                <li className="document-list-item" key={`${document.name}-${index}`}>
                  <span className="document-file-badge" aria-hidden="true">
                    {document.name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}
                  </span>
                  <span className="document-file-name" title={document.name}>{document.name}</span>
                  <button
                    className="document-remove"
                    type="button"
                    aria-label={`Remove ${document.name}`}
                    onClick={() => setDocs((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="attest">
          <input type="checkbox" defaultChecked /> I certify that this request
          is complete and accurate.
        </div>
        {validationErrors.length > 0 && (
          <div className="validation-summary" role="alert" aria-live="assertive">
            <strong>Please review the following:</strong>
            <ul>
              {validationErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
            <small>Formatted amounts such as 1,500.00 are accepted.</small>
          </div>
        )}
        <div className="actions">
          <button className="button secondary" disabled={saving} onClick={() => void done(false)}>
            {saving ? "Assigning number…" : "Save draft"}
          </button>
          <button className="button" disabled={saving} onClick={() => void done(true)}>
            {saving ? "Assigning number…" : "Attest and submit"}
          </button>
        </div>
      </div>
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
function NaturePicker({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { setOpen(false); setQuery(""); };
  return <div className="nature-picker">
    <button className="nature-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(true)}><span className="nature-trigger-icon">◎</span><span><small>Selected category</small><strong>{value}</strong></span><span className="nature-chevron">⌄</span></button>
    {open && typeof document !== "undefined" && createPortal(<div className="prototype nature-portal"><button className="nature-backdrop" type="button" aria-label="Close nature of payment options" onClick={close}/><section className="nature-menu" role="dialog" aria-modal="true" aria-label="Select nature of payment">
      <div className="nature-menu-head"><div><span className="eyebrow">Nature of payment</span><h3>Select a category</h3><p>Choose the option that best matches this request.</p></div><button className="nature-close" type="button" aria-label="Close" onClick={close}>×</button></div>
      <div className="nature-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${options.length} payment types`} aria-label="Search nature of payment options"/></div>
      <div className="nature-options" role="listbox">{visibleOptions.map((option, index) => <button type="button" role="option" aria-selected={value === option} className={`nature-option ${value === option ? "active" : ""}`} key={option} onClick={() => { onChange(option); close(); }}><span className="nature-option-number">{String(index + 1).padStart(2, "0")}</span><span>{option}</span>{value === option && <span className="nature-check">✓</span>}</button>)}{!visibleOptions.length && <div className="nature-empty">No matching payment type.</div>}</div>
      <footer><span>{visibleOptions.length} option{visibleOptions.length === 1 ? "" : "s"}</span><button className="button secondary" type="button" onClick={close}>Cancel</button></footer>
    </section></div>, document.body)}
  </div>;
}
function Details({
  role,
  request,
  update,
  undoStatusAction,
  notify,
  projectCodes,
  accountOptions,
  payeeOptions,
  vendorCurrencies,
  natureOptions,
  workflows,
}: {
  role: Role;
  request: Req;
  update: (id: string, c: Partial<Req>, e: string) => void;
  undoStatusAction: (id: string) => void;
  notify: (x: string) => void;
  projectCodes: string[];
  accountOptions: string[];
  payeeOptions: string[];
  vendorCurrencies: MasterData["vendorCurrencies"];
  natureOptions: string[];
  workflows: MasterData["workflows"];
}) {
  const [generating, setGenerating] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Attachment | null>(null);
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [draft, setDraft] = useState(() => ({ payee: request.payee, currency: request.currency, nature: request.nature, other: request.other, lines: request.lines.map((line) => ({ ...line })), documents: [...request.documents] }));
  const applicablePayees = payeeOptions.filter((option) => isVendorCurrencyAllowed(option, draft.currency, vendorCurrencies));
  const requesterRevision = role === "Requester" && ["Draft", "Returned for Revision"].includes(request.status);
  const operationalEditor = ["Approver", "AP Processor", "AP Reviewer", "Administrator"].includes(role);
  const canEdit = requesterRevision || operationalEditor;
  const beginEdit = () => {
    setDraft({ payee: request.payee, currency: request.currency, nature: request.nature, other: request.other, lines: request.lines.map((line) => ({ ...line })), documents: [...request.documents] });
    setEditReason("");
    setEditing(true);
  };
  const changeDraftLine = (index: number, field: keyof Line, value: string) => setDraft((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }));
  const addRevisionDocuments = async (files: FileList | null) => {
    const additions = await Promise.all(Array.from(files ?? []).map(async (file): Promise<Attachment> => {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") return { name: file.name, type: file.type };
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      return { name: file.name, type: file.type, dataUrl };
    }));
    setDraft((current) => ({ ...current, documents: [...current.documents, ...additions] }));
  };
  const saveEdits = (resubmit: boolean) => {
    const validationErrors = getPrototypeRequestErrors(draft.payee, draft.nature, draft.lines);
    if (validationErrors.length) { notify(validationErrors[0]); return; }
    if (!isVendorCurrencyAllowed(draft.payee, draft.currency, vendorCurrencies)) { notify("Choose a vendor available for the selected currency."); return; }
    if (operationalEditor && !editReason.trim()) { notify("Enter an edit reason for the audit timeline"); return; }
    const event = requesterRevision ? (resubmit ? "Requester revised fields and resubmitted" : "Requester saved revised draft") : `${role} edited request data · ${editReason.trim()}`;
    const approval = resolvePrototypeApproval(draft.nature, total(draft.lines), workflows);
    update(request.id, { ...draft, ...(requesterRevision && resubmit ? { status: approval.status, approvalPlan: approval.approvalPlan, approvalStep: 0, requireApValidation: approval.requireApValidation } : { status: request.status }) }, event);
    setEditing(false);
    notify(resubmit ? "Revision submitted" : "Changes saved and audited");
  };
  const act = (s: Status, e: string) => {
      update(request.id, { status: s }, e);
      notify(e);
    },
    approveStage = (stage: ApprovalPlanStep, actor: string) => {
      const plan = requestApprovalPlan(request);
      const currentStep = requestApprovalStepIndex(request, plan);
      const nextStep = currentStep + 1;
      const nextStage = plan[nextStep];
      const status: Status = nextStage === "Manager Approval" ? "Pending Manager Approval" : nextStage === "Accounting Review" ? "Pending Accounting Review" : nextStage === "AP Validation" ? "Pending AP Validation" : "Ready for QuickBooks";
      update(request.id, { status, approvalPlan: plan, approvalStep: nextStep }, `${stage} approved by ${actor}`);
      notify(`${stage} approved`);
    };
  const generateInvoice = async () => {
    setGenerating(true);
    try {
      await downloadInvoicePdf(request);
      update(request.id, {}, "Invoice PDF generated");
      notify("Invoice PDF downloaded");
    } catch (error) {
      console.error(error);
      notify("Could not generate invoice PDF");
    } finally {
      setGenerating(false);
    }
  };
  const generateSaasantBill = () => {
    downloadSaasantBillCsv(request);
    update(request.id, {}, "SaaSAnt Bill CSV generated");
    notify("SaaSAnt Bill CSV downloaded");
  };
  const requestApprovalSteps = requestApprovalPlan(request);
  const activeApprovalStep = requestApprovalStepIndex(request, requestApprovalSteps);
  const executionSteps = ["Request Submitted", ...requestApprovalSteps.map((step) => step === "AP Validation" ? "AP Processor: Validate" : step), "AP Processor: Generate CSV & Post", "Posted to QuickBooks"];
  const currentExecutionStep = request.status === "Pending Manager Approval" || request.status === "Pending Accounting Review"
    ? 1 + activeApprovalStep
    : request.status === "Pending AP Validation" || request.status === "Manager Approved"
      ? 1 + activeApprovalStep
      : request.status === "Ready for QuickBooks"
        ? 1 + requestApprovalSteps.length
        : ["Posted to QuickBooks", "Paid", "Reconciled", "Closed"].includes(request.status)
          ? executionSteps.length - 1
        : 0;
  return (
    <>
      <div className="form-head">
        <div>
          <span className="eyebrow">{request.company}</span>
          <h1>{request.number}</h1>
          <span className="badge">{request.status}</span>
        </div>
        <div className="actions">
          {canEdit && <button className="button secondary" onClick={beginEdit}>{requesterRevision ? "Revise request" : "Edit request data"}</button>}
          <button className="button secondary" onClick={() => window.print()}>
            Print request
          </button>
          <button
            className="button"
            disabled={generating}
            onClick={generateInvoice}
          >
            {generating ? "Generating..." : "Generate Invoice PDF"}
          </button>
          <button className="button" onClick={generateSaasantBill}>
            Generate SaaSAnt Bill CSV
          </button>
        </div>
      </div>
      {editing && <section className="paper request-editor">
        <div className="form-head"><div><span className="eyebrow">{requesterRevision ? "Revision workspace" : "Controlled AP edit"}</span><h2>{requesterRevision ? "Revise returned request" : "Edit request data and descriptions"}</h2><p className="muted">Every saved change is recorded in the immutable timeline.</p></div><button className="icon-button" aria-label="Close editor" onClick={() => setEditing(false)}>×</button></div>
        <div className="grid grid-2"><Field label="PAYEE"><select value={draft.payee} onChange={(event) => setDraft((current) => ({ ...current, payee: event.target.value }))}><option value="">Select a payee</option>{applicablePayees.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><Field label="CURRENCY"><select value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value, payee: isVendorCurrencyAllowed(current.payee, event.target.value, vendorCurrencies) ? current.payee : "" }))}><option>PHP</option><option>USD</option></select></Field></div><div className="section"><Field label="NATURE OF PAYMENT"><NaturePicker value={draft.nature} options={natureOptions} onChange={(nature) => setDraft((current) => ({ ...current, nature, other: "" }))}/></Field></div>
        <h2 className="section">Request line items</h2>
        {draft.lines.map((line, index) => <div className="line-grid" key={index}><Field label="PROJECT CODE"><select value={line.project} onChange={(event) => changeDraftLine(index, "project", event.target.value)}>{projectCodes.map((project) => <option key={project}>{project}</option>)}</select></Field><Field label="ACCOUNT"><select value={line.account} onChange={(event) => changeDraftLine(index, "account", event.target.value)}><option value="">Accounting to complete</option>{accountOptions.map((account) => <option key={account}>{account}</option>)}</select></Field><Field label="PARTICULARS / DESCRIPTION"><textarea value={line.particulars} onChange={(event) => changeDraftLine(index, "particulars", event.target.value)}/></Field><Field label="AMOUNT"><input inputMode="decimal" value={line.amount} onChange={(event) => changeDraftLine(index, "amount", event.target.value)}/></Field><button className="button secondary" disabled={draft.lines.length === 1} onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}>×</button></div>)}
        <div className="editor-toolbar"><button className="button secondary" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, { project: projectCodes[0] ?? "", account: "", particulars: "", amount: "" }] }))}>+ Add line</button><strong>Total: {cash(total(draft.lines), draft.currency)}</strong></div>
        <h2 className="section">Supporting documents</h2><label className="upload">Add revised documents<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" onChange={(event) => void addRevisionDocuments(event.target.files)}/></label><div className="actions">{draft.documents.map((document, index) => <span className="badge green" key={`${document.name}-${index}`}>{document.name}<button className="badge-remove" aria-label={`Remove ${document.name}`} onClick={() => setDraft((current) => ({ ...current, documents: current.documents.filter((_, documentIndex) => documentIndex !== index) }))}>×</button></span>)}</div>
        {operationalEditor && <Field label="EDIT REASON (REQUIRED FOR AUDIT)"><textarea value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Explain why AP or the reviewer changed the request"/></Field>}
        <div className="actions section"><button className="button secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button secondary" onClick={() => saveEdits(false)}>Save changes</button>{requesterRevision && <button className="button" onClick={() => saveEdits(true)}>Save & resubmit</button>}</div>
      </section>}
      <div className="grid grid-2">
        <section className="card">
          <h2>REQUEST FOR PAYMENT FORM</h2>
          <dl>
            <dt>REQUESTOR</dt>
            <dd>{request.requester}</dd>
            <dt>PAYEE</dt>
            <dd>{request.payee}</dd>
            <dt>DATE / CURRENCY</dt>
            <dd>
              {request.date} · {request.currency}
            </dd>
            <dt>INVOICE NUMBER</dt>
            <dd>
              {request.invoiceNumber ??
                generateInvoiceNumber(
                  request.company,
                  request.date,
                  request.number,
                )}
            </dd>
            <dt>NATURE OF PAYMENT</dt>
            <dd>
              {request.nature} {request.other}
            </dd>
          </dl>
        </section>
        <section className="card">
          <h2>Supporting Documents</h2>
          {request.documents.length ? (
            <div className="attachment-grid">
              {request.documents.map((document) => (
                <button className="attachment-card" type="button" key={document.name} onClick={() => setPreviewDocument(document)}>
                  {document.dataUrl && document.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={document.dataUrl}
                      alt={`Preview of ${document.name}`}
                    />
                  ) : (
                    <span className="attachment-icon">
                      {document.type === "application/pdf" ? "PDF" : "DOC"}
                    </span>
                  )}
                  <span>
                    <strong>{document.name}</strong>
                    <small>
                      {document.dataUrl
                        ? "Open preview"
                        : "Open document details"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="notice">Missing documents</div>
          )}
        </section>
      </div>
      <Table rows={[request]} open={() => {}} />
      <section className="card section">
        <h2>{role} actions</h2>
        {role !== "Auditor" && request.statusHistory?.length ? <div className="status-undo-panel"><div><strong>Previous status: {request.statusHistory[request.statusHistory.length - 1].status}</strong><small>Undo the most recent status or approval step for this request.</small></div><button className="button secondary" type="button" onClick={() => { undoStatusAction(request.id); notify("Last status action undone"); }}>Undo last status action</button></div> : null}
        <div className="actions">
          {role === "Approver" &&
            request.status === "Pending Manager Approval" && (
              <>
                <button
                  className="button"
                  onClick={() =>
                    approveStage("Manager Approval", "Jordan Reyes")
                  }
                >
                  Approve
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    act(
                      "Returned for Revision",
                      "Returned: clarify particulars",
                    )
                  }
                >
                  Return
                </button>
                <button
                  className="button danger"
                  onClick={() => act("Rejected", "Rejected")}
                >
                  Reject
                </button>
              </>
            )}
          {role === "AP Reviewer" && request.status === "Pending Accounting Review" && (
            <>
              <button className="button" onClick={() => approveStage("Accounting Review", "Taylor Cruz")}>Approve accounting review</button>
              <button className="button secondary" onClick={() => act("Returned for Revision", "Accounting review returned for revision")}>Return</button>
              <button className="button danger" onClick={() => act("Rejected", "Rejected during accounting review")}>Reject</button>
            </>
          )}
          {role === "AP Processor" &&
            ["Manager Approved", "Pending AP Validation"].includes(
            request.status,
            ) && (
              <>
                <button className="button" onClick={() => approveStage("AP Validation", "Morgan Lee")}>
                  {requestApprovalPlan(request)[requestApprovalStepIndex(request, requestApprovalPlan(request)) + 1] === "Accounting Review" ? "Validate & send to AP Reviewer" : "Complete AP validation"}
                </button>
                <button className="button secondary" onClick={() => act("Returned for Revision", "AP Processor found an issue and returned the request to the Requestor")}>Return to Requestor</button>
              </>
            )}
          {role === "AP Processor" &&
            request.status === "Ready for QuickBooks" && (
              <button
                className="button"
                onClick={() => {
                  downloadSaasantBillCsv(request);
                  update(
                    request.id,
                    {
                      status: "Posted to QuickBooks",
                      qbId: `QB-DEMO-${request.id.slice(-4)}`,
                    },
                    "SaaSAnt-compatible bill CSV generated and posting confirmed",
                  );
                  notify("Matching SaaSAnt bill CSV downloaded and posted to QuickBooks");
                }}
              >
                Generate QB CSV & Post
              </button>
            )}
          {role === "AP Processor" &&
            request.status === "Posted to QuickBooks" && (
              <button
                className="button"
                onClick={() => act("Paid", "Payment recorded: PAY-DEMO")}
              >
                Record Payment
              </button>
            )}
          {role.includes("AP") && request.status === "Paid" && (
            <button
              className="button"
              onClick={() => act("Reconciled", "Bank payment reconciled")}
            >
              Reconcile
            </button>
          )}
          {role === "AP Reviewer" && request.status === "Reconciled" && (
            <button
              className="button"
              onClick={() => act("Closed", "Reviewed and closed")}
            >
              Close
            </button>
          )}
          {role === "Requester" &&
            request.status === "Returned for Revision" && (
              <span className="notice">Select “Revise request” above to update fields, replace documents, and resubmit.</span>
            )}
          {role === "Auditor" && (
            <span className="notice">Read-only access enforced</span>
          )}
        </div>
      </section>
      <section className="card section">
        <h2>Workflow Timeline</h2>
        <p className="muted">The submitted diagram is executed step by step. Repeated stages show approved loops or returns to an earlier block.</p>
        <ol className="workflow-execution-timeline">{executionSteps.map((step, index) => <li className={index < currentExecutionStep ? "completed" : index === currentExecutionStep ? "current" : "upcoming"} key={`${step}-${index}`}><b>{index}</b><span><strong>{step}</strong><small>{index < currentExecutionStep ? "Completed" : index === currentExecutionStep ? "Current step" : "Upcoming"}</small></span></li>)}</ol>
      </section>
      <section className="card section">
        <h2>Immutable Timeline</h2>
        <ol className="timeline">
          {request.timeline.map((e, i) => (
            <li key={i}>
              <strong>{e}</strong>
              <div className="fine">Demo event #{i + 1}</div>
            </li>
          ))}
        </ol>
      </section>
      {previewDocument && typeof document !== "undefined" && createPortal(<div className="prototype document-preview-portal"><div className="document-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewDocument(null); }}><section className="document-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${previewDocument.name}`}>
        <header><div><span className="eyebrow">Supporting document</span><h2>{previewDocument.name}</h2><p className="muted">{previewDocument.type || "Unknown file type"}</p></div><button className="icon-button" aria-label="Close preview" onClick={() => setPreviewDocument(null)}>×</button></header>
        <div className="document-preview-body">{previewDocument.dataUrl && previewDocument.type.startsWith("image/") ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewDocument.dataUrl} alt={`Full preview of ${previewDocument.name}`}/>
        </> : previewDocument.type === "application/pdf" ? <PdfPreview document={previewDocument}/> : <div className="document-unavailable"><span className="attachment-icon">DOC</span><h3>Preview is unavailable for this file type</h3><p>Image and PDF files can be previewed directly inside the workflow.</p></div>}</div>
        <footer><span className="fine">Preview stays inside the workflow simulation.</span>{previewDocument.dataUrl && <a className="button secondary" href={previewDocument.dataUrl} target="_blank" rel="noreferrer">Open in new tab</a>}</footer>
      </section></div></div>, document.body)}
    </>
  );
}
function PdfPreview({ document }: { document: Attachment }) {
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const load = async () => {
      try {
        let blob: Blob;
        if (document.dataUrl) {
          const encoded = document.dataUrl.split(",")[1];
          if (!encoded) throw new Error("Invalid PDF attachment data");
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
          blob = new Blob([bytes], { type: "application/pdf" });
        } else {
          const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
          const pdf = await PDFDocument.create();
          const page = pdf.addPage([595, 842]);
          const regular = await pdf.embedFont(StandardFonts.Helvetica);
          const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
          page.drawText("SVI Supporting Document", { x: 54, y: 760, size: 20, font: bold, color: rgb(0.1, 0.1, 0.12) });
          page.drawText(document.name, { x: 54, y: 718, size: 13, font: bold, color: rgb(0.05, 0.38, 0.76), maxWidth: 480 });
          page.drawText("Simulation preview", { x: 54, y: 680, size: 10, font: regular, color: rgb(0.45, 0.45, 0.48) });
          page.drawText("The original binary is not included in this seeded record.", { x: 54, y: 640, size: 11, font: regular, color: rgb(0.25, 0.25, 0.28) });
          page.drawText("Upload an actual PDF to preview its complete contents and pages.", { x: 54, y: 620, size: 11, font: regular, color: rgb(0.25, 0.25, 0.28) });
          const bytes = await pdf.save();
          blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) setSource(objectUrl);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not prepare PDF preview");
      }
    };
    void load();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [document.dataUrl, document.name]);
  if (error) return <div className="document-unavailable"><span className="attachment-icon">PDF</span><h3>PDF preview could not be prepared</h3><p>{error}</p></div>;
  if (!source) return <div className="pdf-loading"><span/><strong>Preparing secure PDF preview…</strong></div>;
  return <iframe src={source} title={document.name}/>;
}
function Settings({
  masterData,
  onChange,
  notify,
}: {
  masterData: MasterData;
  onChange: React.Dispatch<React.SetStateAction<MasterData>>;
  notify: (message: string) => void;
}) {
  const [workflowNature, setWorkflowNature] = useState(masterData.natureOfPayments[0] ?? "");
  useEffect(() => {
    if (!masterData.natureOfPayments.includes(workflowNature)) {
      setWorkflowNature(masterData.natureOfPayments[0] ?? "");
    }
  }, [masterData.natureOfPayments, workflowNature]);
  const updateList = (key: "projects" | "accounts" | "payees", values: string[]) =>
    onChange((current) => ({
      ...current,
      [key]: values,
      ...(key === "payees" ? { vendorCurrencies: Object.fromEntries(values.map((payee) => [payee, current.vendorCurrencies[payee] ?? "BOTH"])) } : {}),
    }));
  const updateVendorCurrency = (payee: string, currency: VendorCurrency) => {
    onChange((current) => ({ ...current, vendorCurrencies: { ...current.vendorCurrencies, [payee]: currency } }));
    notify(`${payee} currency availability updated`);
  };
  const updateNatureOptions = (values: string[]) => onChange((current) => {
    const removed = current.natureOfPayments.filter((nature) => !values.includes(nature));
    const added = values.filter((nature) => !current.natureOfPayments.includes(nature));
    const renamedFrom = removed.length === 1 && added.length === 1 ? removed[0] : undefined;
    const renamedTo = renamedFrom ? added[0] : undefined;
    const workflows = Object.fromEntries(values.map((nature) => [
      nature,
      current.workflows[nature]
        ?? (nature === renamedTo && renamedFrom ? current.workflows[renamedFrom] : undefined)
        ?? { ...defaultWorkflow, diagram: clonePrototypeDiagram() },
    ]));
    return { ...current, natureOfPayments: values, workflows };
  });
  const workflow = masterData.workflows[workflowNature] ?? defaultWorkflow;
  const previewAmount = Number(workflow.accountingThreshold.replaceAll(",", "")) || 0;
  const resolvedWorkflowPreview = resolvePrototypeApproval(workflowNature, previewAmount, { [workflowNature]: workflow });
  const diagramTrace = tracePrototypeDiagram(workflow, previewAmount);
  const updateWorkflow = (change: Partial<WorkflowControl>, announce = true) => {
    onChange((current) => ({ ...current, workflows: { ...current.workflows, [workflowNature]: { ...(current.workflows[workflowNature] ?? defaultWorkflow), ...change } } }));
    if (announce) notify(`${workflowNature} workflow updated`);
  };

  return (
    <>
      <section className="settings-hero">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Administration Settings</h1>
          <p className="muted">
            Manage approval workflows and master data for the complete AP process.
          </p>
        </div>
        <div className="settings-access">
          <span className="settings-lock">A</span>
          <span><small>Authorized access</small><strong>Administrator</strong></span>
        </div>
      </section>
      <div className="settings-summary">
        <Metric label="Workflow rules" value={Object.keys(masterData.workflows).length} />
        <Metric label="Project codes" value={masterData.projects.length} />
        <Metric label="Accounts" value={masterData.accounts.length} />
        <Metric label="Payees / vendors" value={masterData.payees.length} />
        <Metric label="Payment types" value={masterData.natureOfPayments.length} />
      </div>
      <section className="workflow-settings-card">
        <header className="workflow-settings-head"><div><span className="eyebrow">Approval process controls</span><h2>Workflow by Nature of Payment</h2><p>Select a payment type and define the stages a new or resubmitted request must follow.</p></div><span className="badge green">Auto-saved</span></header>
        <div className="workflow-settings-layout">
          <div className="field"><label>NATURE OF PAYMENT</label><select aria-label="NATURE OF PAYMENT" value={workflowNature} onChange={(event) => setWorkflowNature(event.target.value)}>{masterData.natureOfPayments.map((nature) => <option key={nature}>{nature}</option>)}</select></div>
          <div className="workflow-control-list">
            <label className="workflow-toggle"><input type="checkbox" checked={workflow.managerApproval} onChange={(event) => updateWorkflow({ managerApproval: event.target.checked })}/><span><strong>Manager approval</strong><small>Route to an Approver before AP processing.</small></span></label>
            <label className="workflow-toggle"><input type="checkbox" checked={workflow.accountingReview} onChange={(event) => updateWorkflow({ accountingReview: event.target.checked })}/><span><strong>Accounting review</strong><small>Add an AP Reviewer approval stage.</small></span></label>
            <label className="workflow-toggle"><input type="checkbox" checked={workflow.requireApValidation} onChange={(event) => updateWorkflow({ requireApValidation: event.target.checked })}/><span><strong>AP validation</strong><small>Require AP document and mapping validation after approvals.</small></span></label>
          </div>
          <div className="grid grid-2 workflow-fields">
            <div className="field"><label>ACCOUNTING THRESHOLD</label><input aria-label="ACCOUNTING THRESHOLD" inputMode="decimal" value={workflow.accountingThreshold} disabled={!workflow.accountingReview} onChange={(event) => updateWorkflow({ accountingThreshold: event.target.value })} placeholder="Always required when blank"/><span className="fine">Accounting review applies at or above this amount.</span></div>
            <div className="field"><label>APPROVAL SLA (HOURS)</label><input aria-label="APPROVAL SLA (HOURS)" type="number" min="1" max="720" value={workflow.slaHours} onChange={(event) => updateWorkflow({ slaHours: Math.min(720, Math.max(1, Number(event.target.value) || 1)) })}/></div>
          </div>
          <div className="workflow-preview"><span>Resolved route</span><div>{resolvedWorkflowPreview.approvalPlan.map((stage, index) => <span key={`${stage}-${index}`}>{index > 0 && <i>→</i>}<strong>{stage === "AP Validation" ? "AP Processor: Validate" : stage}{stage === "Accounting Review" && workflow.accountingThreshold ? ` ≥ ${workflow.accountingThreshold}` : ""}</strong></span>)}{!resolvedWorkflowPreview.approvalPlan.length && <strong>Direct to QuickBooks</strong>}<i>→</i><strong>AP Processor: Generate CSV &amp; Post</strong></div><small>SLA: {workflow.slaHours} hours per approval stage</small></div>
          <WorkflowDiagramEditor diagram={workflow.diagram ?? clonePrototypeDiagram()} active={{ manager: workflow.managerApproval, accounting: workflow.accountingReview, ap: workflow.requireApValidation }} trace={diagramTrace} onChange={(diagram) => updateWorkflow({ diagram }, false)} notify={notify}/>
        </div>
      </section>
      <div className="settings-grid">
        <MasterDataEditor
          icon="P"
          title="Project Codes"
          singular="project code"
          description="Used to classify spending by project or business unit."
          values={masterData.projects}
          onChange={(values) => updateList("projects", values)}
          notify={notify}
        />
        <MasterDataEditor
          icon="A"
          title="Accounts"
          singular="account"
          description="Controls the accounting categories available on line items."
          values={masterData.accounts}
          onChange={(values) => updateList("accounts", values)}
          notify={notify}
        />
        <MasterDataEditor
          icon="V"
          title="Payees / Vendors"
          singular="payee or vendor"
          description="Choose which currency each vendor accepts. Both keeps them available for PHP and USD requests."
          values={masterData.payees}
          onChange={(values) => updateList("payees", values)}
          vendorCurrencies={masterData.vendorCurrencies}
          onVendorCurrencyChange={updateVendorCurrency}
          notify={notify}
        />
        <MasterDataEditor
          icon="N"
          title="Nature of Payment"
          singular="payment type"
          description="Controls the payment categories available on new requests and their workflow settings."
          values={masterData.natureOfPayments}
          onChange={updateNatureOptions}
          notify={notify}
        />
      </div>
      <p className="settings-footnote">
        Changes save automatically. Workflow changes apply to new submissions and resubmissions; in-progress requests keep their submitted route.
      </p>
    </>
  );
}

const workflowNodeLabels: Record<PrototypeWorkflowNodeRole, string> = { request: "Requestor", manager: "Approver", accounting: "Accounting Review", apProcessor: "AP Processor", apReviewer: "AP Reviewer", treasury: "Treasury", recipient: "Recipient", quickbooks: "QuickBooks Ready" };
const branchConditionLabels: Record<PrototypeBranchCondition, string> = { ALWAYS: "Always", AMOUNT_GTE_THRESHOLD: "Amount ≥ threshold", AMOUNT_LT_THRESHOLD: "Amount < threshold" };

function WorkflowDiagramEditor({ diagram, active, trace, onChange, notify }: { diagram: PrototypeWorkflowDiagram; active: { manager: boolean; accounting: boolean; ap: boolean }; trace: ReturnType<typeof tracePrototypeDiagram>; onChange: (diagram: PrototypeWorkflowDiagram) => void; notify: (message: string) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<PrototypeWorkflowNodeId | null>(null);
  const [wirePoint, setWirePoint] = useState<{ x: number; y: number } | null>(null);
  const [branchCondition, setBranchCondition] = useState<PrototypeBranchCondition>("ALWAYS");
  const [newStageRole, setNewStageRole] = useState<PrototypeWorkflowNodeRole>("apProcessor");
  const [dragging, setDragging] = useState<{ id: PrototypeWorkflowNodeId; offsetX: number; offsetY: number } | null>(null);
  const roleOf = (id: PrototypeWorkflowNodeId) => normalizePrototypeDiagram(diagram).nodes.find((item) => item.id === id)?.role ?? "apProcessor";
  const labelOf = (id: PrototypeWorkflowNodeId) => workflowNodeLabels[roleOf(id)];
  const enabled = (id: PrototypeWorkflowNodeId) => { const role = roleOf(id); return role === "request" || role === "quickbooks" || (role === "manager" && active.manager) || (role === "accounting" && active.accounting) || ((role === "apProcessor" || role === "apReviewer") && active.ap) || role === "treasury" || role === "recipient"; };
  const node = (id: PrototypeWorkflowNodeId) => diagram.nodes.find((item) => item.id === id) ?? clonePrototypeDiagram().nodes[0];
  const canReach = (edges: PrototypeWorkflowDiagram["edges"], start: PrototypeWorkflowNodeId, target: PrototypeWorkflowNodeId) => { const pending: PrototypeWorkflowNodeId[] = [start]; const visited = new Set<PrototypeWorkflowNodeId>(); while (pending.length) { const current = pending.pop()!; if (current === target) return true; if (visited.has(current)) continue; visited.add(current); pending.push(...edges.filter((edge) => edge.from === current).map((edge) => edge.to)); } return false; };
  const reachesQuickBooks = canReach(diagram.edges, "request", "quickbooks");
  const selectConnectionNode = (id: PrototypeWorkflowNodeId) => {
    if (!connectionSource) { setConnectionSource(id); return; }
    const edges = diagram.edges.filter((edge) => !(edge.from === connectionSource && edge.condition === branchCondition));
    onChange({ ...diagram, edges: [...edges, { from: connectionSource, to: id, condition: branchCondition }] });
    notify(`${labelOf(connectionSource)} → ${labelOf(id)} (${branchConditionLabels[branchCondition]})`);
    setConnectionSource(null);
  };
  const beginConnection = (event: React.PointerEvent<HTMLButtonElement>, id: PrototypeWorkflowNodeId) => {
    event.stopPropagation();
    event.preventDefault();
    setConnectionSource(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setWirePoint({ x: (event.clientX - rect.left) * (900 / rect.width), y: (event.clientY - rect.top) * (420 / rect.height) });
  };
  const removeConnection = (index: number) => {
    onChange({ ...diagram, edges: diagram.edges.filter((_, edgeIndex) => edgeIndex !== index) });
    notify("Arrow removed");
  };
  const removeStage = (id: PrototypeWorkflowNodeId) => {
    onChange({ nodes: diagram.nodes.filter((item) => item.id !== id), edges: diagram.edges.filter((edge) => edge.from !== id && edge.to !== id) });
    notify(`${labelOf(id)} block and its arrows removed`);
  };
  const finishConnection = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(null);
    if (!connectionSource) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-workflow-input]")?.dataset.workflowInput;
    if (target) {
      const edges = diagram.edges.filter((edge) => !(edge.from === connectionSource && edge.condition === branchCondition));
      onChange({ ...diagram, edges: [...edges, { from: connectionSource, to: target, condition: branchCondition }] });
    }
    if (!connectMode || target) {
      setConnectionSource(null);
      setWirePoint(null);
    }
  };
  const addStage = () => {
    const matching = diagram.nodes.filter((item) => (item.role ?? roleOf(item.id)) === newStageRole).length;
    const id = `${newStageRole}-${matching + 1}-${Date.now().toString(36)}`;
    const x = Math.min(730, 100 + (diagram.nodes.length % 4) * 170);
    const y = diagram.nodes.length % 2 === 0 ? 285 : 25;
    onChange({ ...diagram, nodes: [...diagram.nodes, { id, role: newStageRole, x, y }] });
    notify(`${workflowNodeLabels[newStageRole]} block added. Connect it to place it in the route.`);
  };
  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: PrototypeWorkflowNodeId) => {
    if (connectMode) { selectConnectionNode(id); return; }
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const position = node(id); const scaleX = 900 / rect.width; const scaleY = 420 / rect.height;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ id, offsetX: (event.clientX - rect.left) * scaleX - position.x, offsetY: (event.clientY - rect.top) * scaleY - position.y });
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (connectionSource && rect) setWirePoint({ x: (event.clientX - rect.left) * (900 / rect.width), y: (event.clientY - rect.top) * (420 / rect.height) });
    if (!dragging) return;
    if (!rect) return;
    const x = Math.min(750, Math.max(0, (event.clientX - rect.left) * (900 / rect.width) - dragging.offsetX));
    const y = Math.min(350, Math.max(0, (event.clientY - rect.top) * (420 / rect.height) - dragging.offsetY));
    onChange({ ...diagram, nodes: diagram.nodes.map((item) => item.id === dragging.id ? { ...item, x, y } : item) });
  };
  return <section className="diagram-editor">
    <header className="diagram-toolbar"><div><span className="eyebrow">Visual workflow designer</span><h3>Build a multi-step approval route</h3><p>Drag from a blue output handle to a green input handle. Click an arrow to remove it.</p></div><div className="actions"><button type="button" className={`button ${connectMode ? "" : "secondary"}`} onClick={() => { setConnectMode((value) => !value); setConnectionSource(null); setWirePoint(null); }}>{connectMode ? "Close arrow settings" : "Arrow settings"}</button><button type="button" className="button secondary" onClick={() => { onChange(clonePrototypeDiagram()); setConnectionSource(null); setWirePoint(null); notify("Workflow diagram reset"); }}>Reset layout</button></div></header>
    <div className="diagram-add-stage"><label>Add a stage<select value={newStageRole} onChange={(event) => setNewStageRole(event.target.value as PrototypeWorkflowNodeRole)}><option value="manager">Approver</option><option value="accounting">Accounting Review</option><option value="apProcessor">AP Processor</option><option value="apReviewer">AP Reviewer</option><option value="treasury">Treasury</option><option value="recipient">Recipient</option></select></label><button type="button" className="button secondary" onClick={addStage}>Add block</button><small>You can add a role again to create a separate step.</small></div>
    {connectMode && <div className="diagram-connect-controls"><div className="diagram-help">Drag between the blue output and green input handles. Drop on the same block to make a loop.</div><label>Condition for the next arrow<select value={branchCondition} onChange={(event) => setBranchCondition(event.target.value as PrototypeBranchCondition)}><option value="ALWAYS">Always</option><option value="AMOUNT_GTE_THRESHOLD">Amount ≥ threshold</option><option value="AMOUNT_LT_THRESHOLD">Amount &lt; threshold</option></select></label></div>}
    {!reachesQuickBooks && <div className="notice">This diagram does not currently have a route to QuickBooks. Cycles are allowed and execute as one bounded pass per submission.</div>}
    <div className={`workflow-canvas ${connectMode || connectionSource ? "connecting" : ""}`} ref={canvasRef} onPointerMove={pointerMove} onPointerUp={finishConnection} onPointerCancel={() => { setDragging(null); setConnectionSource(null); setWirePoint(null); }}>
      <svg viewBox="0 0 900 420" preserveAspectRatio="none" aria-label="Workflow connections"><defs><marker id="workflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{diagram.edges.map((edge, index) => {
        const from = node(edge.from), to = node(edge.to), isSelfLoop = edge.from === edge.to;
        const loopOnRight = from.x < 650;
        const sideX = loopOnRight ? from.x + 145 : from.x;
        const loopX = loopOnRight ? from.x + 220 : from.x - 75;
        const path = isSelfLoop
          ? `M ${sideX} ${from.y + 17} C ${loopX} ${from.y - 18}, ${loopX} ${from.y + 80}, ${sideX} ${from.y + 48}`
          : `M ${from.x + 145} ${from.y + 31} C ${from.x + 185} ${from.y + 31 + index * 2}, ${to.x - 40} ${to.y + 31 - index * 2}, ${to.x} ${to.y + 31}`;
        const midX = isSelfLoop ? loopX : (from.x + 145 + to.x) / 2;
        const midY = isSelfLoop ? from.y + 31 : (from.y + to.y) / 2 + 23;
        return <g key={`${edge.from}-${edge.to}-${edge.condition}`}><path className="workflow-edge-hit" d={path} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeConnection(index); }} /><path className={`workflow-edge ${edge.condition === "ALWAYS" ? "" : "conditional"} ${isSelfLoop ? "self-loop" : ""}`} d={path} markerEnd="url(#workflow-arrow)" pointerEvents="none" />{edge.condition !== "ALWAYS" && <text className="workflow-edge-label" textAnchor={isSelfLoop ? "middle" : undefined} x={midX} y={midY}>{edge.condition === "AMOUNT_GTE_THRESHOLD" ? "≥ threshold" : "< threshold"}</text>}</g>;
      })}</svg>
      {connectionSource && wirePoint && <svg className="workflow-wire-preview" viewBox="0 0 900 420" preserveAspectRatio="none"><path d={`M ${node(connectionSource).x + 145} ${node(connectionSource).y + 31} Q ${(node(connectionSource).x + 145 + wirePoint.x) / 2} ${(node(connectionSource).y + 31 + wirePoint.y) / 2 - 25} ${wirePoint.x} ${wirePoint.y}`} /></svg>}
      {diagram.nodes.map((item) => { const hasSelfLoop = diagram.edges.some((edge) => edge.from === item.id && edge.to === item.id); const role = item.role ?? roleOf(item.id); const left = `${item.x / 9}%`; const top = `${item.y / 4.2}%`; const position = { left, top }; return <Fragment key={item.id}><button type="button" aria-label={`${workflowNodeLabels[role]} block`} className={`workflow-node ${enabled(item.id) ? "" : "disabled"} ${connectionSource === item.id ? "source" : ""} ${hasSelfLoop ? "has-self-loop" : ""}`} style={position} onPointerDown={(event) => pointerDown(event, item.id)}><small>{item.id === "request" || item.id === "quickbooks" ? "System" : "Control"}</small><strong>{workflowNodeLabels[role]}</strong><span>{enabled(item.id) ? "Active" : "Skipped"}</span>{hasSelfLoop && <em className="workflow-loop-badge">↻ Loop</em>}</button><button type="button" className="workflow-node-handle workflow-output-handle" style={{ left: `calc(${left} + 16.1%)`, top: `calc(${top} + 31px)` }} aria-label={`Start an arrow from ${labelOf(item.id)}`} onPointerDown={(event) => beginConnection(event, item.id)}>●</button><button type="button" data-workflow-input={item.id} className="workflow-node-handle workflow-input-handle" style={{ left, top: `calc(${top} + 31px)` }} aria-label={`Connect an arrow to ${labelOf(item.id)}`}>●</button>{item.id !== "request" && item.id !== "quickbooks" && <button type="button" className="workflow-node-remove" style={{ left: `calc(${left} + 15.5%)`, top: `calc(${top} - 7px)` }} title={`Remove ${labelOf(item.id)}`} aria-label={`Remove ${labelOf(item.id)} block`} onPointerDown={(event) => event.stopPropagation()} onClick={() => removeStage(item.id)}>×</button>}</Fragment>; })}
    </div>
    <div className="diagram-timeline"><span>Step-by-step preview</span><ol>{trace.steps.map((step, index) => <li className={index === trace.steps.length - 1 && trace.loopDetected ? "loop" : ""} key={`${step}-${index}`}><b>{index}</b><span>{workflowNodeLabels[step]}</span>{index === trace.steps.length - 1 && trace.loopDetected && <em>Loop returns here</em>}</li>)}</ol><small>{trace.reachedQuickBooks ? "Route reaches QuickBooks." : trace.loopDetected ? "Execution stops after one loop pass to prevent an infinite workflow." : "Add another connection to continue this route."}</small></div>
    <div className="diagram-edge-list"><span>Connections</span>{diagram.edges.map((edge) => <button type="button" key={`${edge.from}-${edge.to}-${edge.condition}`} onClick={() => { onChange({ ...diagram, edges: diagram.edges.filter((item) => item !== edge) }); notify("Connection removed"); }}>{labelOf(edge.from)} → {labelOf(edge.to)} <em>{branchConditionLabels[edge.condition]}</em> <b>×</b></button>)}</div>
  </section>;
}

function MasterDataEditor({
  icon,
  title,
  singular,
  description,
  values,
  onChange,
  notify,
  allowEdit = true,
  vendorCurrencies,
  onVendorCurrencyChange,
}: {
  icon: string;
  title: string;
  singular: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
  notify: (message: string) => void;
  allowEdit?: boolean;
  vendorCurrencies?: MasterData["vendorCurrencies"];
  onVendorCurrencyChange?: (payee: string, currency: VendorCurrency) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const duplicate = (value: string, ignoredIndex = -1) =>
    values.some(
      (item, index) =>
        index !== ignoredIndex && item.toLowerCase() === value.toLowerCase(),
    );
  const add = () => {
    const value = draft.trim();
    if (!value) return notify(`Enter a ${singular}`);
    if (duplicate(value)) return notify(`${value} already exists`);
    onChange([...values, value]);
    setDraft("");
    notify(`${value} added`);
  };
  const saveEdit = (index: number) => {
    const value = editValue.trim();
    if (!value) return notify(`${title} cannot contain a blank value`);
    if (duplicate(value, index)) return notify(`${value} already exists`);
    onChange(values.map((item, itemIndex) => itemIndex === index ? value : item));
    setEditing(null);
    notify(`${singular} updated`);
  };
  const remove = (index: number) => {
    const value = values[index];
    if (values.length === 1) return notify(`Keep at least one ${singular}`);
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
    if (editing === index) setEditing(null);
    notify(`${value} removed`);
  };

  return (
    <section className="master-card">
      <header className="master-card-head">
        <span className="master-icon">{icon}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
        <span className="master-count">{values.length}</span>
      </header>
      <div className="master-add">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") add(); }}
          placeholder={`Add ${singular}`}
          aria-label={`Add ${singular}`}
        />
        <button className="button" type="button" onClick={add}>Add</button>
      </div>
      <div className="master-list">
        {values.map((value, index) => (
          <div className={`master-row ${vendorCurrencies ? "vendor-master-row" : ""} ${editing === index ? "editing" : ""}`} key={`${value}-${index}`}>
            {editing === index ? (
              <input
                autoFocus
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveEdit(index);
                  if (event.key === "Escape") setEditing(null);
                }}
                aria-label={`Edit ${value}`}
              />
            ) : <span>{value}</span>}
            {vendorCurrencies && onVendorCurrencyChange && <select aria-label={`Currency availability for ${value}`} value={vendorCurrencies[value] ?? "BOTH"} onChange={(event) => onVendorCurrencyChange(value, event.target.value as VendorCurrency)}><option value="PHP">PHP only</option><option value="USD">USD only</option><option value="BOTH">PHP &amp; USD</option></select>}
            <div className="master-row-actions">
              {editing === index ? <>
                <button type="button" onClick={() => saveEdit(index)}>Save</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </> : <>
                {allowEdit && <button type="button" onClick={() => { setEditing(index); setEditValue(value); }}>Edit</button>}
                <button className="danger-link" type="button" onClick={() => remove(index)}>Remove</button>
              </>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reports({ rows }: { rows: Req[] }) {
  const workflowStages: [string, Status[]][] = [["Draft", ["Draft"]], ["Manager approval", ["Pending Manager Approval", "Manager Approved"]], ["Accounting review", ["Pending Accounting Review"]], ["AP review", ["Pending AP Validation"]], ["QuickBooks", ["Ready for QuickBooks", "Posted to QuickBooks"]], ["Payment & reconciliation", ["Paid", "Reconciled"]], ["Closed", ["Closed"]], ["Exceptions", ["Returned for Revision", "Rejected"]]];
  const statusData = workflowStages.map(([label, statuses]): [string, number] => [label, rows.filter((request) => statuses.includes(request.status)).length]).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const natureData = Object.entries(rows.filter((request) => request.currency === "PHP").reduce<Record<string, number>>((summary, request) => ({ ...summary, [request.nature]: (summary[request.nature] ?? 0) + total(request.lines) }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const dailyData = Object.entries(rows.reduce<Record<string, number>>((summary, request) => ({ ...summary, [request.date]: (summary[request.date] ?? 0) + 1 }), {})).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  const statusLeader = statusData[0]?.[0] ?? "No status";
  const natureLeader = natureData[0]?.[0] ?? "No payment type";
  const phpValue = rows.filter((request) => request.currency === "PHP").reduce((sum, request) => sum + total(request.lines), 0);
  const awaitingAction = rows.filter((request) => !["Closed", "Rejected"].includes(request.status)).length;
  const completed = rows.filter((request) => request.status === "Closed").length;
  return (
    <>
      <div className="reports-hero"><div><span className="eyebrow">Management reporting</span><h1>Request Portfolio</h1><p className="muted">A clear view of workload, financial exposure, and request movement.</p></div><div className="report-asof"><span className="live-dot"/> <div><small>Live portfolio</small><strong>{rows.length} requests monitored</strong></div></div></div>
      <div className="grid grid-4 metrics report-metrics">
        <Metric label="Total requests" value={rows.length} />
        <Metric label="Awaiting action" value={awaitingAction} />
        <Metric label="Total value" value={new Intl.NumberFormat("en-PH", { notation: "compact", style: "currency", currency: "PHP", maximumFractionDigits: 1 }).format(phpValue)} />
        <Metric label="Completed" value={completed} />
      </div>
      <div className="report-chart-grid section">
        <section className="card report-chart-card">
          <div className="chart-heading"><div><span className="eyebrow">Workflow distribution</span><h2>{statusLeader} has the largest request volume</h2></div><span className="chart-total">{rows.length} total</span></div>
          <HorizontalBars data={statusData} formatter={(value) => String(value)} ariaLabel="Request count by workflow status" />
        </section>
        <section className="card report-chart-card">
          <div className="chart-heading"><div><span className="eyebrow">PHP exposure by payment type</span><h2>{natureLeader} leads recorded PHP value</h2></div><span className="chart-total">Top 6</span></div>
          <HorizontalBars data={natureData} formatter={(value) => new Intl.NumberFormat("en-PH", { notation: "compact", style: "currency", currency: "PHP", maximumFractionDigits: 1 }).format(value)} ariaLabel="PHP request value by nature of payment" tone="orange" />
        </section>
        <section className="card report-chart-card report-chart-wide">
          <div className="chart-heading"><div><span className="eyebrow">Request activity</span><h2>Submissions across the reporting period</h2></div><span className="chart-total">{dailyData.length} days</span></div>
          <RequestTrend data={dailyData} />
        </section>
      </div>
      <div className="report-table-head"><div><span className="eyebrow">Request register</span><h2>Portfolio details</h2></div><span className="chart-total">{rows.length} records</span></div>
      <Table rows={rows} open={() => {}} />
    </>
  );
}

function HorizontalBars({ data, formatter, ariaLabel, tone = "blue" }: { data: [string, number][]; formatter: (value: number) => string; ariaLabel: string; tone?: "blue" | "orange" }) {
  const maximum = Math.max(...data.map(([, value]) => value), 1);
  return <div className="horizontal-chart" role="img" aria-label={ariaLabel}>{data.map(([label, value]) => <div className="horizontal-chart-row" key={label}><div className="horizontal-chart-meta"><span>{label}</span><strong>{formatter(value)}</strong></div><div className="horizontal-chart-track"><span className={`horizontal-chart-fill ${tone}`} style={{ width: `${Math.max((value / maximum) * 100, 2)}%` }}/></div></div>)}</div>;
}

function RequestTrend({ data }: { data: [string, number][] }) {
  const maximum = Math.max(...data.map(([, value]) => value), 1);
  const pointFor = (value: number, index: number) => ({ x: 44 + (index / Math.max(data.length - 1, 1)) * 512, y: 176 - (value / maximum) * 128 });
  const points = data.map(([, value], index) => { const point = pointFor(value, index); return `${point.x},${point.y}`; }).join(" ");
  return <div className="trend-chart" role="img" aria-label={`Request submissions by date. Peak daily count ${maximum}.`}><div className="trend-plot"><svg viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><linearGradient id="requestTrendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0071e3" stopOpacity="0.2"/><stop offset="100%" stopColor="#0071e3" stopOpacity="0.01"/></linearGradient></defs><line x1="44" y1="176" x2="556" y2="176" className="chart-axis"/><line x1="44" y1="48" x2="44" y2="176" className="chart-axis"/><polygon points={`44,176 ${points} 556,176`} className="trend-area"/><polyline points={points} className="trend-line"/>{data.map(([date, value], index) => { const point = pointFor(value, index); return <g key={date}><circle cx={point.x} cy={point.y} r="5" className="trend-point"><title>{date}: {value} request{value === 1 ? "" : "s"}</title></circle></g>; })}<text x="44" y="205" className="chart-label">{data[0]?.[0] ?? ""}</text><text x="556" y="205" textAnchor="end" className="chart-label">{data.at(-1)?.[0] ?? ""}</text><text x="31" y="53" textAnchor="end" className="chart-label">{maximum}</text><text x="31" y="180" textAnchor="end" className="chart-label">0</text></svg></div><div className="trend-summary"><div className="trend-summary-head"><span>Daily activity</span><strong>{data.reduce((sum, [, value]) => sum + value, 0)} requests</strong></div>{data.map(([date, value]) => <span key={date}><small>{new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small><strong>{value}</strong></span>)}</div></div>;
}
