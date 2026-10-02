import "next-auth";
declare module "next-auth" {
  interface User { roles: string[]; permissions: string[]; companyIds: string[] }
  interface Session { user: { id: string; email?: string | null; name?: string | null; image?: string | null; roles: string[]; permissions: string[]; companyIds: string[] } }
}
declare module "next-auth/jwt" { interface JWT { id?: string; roles?: string[]; permissions?: string[]; companyIds?: string[] } }
