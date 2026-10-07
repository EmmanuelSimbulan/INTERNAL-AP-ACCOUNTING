import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoProfiles } from "@/lib/demo-profiles";

export const dynamic = "force-dynamic";

const auditRoles = new Set(["ADMIN", "AUDITOR", "AP_PROCESSOR", "AP_REVIEWER"]);

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";
  const profile = demoProfiles.find((item) => item.id === profileId);
  if (!profile) return NextResponse.json({ error: "Unknown profile" }, { status: 403 });

  const actor = await db.user.findUnique({
    where: { email: profile.email },
    select: { id: true, roles: { select: { role: { select: { code: true } } } } },
  });
  if (!actor || !actor.roles.some(({ role }) => auditRoles.has(role.code))) {
    return NextResponse.json({ error: "Audit trail access denied" }, { status: 403 });
  }

  const events = await db.auditEvent.findMany({
    where: { entityType: { in: ["PrototypeRequest", "PrototypeConfiguration"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      before: true,
      after: true,
      createdAt: true,
      actor: { select: { fullName: true, email: true } },
    },
  });
  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}
