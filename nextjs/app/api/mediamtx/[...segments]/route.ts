import { isStreamerAuthorized } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { segments } = await params;
  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";
  const upstream = `http://${host}:${apiPort}/v3/${segments.join("/")}${req.nextUrl.search}`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "MediaMTX API unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
