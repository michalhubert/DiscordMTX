import { auth } from "@/lib/auth";
import { approveAccess } from "@/lib/accessRequests";
import { NextRequest } from "next/server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { path, ip } = (body ?? {}) as { path?: unknown; ip?: unknown };
  if (typeof path !== "string" || typeof ip !== "string" || !path || !ip) {
    return json({ error: "Missing path or ip" }, 400);
  }

  approveAccess(path, ip);
  return json({ ok: true });
}
