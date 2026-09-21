import { auth } from "@/lib/auth";

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
