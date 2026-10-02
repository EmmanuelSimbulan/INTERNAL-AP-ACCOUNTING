export type DemoRole = "Requester" | "Approver" | "AP Processor" | "AP Reviewer" | "Administrator" | "Auditor";

export type DemoProfile = { id: string; name: string; email: string; role: DemoRole; initials: string; description: string; accent: string };

// Prototype profile catalog. The authenticated app sources these fields from
// User, UserRole, Role, and RolePermission database records.
export const demoProfiles: readonly DemoProfile[] = [
  { id: "alex-requester", name: "Alex Rivera", email: "requester1@svi.demo", role: "Requester", initials: "AR", description: "Creates and tracks personal payment requests", accent: "#35363a" },
  { id: "jordan-approver", name: "Jordan Reyes", email: "approver@svi.demo", role: "Approver", initials: "JR", description: "Reviews requests assigned for approval", accent: "#315b8a" },
  { id: "casey-ap", name: "Casey Lim", email: "ap@svi.demo", role: "AP Processor", initials: "CL", description: "Validates documents, posting, and payments", accent: "#2f6f59" },
  { id: "taylor-reviewer", name: "Taylor Cruz", email: "reviewer@svi.demo", role: "AP Reviewer", initials: "TC", description: "Reviews accounting and reconciliation", accent: "#76552f" },
  { id: "avery-admin", name: "Avery Garcia", email: "admin@svi.demo", role: "Administrator", initials: "AG", description: "Configures users, access, and workflows", accent: "#684477" },
  { id: "riley-auditor", name: "Riley Mendoza", email: "auditor@svi.demo", role: "Auditor", initials: "RM", description: "Read-only reports and audit evidence", accent: "#535a66" },
];
