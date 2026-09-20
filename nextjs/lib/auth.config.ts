import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config (no Node.js-only modules like `fs`).
// Used by the middleware (which runs in the Edge runtime). Providers that
// need Node APIs (Credentials providers reading files) are added only in
// the full config (lib/auth.ts), which runs in the Node.js runtime.
export const authConfig: NextAuthConfig = {
  providers: [],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user, account }) {
      if (user) {
        token.role = account?.provider === "discord" ? "discord" : (user as { role?: string }).role ?? "viewer";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
