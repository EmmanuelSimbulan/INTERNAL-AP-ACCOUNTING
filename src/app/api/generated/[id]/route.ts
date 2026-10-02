import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canReadRequest } from "@/lib/access";
import { LocalRepositoryAdapter } from "@/lib/storage";
import { hasPermission } from "@/lib/rbac";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user) return new Response("Unauthorized", { status: 401 }); if (!hasPermission(session.user, "document.download")) return new Response("Forbidden", { status: 403 });
  const { id } = await params; const document = await db.generatedDocument.findUnique({ where: { id }, include: { request: { include: { assignments: true } } } });
  if (!document || !canReadRequest(session.user, document.request)) return new Response("Not found", { status: 404 });
  const bytes = await new LocalRepositoryAdapter().get(document.storageKey); const reference = document.request.requestNumber ?? document.request.draftIdentifier;
  return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reference}-v${document.version}.pdf"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
