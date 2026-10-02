"use client";

const accounts = [
  ["Requester", "requester1@svi.demo", "Create, edit and track own requests"],
  ["Approver", "approver@svi.demo", "Review only assigned requests"],
  ["AP Processor", "ap@svi.demo", "Validate, post and pay"],
  ["AP Reviewer", "reviewer@svi.demo", "Review accounting and reconciliation"],
  ["Administrator", "admin@svi.demo", "Manage all modules and records"],
  ["Auditor", "auditor@svi.demo", "Read-only reporting and audit access"],
] as const;

export function DemoSignIn({ action }: { action: (form: FormData) => void | Promise<void> }) {
  return <div className="grid grid-2 section">
    <section className="card auth"><h1>Welcome back</h1><p className="muted">Sign in with an organization account.</p><form action={action} className="grid"><div className="field"><label htmlFor="email">WORK EMAIL</label><input id="email" name="email" type="email" autoComplete="email" required /></div><div className="field"><label htmlFor="password">PASSWORD</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} defaultValue="DemoPass!2026" required /></div><button className="button" type="submit">Sign in</button></form></section>
    <section className="card"><span className="eyebrow">RBAC simulation</span><h2>Demo account types</h2><p className="muted">Choose an account, then sign in. Each role sees a different menu and data scope.</p><div className="grid">{accounts.map(([role, email, description]) => <button type="button" className="button secondary" key={email} onClick={() => { const input = document.querySelector<HTMLInputElement>("#email"); if (input) { input.value = email; input.focus(); } }}><strong>{role}</strong><span className="fine">{email}<br />{description}</span></button>)}</div><p className="fine">Shared demo password: <strong>DemoPass!2026</strong></p></section>
  </div>;
}
