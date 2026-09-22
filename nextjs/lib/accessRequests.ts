import { getDenialRecord, setDenialRecord, deleteDenialRecord, pruneExpiredDenialRecords, getStreamSessionByPath } from "./db";

export type AccessStatus = "approved" | "pending" | "offline" | "denied";

export type PendingRequest = {
  ip: string;
  path: string;
  name: string | null;
  image: string | null;
  role?: string;
  requestedAt: number;
  lastSeenAt: number;
};

const STALE_MS = 2 * 60 * 1000;

function getTimeoutDurations(): number[] {
  const env = process.env.DENIAL_TIMEOUTS;
  if (!env) return [1, 5, 15].map((m) => m * 60 * 1000);
  
  try {
    const minutes = env.split(",").map((s) => parseInt(s.trim(), 10));
    if (minutes.some(isNaN) || minutes.length === 0) {
      console.warn("Invalid DENIAL_TIMEOUTS format, using defaults");
      return [1, 5, 15].map((m) => m * 60 * 1000);
    }
    return minutes.map((m) => m * 60 * 1000);
  } catch (err) {
    console.warn("Error parsing DENIAL_TIMEOUTS, using defaults:", err);
    return [1, 5, 15].map((m) => m * 60 * 1000);
  }
}

const TIMEOUT_MS = getTimeoutDurations();

const pendingRequests = new Map<string, PendingRequest>();
const approvedViewers = new Map<string, Map<string, { role?: string; approvedAt: number }>>();

function key(path: string, ip: string): string {
  return `${path}::${ip}`;
}

function pruneStale() {
  const now = Date.now();
  for (const [k, entry] of pendingRequests) {
    if (now - entry.lastSeenAt > STALE_MS) pendingRequests.delete(k);
  }
  pruneExpiredDenialRecords();
}

export function isApproved(path: string, ip: string, role?: string): boolean {
  const map = approvedViewers.get(path);
  if (!map) return false;
  const entry = map.get(ip);
  if (!entry) return false;
  if (role && entry.role && entry.role !== role) return false;
  return true;
}

export function requestAccess(
  path: string,
  ip: string,
  name: string | null,
  image: string | null,
  role?: string
): AccessStatus {
  if (isApproved(path, ip, role)) return "approved";

  const k = key(path, ip);
  const now = Date.now();

  const streamSession = getStreamSessionByPath(path);
  if (streamSession) {
    const denial = getDenialRecord(streamSession.id, ip);
    if (denial && now < denial.denied_until) {
      return "denied";
    }
  }

  const existing = pendingRequests.get(k);
  if (existing) {
    existing.lastSeenAt = now;
    existing.name = name;
    existing.image = image;
    existing.role = role ?? existing.role;
  } else {
    pendingRequests.set(k, { ip, path, name, image, role, requestedAt: now, lastSeenAt: now });
  }

  pruneStale();
  return "pending";
}

export function approveAccess(path: string, ip: string, role?: string): void {
  const pending = pendingRequests.get(key(path, ip));
  const effectiveRole = role ?? pending?.role;
  let map = approvedViewers.get(path);
  if (!map) {
    map = new Map();
    approvedViewers.set(path, map);
  }
  map.set(ip, { role: effectiveRole, approvedAt: Date.now() });
  pendingRequests.delete(key(path, ip));
  
  const streamSession = getStreamSessionByPath(path);
  if (streamSession) {
    deleteDenialRecord(streamSession.id, ip);
  }
}

export function denyAccess(path: string, ip: string): void {
  const k = key(path, ip);
  pendingRequests.delete(k);
  approvedViewers.get(path)?.delete(ip);

  const streamSession = getStreamSessionByPath(path);
  if (!streamSession) return;

  const existing = getDenialRecord(streamSession.id, ip);
  const denialCount = existing ? Math.min(existing.denial_count + 1, TIMEOUT_MS.length) : 1;
  const timeoutIndex = Math.min(denialCount - 1, TIMEOUT_MS.length - 1);
  const deniedUntil = Date.now() + TIMEOUT_MS[timeoutIndex];

  setDenialRecord(streamSession.id, ip, denialCount, deniedUntil);
}

export function revokeApproval(path: string, ip: string): void {
  approvedViewers.get(path)?.delete(ip);
}

export function listPendingRequests(): PendingRequest[] {
  pruneStale();
  return Array.from(pendingRequests.values()).sort((a, b) => a.requestedAt - b.requestedAt);
}

export function clearApprovedViewers(path: string): void {
  approvedViewers.delete(path);
}

export function clearApprovedPasswordViewers(path: string): void {
  const map = approvedViewers.get(path);
  if (!map) return;
  for (const [ip, entry] of Array.from(map.entries())) {
    if (entry.role === "viewer" || entry.role !== "discord") {
      map.delete(ip);
    }
  }
}

export function getDenialInfo(path: string, ip: string): { deniedUntil: number; denialCount: number } | null {
  const streamSession = getStreamSessionByPath(path);
  if (!streamSession) return null;

  const record = getDenialRecord(streamSession.id, ip);
  if (!record || Date.now() >= record.denied_until) {
    return null;
  }
  return {
    deniedUntil: record.denied_until,
    denialCount: record.denial_count,
  };
}
