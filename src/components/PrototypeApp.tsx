"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { downloadInvoicePdf } from "@/lib/prototype-invoice-pdf";
import {
  downloadSaasantBillCsv,
  downloadSaasantBulkBillCsv,
} from "@/lib/saasant-bill-csv";
import {
  companyNumberingRules,
  generateInvoiceNumber,
  generateRequestNumber,
  getCompanyNumberingRule,
  patternExample,
} from "@/lib/company-numbering";
import { demoProfiles, type DemoRole as Role } from "@/lib/demo-profiles";
type Status =
  | "Draft"
  | "Pending Manager Approval"
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
};
const types = [
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
type MasterData = { projects: string[]; accounts: string[]; payees: string[] };
const defaultMasterData: MasterData = {
  projects: [...projects],
  accounts: [...accounts],
  payees: ["Northstar Demo Supplies", "Bluebird Sample Consulting", "Alex Rivera", "Demo Payroll Clearing", "Sample Mobile Recipient", "Atlas Demo Services"],
};
const companies = companyNumberingRules.map((rule) => rule.name);
const demoImagePreview = (title: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#f5f5f7"/><rect x="90" y="70" width="820" height="560" rx="24" fill="white" stroke="#d9d9de"/><text x="140" y="155" font-family="Arial" font-size="24" font-weight="700" fill="#1d1d1f">SVI Supporting Document</text><text x="140" y="210" font-family="Arial" font-size="18" fill="#6e6e73">${title}</text><path d="M140 275h720M140 330h520M140 385h650M140 440h430" stroke="#d2d2d7" stroke-width="12" stroke-linecap="round"/><circle cx="765" cy="505" r="62" fill="#e8f2ff"/><path d="m735 505 22 22 40-48" fill="none" stroke="#0071e3" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><text x="140" y="560" font-family="Arial" font-size="16" fill="#86868b">Preview generated for workflow simulation</text></svg>`)}`;
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
];
const total = (l: Line[]) => l.reduce((n, x) => n + (Number(x.amount) || 0), 0),
  cash = (n: number, c: string) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: c }).format(
      n,
    );
