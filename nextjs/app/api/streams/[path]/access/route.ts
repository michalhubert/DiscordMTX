import { auth } from "@/lib/auth";
import { getPathVisibility } from "@/lib/db";
import { requestAccess, getDenialInfo } from "@/lib/accessRequests";
import { getClientIp } from "@/lib/net";
import { NextRequest } from "next/server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Polled by viewers of a private stream while they wait in the pending queue
// (see JoinGate.tsx). Public streams and the streamer themself are always "approved".
export async function GET(
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

  if (user.role === "streamer" || getPathVisibility(path) !== "private") {
    return json({ status: "approved" });
  }

  // Check if there's an active publisher for this path
  try {
    const pathsRes = await fetch("http://discordmtx:9997/v3/paths/list");
    if (pathsRes.ok) {
      const pathsData = await pathsRes.json();
      const pathInfo = (pathsData.items || []).find((p: any) => p.name === path);
      if (!pathInfo || !pathInfo.ready) {
        return json({ status: "offline" });
      }
    }
  } catch (err) {
    console.error("Failed to check path status:", err);
    // Continue with access request check on error
  }

  const ip = getClientIp(req);
  const status = requestAccess(
    path,
    ip,
    user.role === "discord" ? user.name : null,
    user.role === "discord" ? user.image : null
  );

  if (status === "denied") {
    const denialInfo = getDenialInfo(path, ip);
    return json({ status: "denied", denialInfo });
  }

  return json({ status });
}
