import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config, used by the middleware (Edge runtime).
// Providers needing Node APIs (fs) are added only in lib/auth.ts.
export const authConfig: NextAuthConfig = {
  trustHost: true,

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
      } else if (!token.role) {
        token.role = token.sub === "viewer" ? "viewer" : token.sub === "streamer" ? "streamer" : "discord";
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
