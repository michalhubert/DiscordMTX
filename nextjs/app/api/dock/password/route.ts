import { isStreamerAuthorized } from "@/lib/authz";
import { getViewerPassword, rotateViewerPassword } from "@/lib/db";
import { getViewerIdentity } from "@/lib/viewerIdentities";
import { kickViewerIp } from "@/lib/kickedViewers";
import { listWebrtcSessions, kickWebrtcSession } from "@/lib/mediamtx";
import { clearApprovedPasswordViewers } from "@/lib/accessRequests";
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

  // The old password is now invalid. Drop live WebRTC sessions for viewer-password
  // users on this path. Discord OAuth viewers are NOT affected because they do not
  // authenticate using the viewer password.
  const sessions = await listWebrtcSessions();
  for (const item of sessions) {
    const identity = getViewerIdentity(item.id);
    if (identity?.role !== "viewer" || (identity.path && identity.path !== path)) continue;
    if (identity.ip) kickViewerIp(path, identity.ip);
    await kickWebrtcSession(item.id);
  }

  // Clear ONLY password viewers' approvals for this path.
  // Discord users remain approved and continue watching!
  clearApprovedPasswordViewers(path);

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
