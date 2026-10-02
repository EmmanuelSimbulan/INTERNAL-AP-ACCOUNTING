import Link from "next/link";
import { signOut } from "@/auth";
import type { Session } from "next-auth";
import { hasPermission, type PermissionCode } from "@/lib/rbac";

const nav: { label: string; href: string; permissions?: PermissionCode[] }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Requests", href: "/requests" },
  { label: "Create Request", href: "/requests/new", permissions: ["request.create"] },
  { label: "Approval Inbox", href: "/approvals", permissions: ["request.approve"] },
  { label: "AP Work Queue", href: "/ap", permissions: ["request.ap.process", "request.accounting.review"] },
  { label: "Payments", href: "/payments", permissions: ["request.payment.manage", "request.accounting.review", "request.audit"] },
  { label: "Reconciliation", href: "/reconciliation", permissions: ["request.reconcile", "request.audit"] },
  { label: "Reports & Search", href: "/reports", permissions: ["report.view"] },
  { label: "Notifications", href: "/notifications" },
  { label: "Administration", href: "/admin", permissions: ["admin.manage"] },
  { label: "Audit Log", href: "/audit", permissions: ["request.audit", "admin.manage"] },
  { label: "Profile & Delegation", href: "/profile" },
];

export function AppShell({ user, children }: { user: Session["user"]; children: React.ReactNode }) {
  const visibleNav = nav.filter((item) => !item.permissions || item.permissions.some((permission) => hasPermission(user, permission)));
  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">SVI</span><div><strong>Accounts Payable</strong><small>Workflow System</small></div></div><nav className="nav">{visibleNav.map(({ label, href }) => <Link key={href} href={href}>{label}</Link>)}</nav></aside><main className="content"><header className="topbar"><div><span className="eyebrow">Internal finance operations</span></div><div className="actions"><div><strong>{user.name}</strong><div className="fine">{user.roles.join(" · ")}</div></div><form action={async () => { "use server"; await signOut({ redirectTo: "/sign-in" }); }}><button className="button secondary">Sign out</button></form></div></header>{children}</main></div>;
}
