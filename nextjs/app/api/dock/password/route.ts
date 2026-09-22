import { isStreamerAuthorized } from "@/lib/authz";
import { getViewerPassword, rotateViewerPassword } from "@/lib/db";
import { getViewerIdentity } from "@/lib/viewerIdentities";
import { kickViewerIp } from "@/lib/kickedViewers";
import { listWebrtcSessions, kickWebrtcSession } from "@/lib/mediamtx";
import { clearApprovedViewers } from "@/lib/accessRequests";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") || "default";
  const password = getViewerPassword(path);

  return new Response(JSON.stringify({ password }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") || "default";
  const newPassword = rotateViewerPassword(path);

  // The old password is now worthless, but any viewer who authenticated
  // with it before the rotation is still holding an open WebRTC session -
  // drop those now instead of waiting for them to naturally disconnect.
  const sessions = await listWebrtcSessions();
  for (const item of sessions) {
    const identity = getViewerIdentity(item.id);
    if (identity?.role !== "viewer" || identity.path !== path) continue;
    if (identity.ip) kickViewerIp(path, identity.ip);
    await kickWebrtcSession(item.id);
  }

  // A password rotation should also invalidate prior access approvals for
  // this path, so anyone previously let in under the old password has to
  // be re-approved once they come back with the new one.
  clearApprovedViewers(path);

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
