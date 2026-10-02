import Link from "next/link";
export default function AccessDenied() { return <div className="auth-wrap"><div className="card auth"><span className="eyebrow">403</span><h1>Access denied</h1><p className="muted">Your account does not have permission to view this resource.</p><Link className="button" href="/dashboard">Return to dashboard</Link></div></div>; }
