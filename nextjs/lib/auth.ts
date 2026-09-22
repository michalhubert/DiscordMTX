import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

export const config: NextAuthConfig = {
  ...authConfig,
  providers: [
    // Real Discord OAuth login (https://discord.com/developers/applications)
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: { params: { scope: "identify" } },
            profile(profile) {
              return {
                id: profile.id,
                name: profile.username,
                image: profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : null,
              };
            },
          }),
        ]
      : []),

    // Per-stream viewer password (stored in DB per path), for viewers without Discord
    Credentials({
      id: "viewer-password",
      name: "Viewer Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize({ password }) {
        const { getViewerPassword, getAllViewerPasswords } = await import("@/lib/db");
        if (typeof password !== "string") return null;
        const storedPassword = getViewerPassword("default");
        if (storedPassword && password === storedPassword) {
          return { id: "viewer", name: "Viewer", role: "viewer", password: storedPassword };
        }
        const all = getAllViewerPasswords();
        for (const pass of Object.values(all)) {
          if (password === pass) {
            return { id: "viewer", name: "Viewer", role: "viewer", password: pass };
          }
        }
        return null;
      },
    }),

    // Static admin/streamer password, used to access the OBS streamer dock (/dock)
    Credentials({
      id: "streamer-password",
      name: "Streamer Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize({ password }) {
        const streamerPassword = process.env.STREAMER_PASSWORD;
        if (!streamerPassword || password !== streamerPassword) return null;
        return { id: "streamer", name: "Streamer", role: "streamer" };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params);
      if (!token) return token;
      const password = (params.user as { password?: string } | undefined)?.password;
      if (password) token.password = password;
      return token;
    },
    async session(params) {
      const session = await authConfig.callbacks!.session!(params);
      if (session.user) {
        (session.user as { password?: string }).password = params.token.password as string | undefined;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
