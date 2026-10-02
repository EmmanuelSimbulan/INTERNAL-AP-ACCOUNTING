import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/access";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const user = await requireUser(); return <AppShell user={user}>{children}</AppShell>; }