export function PrototypeApp() {
  const [activeProfileId, setActiveProfileId] = useState(demoProfiles[0].id),
    [profileMenuOpen, setProfileMenuOpen] = useState(false),
    [masterData, setMasterData] = useState<MasterData>(defaultMasterData),
    [rows, setRows] = useState<Req[]>(seed),
    [selected, setSelected] = useState("1"),
    [view, setView] = useState<
      "dashboard" | "new" | "detail" | "queue" | "reports" | "settings"
    >("dashboard"),
    [toast, setToast] = useState("");
  const activeProfile = demoProfiles.find((profile) => profile.id === activeProfileId) ?? demoProfiles[0];
  const role = activeProfile.role;
  useEffect(() => {
    const savedProfile = localStorage.getItem("iap-active-profile");
    if (savedProfile && demoProfiles.some((profile) => profile.id === savedProfile)) setActiveProfileId(savedProfile);
    const savedMasters = localStorage.getItem("iap-master-data");
    if (savedMasters) try { const parsed = JSON.parse(savedMasters) as MasterData; if (parsed.projects?.length && parsed.accounts?.length && parsed.payees?.length) setMasterData(parsed); } catch {}
    const s = localStorage.getItem("iap-demo");
    if (s)
      try {
        const saved = JSON.parse(s) as Array<
          Omit<Req, "documents"> & { documents: Array<Attachment | string> }
        >;
        const normalized = saved.map((request) => ({
          ...request,
          documents: request.documents.map((document) =>
            typeof document === "string"
              ? { name: document, type: "application/octet-stream" }
              : document,
          ),
        }));
        const savedIds = new Set(normalized.map((request) => request.id));
        setRows([
          ...normalized,
          ...seed.filter((request) => !savedIds.has(request.id)),
        ]);
      } catch {}
  }, []);
  useEffect(
    () => localStorage.setItem("iap-demo", JSON.stringify(rows)),
    [rows],
  );
  useEffect(() => localStorage.setItem("iap-master-data", JSON.stringify(masterData)), [masterData]);
  const current = rows.find((r) => r.id === selected),
    notify = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 2200);
    },
    open = (id: string) => {
      setSelected(id);
      setView("detail");
    },
    update = (id: string, c: Partial<Req>, event: string) =>
      setRows((a) =>
        a.map((r) =>
          r.id === id ? { ...r, ...c, timeline: [...r.timeline, event] } : r,
        ),
      );
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
            <button
              className="icon-button"
              title="Reset demo"
              aria-label="Reset demo"
              onClick={() => {
                localStorage.removeItem("iap-demo");
                setRows(seed);
                notify("Demo reset");
              }}
            >
              ↻
            </button>
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
        <div className="view-stage" key={`${view}-${selected}`}>
          {view === "dashboard" && (
            <Dashboard
              role={role}
              rows={rows}
              open={open}
              create={() => setView("new")}
              notify={notify}
            />
          )}{" "}
          {view === "queue" && <Queue role={role} rows={rows} open={open} />}{" "}
          {view === "new" && (
            <NewRequest
              projectCodes={masterData.projects}
              accountOptions={masterData.accounts}
              payeeOptions={masterData.payees}
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
              notify={notify}
              projectCodes={masterData.projects}
              accountOptions={masterData.accounts}
              payeeOptions={masterData.payees}
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
  notify,
}: {
  role: Role;
  rows: Req[];
  open: (x: string) => void;
  create: () => void;
  notify: (message: string) => void;
}) {
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
              <p>Updated across your workspace</p>
            </div>
            <span className="view-chip">{rows.length} total</span>
          </div>
          <Table rows={rows} open={open} />
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
  const filtered =
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
      <Table rows={filtered} open={open} />
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
            <th>Requester / Payee</th>
            <th>Type</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => open(r.id)}>
              <td>
                <strong>{r.number}</strong>
                <div className="fine">{r.date}</div>
              </td>
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
}: {
  save: (r: Req) => void;
  projectCodes: string[];
  accountOptions: string[];
  payeeOptions: string[];
}) {
  const [company, setCompany] = useState("SVI TECHNOLOGIES INC"),
    [payee, setPayee] = useState(""),
    [nature, setNature] = useState("Reimbursement (includes Notarization)"),
    [other] = useState(""),
    [currency, setCurrency] = useState("PHP"),
    [docs, setDocs] = useState<Attachment[]>([]),
    [lines, setLines] = useState<Line[]>([
      {
        project: projectCodes[0] ?? "",
        account: "",
        particulars: "",
        amount: "",
      },
    ]);
  const numberingRule = getCompanyNumberingRule(company);
  const change = (i: number, k: keyof Line, v: string) =>
      setLines((a) => a.map((l, n) => (n === i ? { ...l, [k]: v } : l))),
    readDocuments = async (files: FileList | null) => {
      const selectedFiles = Array.from(files ?? []);
      const attachments = await Promise.all(
        selectedFiles.map(async (file): Promise<Attachment> => {
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
      setDocs(attachments);
    },
    done = (submit: boolean) => {
      if (
        submit &&
        (!payee ||
          !lines.every(
            (l) =>
              l.project && l.particulars.length >= 10 && Number(l.amount) > 0,
          ))
      ) {
        alert(
          "Before submitting, complete the payee, payment type, particulars, and amount for every line. You can use Save draft at any time.",
        );
        return;
      }
      const id = String(Date.now());
      const requestDate = new Date().toISOString().slice(0, 10);
      save({
        id,
        number: generateRequestNumber(company, requestDate, id),
        invoiceNumber: generateInvoiceNumber(company, requestDate, id),
        requester: "Alex Rivera",
        payee,
        company,
        date: requestDate,
        currency,
        nature,
        other,
        status: submit ? "Pending Manager Approval" : "Draft",
        lines,
        documents: docs,
        timeline: [
          "Draft created",
          ...(submit ? ["Requester attested and submitted"] : []),
        ],
      });
    };
  return (
    <>
      <span className="eyebrow">Requester workspace</span>
      <div className="paper">
        <div className="company-head">
          <div className="svi-logo">SVI</div>
          <div>
            <strong>SVI Technologies Inc.</strong>
            <div className="fine">
              22/F Antel Global Corporate Center, Pasig City · (63 2) 8633 8788
            </div>
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
            <strong>{patternExample(numberingRule.invoicePattern)}</strong>
            <small>
              Invoice format · {numberingRule.reset.toLowerCase()} sequence reset
            </small>
          </div>
          <Field label="DATE">
            <input
              type="date"
              value={new Date().toISOString().slice(0, 10)}
              readOnly
            />
          </Field>
          <Field label="REQUESTOR">
            <input value="Alex Rivera" readOnly />
          </Field>
          <Field label="PAYEE">
            <input
              list="new-request-payees"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Select or enter a payee"
            />
            <datalist id="new-request-payees">
              {payeeOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
          <Field label="CURRENCY">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
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
        <section className="nature-section"><div><span className="eyebrow">Payment classification</span><h2>NATURE OF PAYMENT</h2><p className="muted">Choose the category that best describes this request.</p></div><NaturePicker value={nature} onChange={setNature}/></section>
        <h2 className="section">Supporting Documents</h2>
        <label className="upload">
          Choose demo files
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
            onChange={(e) => void readDocuments(e.target.files)}
          />
        </label>
        {docs.map((d) => (
          <span className="badge green" key={d.name}>
            {d.name}
          </span>
        ))}
        <div className="attest">
          <input type="checkbox" defaultChecked /> I certify that this request
          is complete and accurate.
        </div>
        <div className="actions">
          <button className="button secondary" onClick={() => done(false)}>
            Save draft
          </button>
          <button className="button" onClick={() => done(true)}>
            Attest and submit
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
function NaturePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleOptions = types.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { setOpen(false); setQuery(""); };
  return <div className="nature-picker">
    <button className="nature-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(true)}><span className="nature-trigger-icon">◎</span><span><small>Selected category</small><strong>{value}</strong></span><span className="nature-chevron">⌄</span></button>
    {open && typeof document !== "undefined" && createPortal(<div className="prototype nature-portal"><button className="nature-backdrop" type="button" aria-label="Close nature of payment options" onClick={close}/><section className="nature-menu" role="dialog" aria-modal="true" aria-label="Select nature of payment">
      <div className="nature-menu-head"><div><span className="eyebrow">Nature of payment</span><h3>Select a category</h3><p>Choose the option that best matches this request.</p></div><button className="nature-close" type="button" aria-label="Close" onClick={close}>×</button></div>
      <div className="nature-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${types.length} payment types`} aria-label="Search nature of payment options"/></div>
      <div className="nature-options" role="listbox">{visibleOptions.map((option, index) => <button type="button" role="option" aria-selected={value === option} className={`nature-option ${value === option ? "active" : ""}`} key={option} onClick={() => { onChange(option); close(); }}><span className="nature-option-number">{String(index + 1).padStart(2, "0")}</span><span>{option}</span>{value === option && <span className="nature-check">✓</span>}</button>)}{!visibleOptions.length && <div className="nature-empty">No matching payment type.</div>}</div>
      <footer><span>{visibleOptions.length} option{visibleOptions.length === 1 ? "" : "s"}</span><button className="button secondary" type="button" onClick={close}>Cancel</button></footer>
    </section></div>, document.body)}
  </div>;
}
function Details({
  role,
  request,
  update,
  notify,
  projectCodes,
  accountOptions,
  payeeOptions,
}: {
  role: Role;
  request: Req;
  update: (id: string, c: Partial<Req>, e: string) => void;
  notify: (x: string) => void;
  projectCodes: string[];
  accountOptions: string[];
  payeeOptions: string[];
}) {
  const [generating, setGenerating] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Attachment | null>(null);
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [draft, setDraft] = useState(() => ({ payee: request.payee, currency: request.currency, nature: request.nature, other: request.other, lines: request.lines.map((line) => ({ ...line })), documents: [...request.documents] }));
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
    if (!draft.payee.trim() || !draft.lines.length || draft.lines.some((line) => !line.project || line.particulars.trim().length < 10 || Number(line.amount) <= 0)) { notify("Complete the payee and all line details before saving"); return; }
    if (operationalEditor && !editReason.trim()) { notify("Enter an edit reason for the audit timeline"); return; }
    const event = requesterRevision ? (resubmit ? "Requester revised fields and resubmitted" : "Requester saved revised draft") : `${role} edited request data · ${editReason.trim()}`;
    update(request.id, { ...draft, status: requesterRevision && resubmit ? "Pending Manager Approval" : request.status }, event);
    setEditing(false);
    notify(resubmit ? "Revision submitted" : "Changes saved and audited");
  };
  const act = (s: Status, e: string) => {
      update(request.id, { status: s }, e);
      notify(e);
    },
    csv = () => {
      const body = [
          "Project Code,Account,Particulars,Amount",
          ...request.lines.map((l) =>
            [l.project, l.account, l.particulars, l.amount]
              .map((x) => `"${x}"`)
              .join(","),
          ),
        ].join("\r\n"),
        a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
      a.download = `${request.number}-quickbooks.csv`;
      a.click();
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
        <div className="grid grid-2"><Field label="PAYEE"><input list="edit-request-payees" value={draft.payee} onChange={(event) => setDraft((current) => ({ ...current, payee: event.target.value }))}/><datalist id="edit-request-payees">{payeeOptions.map((option) => <option key={option} value={option}/>)}</datalist></Field><Field label="CURRENCY"><select value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}><option>PHP</option><option>USD</option></select></Field></div><div className="section"><Field label="NATURE OF PAYMENT"><NaturePicker value={draft.nature} onChange={(nature) => setDraft((current) => ({ ...current, nature, other: "" }))}/></Field></div>
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
        <div className="actions">
          {role === "Approver" &&
            request.status === "Pending Manager Approval" && (
              <>
                <button
                  className="button"
                  onClick={() =>
                    act("Manager Approved", "Approved by Jordan Reyes")
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
          {role === "AP Processor" &&
            ["Manager Approved", "Pending AP Validation"].includes(
              request.status,
            ) && (
              <button
                className="button"
                onClick={() =>
                  act(
                    "Ready for QuickBooks",
                    "AP validated documents and mappings",
                  )
                }
              >
                AP Validate
              </button>
            )}
          {role === "AP Processor" &&
            request.status === "Ready for QuickBooks" && (
              <button
                className="button"
                onClick={() => {
                  csv();
                  update(
                    request.id,
                    {
                      status: "Posted to QuickBooks",
                      qbId: `QB-DEMO-${request.id.slice(-4)}`,
                    },
                    "QuickBooks CSV generated and posting confirmed",
                  );
                  notify("QuickBooks CSV downloaded");
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
  const updateList = (key: keyof MasterData, values: string[]) =>
    onChange((current) => ({ ...current, [key]: values }));

  return (
    <>
      <section className="settings-hero">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Master Data Settings</h1>
          <p className="muted">
            Manage the choices available across payment requests and revisions.
          </p>
        </div>
        <div className="settings-access">
          <span className="settings-lock">A</span>
          <span><small>Authorized access</small><strong>Administrator</strong></span>
        </div>
      </section>
      <div className="settings-summary">
        <Metric label="Project codes" value={masterData.projects.length} />
        <Metric label="Accounts" value={masterData.accounts.length} />
        <Metric label="Payees / vendors" value={masterData.payees.length} />
      </div>
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
          description="Maintains approved recipients for payment requests."
          values={masterData.payees}
          onChange={(values) => updateList("payees", values)}
          notify={notify}
        />
      </div>
      <p className="settings-footnote">
        Changes save automatically and immediately appear in new and editable requests.
      </p>
    </>
  );
}

function MasterDataEditor({
  icon,
  title,
  singular,
  description,
  values,
  onChange,
  notify,
}: {
  icon: string;
  title: string;
  singular: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
  notify: (message: string) => void;
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
          <div className={`master-row ${editing === index ? "editing" : ""}`} key={`${value}-${index}`}>
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
            <div className="master-row-actions">
              {editing === index ? <>
                <button type="button" onClick={() => saveEdit(index)}>Save</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </> : <>
                <button type="button" onClick={() => { setEditing(index); setEditValue(value); }}>Edit</button>
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
  const workflowStages: [string, Status[]][] = [["Draft", ["Draft"]], ["Manager approval", ["Pending Manager Approval", "Manager Approved"]], ["AP review", ["Pending AP Validation"]], ["QuickBooks", ["Ready for QuickBooks", "Posted to QuickBooks"]], ["Payment & reconciliation", ["Paid", "Reconciled"]], ["Closed", ["Closed"]], ["Exceptions", ["Returned for Revision", "Rejected"]]];
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
