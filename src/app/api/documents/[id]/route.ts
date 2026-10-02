import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canReadRequest } from "@/lib/access";
import { LocalRepositoryAdapter } from "@/lib/storage";
import { hasPermission } from "@/lib/rbac";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!hasPermission(session.user, "document.download")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const doc = await db.supportingDocument.findUnique({ where: { id }, include: { request: { include: { assignments: true } } } });
  if (!doc || doc.deletedAt || !canReadRequest(session.user, doc.request)) return new Response("Not found", { status: 404 });
  const bytes = await new LocalRepositoryAdapter().get(doc.storageKey);
  const filename = doc.safeFilename.replaceAll('"', "");
  return new Response(bytes, { headers: { "Content-Type": doc.mimeType, "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
