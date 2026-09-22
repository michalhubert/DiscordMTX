import { isStreamerAuthorized } from "@/lib/authz";
import { clearApprovedViewers } from "@/lib/accessRequests";
import { createStreamSession, deleteStreamSession } from "@/lib/db";
import { NextRequest } from "next/server";

function mediamtxBase() {
  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const port = process.env.MEDIAMTX_PORT ?? "8889";
  return `http://${host}:${port}`;
}

// Publishing is restricted to the "streamer" internal MediaMTX user (see
// entrypoint.sh), so requests to MediaMTX must carry its credentials,
// unlike the anonymous/"any" user used for WHEP reads.
function mediamtxAuthHeader(): string {
  const password = process.env.STREAMER_PASSWORD ?? "";
  return "Basic " + Buffer.from(`streamer:${password}`).toString("base64");
}

// WHIP publish: browser posts an SDP offer, MediaMTX answers and starts
// ingesting the "browser" path. Mirrors /api/whep but for the publisher
// side and restricted to authorized streamers only.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const upstream = `${mediamtxBase()}/${path}/whip`;

  // Create stream session record (cascade will handle denial records when deleted)
  createStreamSession(path);

  // A fresh stream is a new "session" for access purposes - previously
  // approved viewers (public or private) must request/be granted access
  // again, regardless of the path's current visibility.
  clearApprovedViewers(path);

  const body = await req.text();
  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Authorization: mediamtxAuthHeader(),
    },
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

  return new Response(await res.text(), {
    status: res.status,
    headers: responseHeaders,
  });
}

// WHIP teardown: browser calls this (with the WHIP resource id from the
// "Id"/"Location" header) when the user stops streaming, so MediaMTX ends
// the session immediately instead of waiting for an ICE timeout.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const resourceId = req.nextUrl.searchParams.get("id");
  if (!resourceId) {
    return new Response("Missing id", { status: 400 });
  }

  const upstream = `${mediamtxBase()}/${path}/whip/${resourceId}`;

  // Delete stream session (cascade will automatically delete denial records)
  deleteStreamSession(path);

  // Once the stream ends, any previously approved viewers must re-request
  // access on the next stream, instead of the stale approval silently
  // carrying over.
  clearApprovedViewers(path);

  try {
    const res = await fetch(upstream, {
      method: "DELETE",
      headers: { Authorization: mediamtxAuthHeader() },
    });
    return new Response(null, { status: res.status });
  } catch {
    return new Response(null, { status: 204 });
  }
}
