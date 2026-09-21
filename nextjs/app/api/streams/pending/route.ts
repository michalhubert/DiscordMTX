import { auth } from "@/lib/auth";
import { listPendingRequests } from "@/lib/accessRequests";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(JSON.stringify({ items: listPendingRequests() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
