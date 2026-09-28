import { NextRequest } from "next/server";
import { auth } from "./auth";
import { getClientIp } from "./net";
import { getPathVisibility } from "./db";
import { isApproved } from "./accessRequests";
import { getKickInfo } from "./kickedViewers";
import { isViewerPasswordStale, type SessionUser } from "./authz";

// Same rules as the WHEP endpoint. Synchronous so it can run on every heartbeat.
export function watchAccessDenied(user: SessionUser, path: string, ip: string): number | null {
  if (isViewerPasswordStale(user, path)) return 401;
  if (user.role === "streamer") return null;
  if (getKickInfo(path, ip, user.role)) return 403;
  if (getPathVisibility(path) === "private" && !isApproved(path, ip, user.role)) {
    return 403;
  }
  return null;
}

export async function authorizeWatch(
  req: NextRequest,
  path: string
): Promise<{ user: SessionUser; ip: string; error?: undefined } | { user?: undefined; error: number }> {
  const session = await auth();
  if (!session?.user) return { error: 401 };
  const user = session.user as SessionUser;
  const ip = getClientIp(req);
  const error = watchAccessDenied(user, path, ip);
  return error ? { error } : { user, ip };
}
