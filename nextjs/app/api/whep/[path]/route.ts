import { auth } from "@/lib/auth";
import { rememberViewerIdentity } from "@/lib/viewerIdentities";
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
  const user = session.user as { name?: string | null; image?: string | null; role?: string };
  if (res.ok && sessionId) {
    rememberViewerIdentity(sessionId, {
      name: user.role === "discord" ? user.name || "Guest" : "Guest",
      image: user.role === "discord" ? user.image ?? null : null,
      role: user.role,
    });
  }

  return new Response(await res.text(), {
    status: res.status,
    headers: responseHeaders,
  });
}
