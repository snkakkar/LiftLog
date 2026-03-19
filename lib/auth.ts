import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; isAdmin?: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin?: boolean;
  }
}

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.email ? getAdminEmails().includes(user.email.toLowerCase()) : false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin ?? false;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

/** Get current user id from session, or null if not signed in. Use in API routes and server components. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/** Throws if not signed in. Use when route or page requires auth. */
export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new Error("Unauthorized");
  return id;
}

/** Throws if not an admin. Use in admin-only API routes. */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) throw new Error("Unauthorized");
  if (!session.user.isAdmin) throw new Error("Forbidden: admin only");
  return { userId: session.user.id, email: session.user.email };
}

/** Redirects to login or home if not admin. Use in admin-only pages. */
export async function ensureAdminPage(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) redirect("/login");
  if (!session.user.isAdmin) redirect("/");
}
