import { auth } from "@/lib/auth";
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
  // Forward headers needed for WHEP (Location, Link for ICE servers, etc.)
  for (const [key, value] of res.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "content-type" ||
      lower === "location" ||
      lower === "link" ||
      lower === "accept-patch"
    ) {
      responseHeaders.set(key, value);
    }
  }

  return new Response(await res.text(), {
    status: res.status,
    headers: responseHeaders,
  });
}
