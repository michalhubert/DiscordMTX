import type { NextAuthConfig } from "next-auth";

// Placeholders from older compose files and README examples: anyone could
// forge a session with them.
const PLACEHOLDER_SECRETS = ["changeme-use-a-random-secret", "change-me-to-a-random-secret"];

function hasSafeSecret(): boolean {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && !PLACEHOLDER_SECRETS.includes(secret)) return true;
  console.error("NEXTAUTH_SECRET is missing or a placeholder; refusing all sessions.");
  return false;
}

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
      if (!hasSafeSecret()) return null;
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
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
