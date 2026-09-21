import { auth } from "@/lib/auth";
import { getPathVisibility } from "@/lib/db";
import { requestAccess } from "@/lib/accessRequests";
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
  const user = session.user as { name?: string | null; image?: string | null; role?: string };

  if (user.role === "streamer" || getPathVisibility(path) !== "private") {
    return json({ status: "approved" });
  }

  const ip = getClientIp(req);
  const status = requestAccess(
    path,
    ip,
    user.role === "discord" ? user.name ?? null : null,
    user.role === "discord" ? user.image ?? null : null
  );
  return json({ status });
}
