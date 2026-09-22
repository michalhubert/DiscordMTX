// Small shared helpers for talking to the MediaMTX control API, used by the
// dock (viewer list / kick) and by password rotation to forcibly drop
// currently-connected viewer-password sessions.

export function mediamtxApiBase(): string {
  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";
  return `http://${host}:${apiPort}`;
}

export type WebrtcSessionItem = { id: string; path?: string; [key: string]: unknown };

export async function listWebrtcSessions(): Promise<WebrtcSessionItem[]> {
  try {
    const res = await fetch(`${mediamtxApiBase()}/v3/webrtcsessions/list`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// Ends a WebRTC session on MediaMTX. This alone only closes the current
// RTCPeerConnection - callers that want the viewer to actually stay out
// must also ban them via lib/kickedViewers so the WHEP endpoint refuses
// their immediate reconnect attempt.
export async function kickWebrtcSession(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${mediamtxApiBase()}/v3/webrtcsessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
