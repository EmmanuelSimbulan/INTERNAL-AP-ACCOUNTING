import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type PermissionCode } from "./rbac";
export { canReadRequest } from "./access-policy";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}
export async function requireRole(...allowed: string[]) {
  const user = await requireUser();
  if (!allowed.some((role) => user.roles.includes(role))) redirect("/access-denied");
  return user;
}
export async function requirePermission(...allowed: PermissionCode[]) {
  const user = await requireUser();
  if (!allowed.some((permission) => hasPermission(user, permission))) redirect("/access-denied");
  return user;
}
