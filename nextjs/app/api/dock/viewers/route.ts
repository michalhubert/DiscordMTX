import { isStreamerAuthorized } from "@/lib/authz";
import { getViewerIdentity, pruneViewerIdentities } from "@/lib/viewerIdentities";
import { kickViewerIp } from "@/lib/kickedViewers";
import { NextRequest } from "next/server";

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";
  const upstream = `http://${host}:${apiPort}/v3/webrtcsessions/list`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const items: { id: string; [key: string]: unknown }[] = data.items || [];

    pruneViewerIdentities(items.map((item) => item.id));

    const merged = items.map((item) => {
      const identity = getViewerIdentity(item.id);
      return {
        ...item,
        viewerName: identity?.name ?? null,
        viewerImage: identity?.image ?? null,
        viewerRole: identity?.role ?? null,
        viewerIp: identity?.ip ?? null,
      };
    });

    return new Response(JSON.stringify({ ...data, items: merged }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "MediaMTX API unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return new Response("Missing session ID", { status: 400 });
  }

  // Ban this viewer's IP on their path for a short cooldown so, once MediaMTX
  // drops the connection below, the player's auto-reconnect loop can't just
  // open a fresh WHEP session and undo the kick.
  const identity = getViewerIdentity(sessionId);
  if (identity?.ip && identity.path) {
    kickViewerIp(identity.path, identity.ip);
  }

  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";
  const upstream = `http://${host}:${apiPort}/v3/webrtcsessions/${encodeURIComponent(sessionId)}`;

  try {
    const res = await fetch(upstream, {
      method: "DELETE",
    });

    if (!res.ok) {
      return new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "MediaMTX API unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
