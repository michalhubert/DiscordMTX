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
        const { getViewerPassword } = await import("@/lib/db");
        const storedPassword = getViewerPassword("default");
        if (!storedPassword || password !== storedPassword) return null;
        return { id: "viewer", name: "Viewer", role: "viewer", password: storedPassword };
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
      if (!auth?.user) return false;

      // For viewer-password users, validate that the stored password matches current password
      const user = auth.user as { role?: string; password?: string };
      if (user.role === "viewer" && user.password) {
        const { getViewerPassword } = require("./db");
        const currentPassword = getViewerPassword("default");
        if (currentPassword !== user.password) {
          return false; // Password changed, invalidate session
        }
      }

      return true;
    },
    jwt({ token, user, account }) {
      if (user) {
        token.role = account?.provider === "discord" ? "discord" : (user as { role?: string }).role ?? "viewer";
        // Store password in JWT for validation
        if ((user as { password?: string }).password) {
          token.password = (user as { password?: string }).password;
        }
      } else if (!token.role) {
        token.role = token.sub === "viewer" ? "viewer" : token.sub === "streamer" ? "streamer" : "discord";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { password?: string }).password = token.password as string | undefined;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
