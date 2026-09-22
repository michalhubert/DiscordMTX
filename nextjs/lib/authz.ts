import { auth } from "@/lib/auth";
import { getViewerPassword } from "@/lib/db";

/**
 * Returns true when the caller is allowed to use streamer-only areas
 * (the /dock HUD and the /stream browser-capture panel), either because
 * they hold a valid "streamer" session or because DISABLE_DOCK_AUTH is set
 * (useful when the app is only reachable from a trusted local network).
 */
export async function isStreamerAuthorized(): Promise<boolean> {
  if (process.env.DISABLE_DOCK_AUTH === "true") return true;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return !!session?.user && role === "streamer";
}

export type SessionUser =
  | { name: string; image: string | null; role: "discord" }
  | { name: null; image: null; role: "viewer" | "streamer"; password?: string };

// True once the streamer rotates the viewer password: the session still carries the
// old password, so the viewer must be sent back to /login instead of being treated
// as authenticated. Not relevant for "discord"/"streamer" sessions (no stored password).
export function isViewerPasswordStale(user: SessionUser, path: string): boolean {
  if (user.role !== "viewer") return false;
  const validPassword = getViewerPassword(path) ?? getViewerPassword("default");
  return !!validPassword && user.password !== validPassword;
}
