import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const config: NextAuthConfig = {
  providers: [
    // OAuth/OIDC provider (Authentik, Authelia, Keycloak, etc.)
    ...(process.env.OAUTH_ISSUER_URL
      ? [
          {
            id: "homelab-oauth",
            name: "Homelab",
            type: "oidc" as const,
            issuer: process.env.OAUTH_ISSUER_URL,
            clientId: process.env.OAUTH_CLIENT_ID,
            clientSecret: process.env.OAUTH_CLIENT_SECRET,
          },
        ]
      : []),

    // Per-stream viewer password (written by stream-online.sh)
    Credentials({
      name: "Viewer Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize({ password }) {
        const { readFileSync } = await import("fs");
        let token: string;
        try {
          token = readFileSync("/auth/viewer-token", "utf8").trim();
        } catch {
          return null;
        }
        if (!token || password !== token) return null;
        return { id: "viewer", name: "Viewer", role: "viewer" };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
