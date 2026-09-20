import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { readFileSync } from "fs";
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

    // Per-stream viewer password (written by stream-online.sh), for viewers without Discord
    Credentials({
      id: "viewer-password",
      name: "Viewer Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize({ password }) {
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

export const { handlers, auth, signIn, signOut } = NextAuth(config);
