import { auth } from "@/lib/auth";
import { getViewerIdentity, pruneViewerIdentities } from "@/lib/viewerIdentities";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
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
