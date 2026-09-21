import { auth } from "@/lib/auth";
import { rememberViewerIdentity } from "@/lib/viewerIdentities";
import { getClientIp } from "@/lib/net";
import { getPathVisibility } from "@/lib/db";
import { isApproved } from "@/lib/accessRequests";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  type SessionUser =
    | { name: string; image: string | null; role: "discord" }
    | { name: null; image: null; role: "viewer" | "streamer" };
  const user = session.user as SessionUser;

  // Check if viewer is approved for private streams
  if (user.role !== "streamer" && getPathVisibility(path) === "private") {
    const ip = getClientIp(req);
    if (!isApproved(path, ip)) {
      return new Response("Access not approved", { status: 403 });
    }
  }

  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const port = process.env.MEDIAMTX_PORT ?? "8889";
  const upstream = `http://${host}:${port}/${path}/whep`;

  const body = await req.text();
  const res = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body,
  });

  const responseHeaders = new Headers();
  for (const [key, value] of res.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "content-type" ||
      lower === "location" ||
      lower === "link" ||
      lower === "accept-patch" ||
      lower === "id"
    ) {
      responseHeaders.set(key, value);
    }
  }

  const location = res.headers.get("location");
  // MediaMTX's "Id" response header carries the same session id used by
  // /v3/webrtcsessions/list. The Location header's path segment is a
  // separate WHEP resource identifier and is NOT guaranteed to match it,
  // so we must key off "Id" rather than parsing Location.
  const sessionId = res.headers.get("id") || location?.split("/").filter(Boolean).pop();
  if (res.ok && sessionId) {
    const ip = getClientIp(req);
    rememberViewerIdentity(sessionId, {
      // Discord viewers show their real name/avatar; everyone else (viewer-password) is
      // identified by IP address instead, since there's no per-person account for them.
      name: user.role === "discord" ? user.name : ip,
      image: user.role === "discord" ? user.image : null,
      role: user.role,
      ip,
    });
  }

  return new Response(await res.text(), {
    status: res.status,
    headers: responseHeaders,
  });
}
