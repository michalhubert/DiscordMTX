import { NextRequest } from "next/server";
import { auth } from "./auth";
import { getClientIp } from "./net";
import { getPathVisibility } from "./db";
import { isApproved } from "./accessRequests";
import { getBlock, blockedViewerOf } from "./accessBlocks";
import { isViewerPasswordStale, type SessionUser } from "./authz";
import { ponyKeyFor } from "./guestIdentity";

// Same rules as the WHEP endpoint. Synchronous so it can run on every heartbeat.
export function watchAccessDenied(user: SessionUser, path: string, ip: string): number | null {
  if (isViewerPasswordStale(user, path)) return 401;
  if (user.role === "streamer") return null;
  if (getBlock(path, blockedViewerOf(user, ip))) return 403;
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

export async function authorizeGuest(
  req: NextRequest,
  path: string
): Promise<{ user: SessionUser; ip: string; ponyKey: string } | Response> {
  const result = await authorizeWatch(req, path);
  if (!result.user) return new Response(null, { status: result.error });
  const ponyKey = ponyKeyFor(result.user.role, result.user.name, result.ip, path);
  if (!ponyKey) return new Response("No pony identity", { status: 400 });
  return { user: result.user, ip: result.ip, ponyKey };
}
