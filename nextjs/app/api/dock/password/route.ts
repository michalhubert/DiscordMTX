import { auth } from "@/lib/auth";
import { getViewerPassword, rotateViewerPassword } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
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
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    return new Response("Unauthorized", { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") || "default";
  const newPassword = rotateViewerPassword(path);

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
