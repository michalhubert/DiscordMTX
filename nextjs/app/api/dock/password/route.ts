import { auth } from "@/lib/auth";
import { readFileSync } from "fs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    return new Response("Unauthorized", { status: 401 });
  }

  let password: string | null = null;
  try {
    password = readFileSync("/auth/viewer-token", "utf8").trim() || null;
  } catch {
    password = null;
  }

  return new Response(JSON.stringify({ password }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
