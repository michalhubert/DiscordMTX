// In-memory join-request queue for private streams, keyed by client IP
// (not persisted across restarts - same tradeoff as lib/viewerIdentities.ts).

export type AccessStatus = "approved" | "pending";

export type PendingRequest = {
  ip: string;
  path: string;
  name: string | null;
  image: string | null;
  requestedAt: number;
  lastSeenAt: number;
};

// Requests not polled by the viewer for this long are dropped (e.g. they closed the tab).
const STALE_MS = 2 * 60 * 1000;

const pendingRequests = new Map<string, PendingRequest>();
const approvedViewers = new Map<string, Set<string>>();

function key(path: string, ip: string): string {
  return `${path}::${ip}`;
}

function pruneStale() {
  const now = Date.now();
  for (const [k, entry] of pendingRequests) {
    if (now - entry.lastSeenAt > STALE_MS) pendingRequests.delete(k);
  }
}

export function isApproved(path: string, ip: string): boolean {
  return approvedViewers.get(path)?.has(ip) ?? false;
}

// Creates (or refreshes) a pending request for this viewer, unless already approved.
export function requestAccess(
  path: string,
  ip: string,
  name: string | null,
  image: string | null
): AccessStatus {
  if (isApproved(path, ip)) return "approved";

  const now = Date.now();
  const k = key(path, ip);
  const existing = pendingRequests.get(k);
  if (existing) {
    existing.lastSeenAt = now;
    existing.name = name;
    existing.image = image;
  } else {
    pendingRequests.set(k, { ip, path, name, image, requestedAt: now, lastSeenAt: now });
  }

  pruneStale();
  return "pending";
}

export function approveAccess(path: string, ip: string): void {
  let set = approvedViewers.get(path);
  if (!set) {
    set = new Set();
    approvedViewers.set(path, set);
  }
  set.add(ip);
  pendingRequests.delete(key(path, ip));
}

export function denyAccess(path: string, ip: string): void {
  pendingRequests.delete(key(path, ip));
  approvedViewers.get(path)?.delete(ip);
}

export function listPendingRequests(): PendingRequest[] {
  pruneStale();
  return Array.from(pendingRequests.values()).sort((a, b) => a.requestedAt - b.requestedAt);
}
