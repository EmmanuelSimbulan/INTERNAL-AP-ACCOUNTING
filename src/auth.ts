import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  cookies: { sessionToken: { name: process.env.NODE_ENV === "production" ? "__Secure-iap.session-token" : "iap.session-token", options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } } },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const value = z.object({ email: z.string().email(), password: z.string().min(8).max(128) }).safeParse(raw);
      if (!value.success) return null;
      const user = await db.user.findUnique({ where: { email: value.data.email.toLowerCase() }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
      if (!user?.active || !(await verify(user.passwordHash, value.data.password))) return null;
      return { id: user.id, email: user.email, name: user.fullName, roles: user.roles.map((item) => item.role.code), permissions: [...new Set(user.roles.flatMap((item) => item.role.permissions.map((grant) => grant.permission.code)))], companyIds: [...new Set(user.roles.flatMap((item) => item.companyId ? [item.companyId] : []))] };
    }
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id; token.roles = user.roles; token.permissions = user.permissions; token.companyIds = user.companyIds; } return token; },
    session({ session, token }) { session.user.id = String(token.id); session.user.roles = (token.roles ?? []) as string[]; session.user.permissions = (token.permissions ?? []) as string[]; session.user.companyIds = (token.companyIds ?? []) as string[]; return session; }
  }
});
