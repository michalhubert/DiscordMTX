function mediamtxHost(): string {
  return process.env.MEDIAMTX_HOST ?? "discordmtx";
}

export function mediamtxApiBase(): string {
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";
  return `http://${mediamtxHost()}:${apiPort}`;
}

// WebRTC server (WHIP/WHEP endpoints), separate from the control API.
export function mediamtxWebrtcBase(): string {
  const port = process.env.MEDIAMTX_PORT ?? "8889";
  return `http://${mediamtxHost()}:${port}`;
}

const SDP_RESPONSE_HEADERS = new Set(["content-type", "location", "link", "accept-patch", "id"]);

export function forwardSdpHeaders(res: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of res.headers.entries()) {
    if (SDP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return headers;
}

const API_TIMEOUT_MS = 3000;

async function listItems<T>(endpoint: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${mediamtxApiBase()}/v3/${endpoint}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.items || [];
  } catch {
    return null;
  }
}

export function listConfiguredPaths(): Promise<{ name: string }[] | null> {
  return listItems<{ name: string }>("config/paths/list");
}

export type PathItem = {
  name: string;
  ready?: boolean;
  readyTime?: string;
  readers?: unknown[];
  [key: string]: unknown;
};

// null = MediaMTX unreachable or errored.
export function listPaths(): Promise<PathItem[] | null> {
  return listItems<PathItem>("paths/list");
}

export type WebrtcSessionItem = {
  id: string;
  path?: string;
  state?: string;
  user?: string;
  [key: string]: unknown;
};

// null = MediaMTX unreachable or errored.
export function fetchWebrtcSessions(): Promise<WebrtcSessionItem[] | null> {
  return listItems<WebrtcSessionItem>("webrtcsessions/list");
}

export async function listWebrtcSessions(): Promise<WebrtcSessionItem[]> {
  return (await fetchWebrtcSessions()) ?? [];
}

// Ends a WebRTC session on MediaMTX. This alone only closes the current
// RTCPeerConnection - callers that want the viewer to actually stay out
// must also ban them via lib/accessBlocks so the WHEP endpoint refuses
// their immediate reconnect attempt.
export async function kickWebrtcSession(id: string): Promise<boolean> {
  try {
    // MediaMTX's kick endpoint is POST /v3/webrtcsessions/kick/{id}, not
    // DELETE /v3/webrtcsessions/{id} (which doesn't exist and returns 404).
    const res = await fetch(`${mediamtxApiBase()}/v3/webrtcsessions/kick/${encodeURIComponent(id)}`, {
      method: "POST",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
