import {
  approveViewer,
  deleteAccessRequest,
  deleteAccessRequestsForPath,
  deleteApproval,
  deleteApprovalsForPath,
  getAccessRequest,
  getViewerPassword,
  isViewerApproved,
  listAccessRequests,
  listApprovedViewers,
  touchAccessRequest,
} from "./db";
import { clearBlock, denyViewer } from "./accessBlocks";

export type AccessStatus = "approved" | "pending";

export type PendingRequest = {
  ip: string;
  path: string;
  name: string | null;
  image: string | null;
  role: string;
  requestedAt: number;
};

const STALE_MS = 2 * 60 * 1000;

const roleKey = (role?: string) => role ?? "guest";

export function isApproved(path: string, ip: string, role?: string): boolean {
  return isViewerApproved(path, ip, roleKey(role));
}

export function requestAccess(
  path: string,
  ip: string,
  name: string | null,
  image: string | null,
  role?: string,
  discordId?: string | null
): AccessStatus {
  if (isApproved(path, ip, role)) return "approved";
  touchAccessRequest(
    { path, ip, role: roleKey(role), name, image, discord_id: discordId ?? null },
    Date.now()
  );
  return "pending";
}

export function approveAccess(path: string, ip: string, role?: string): void {
  const discordId = getAccessRequest(path, ip, roleKey(role))?.discord_id;
  approveViewer(path, ip, roleKey(role));
  deleteAccessRequest(path, ip, roleKey(role));
  clearBlock(path, { role, ip, discordId });
}

export function denyAccess(path: string, ip: string, role?: string): void {
  const discordId = getAccessRequest(path, ip, roleKey(role))?.discord_id;
  deleteAccessRequest(path, ip, roleKey(role));
  deleteApproval(path, ip, roleKey(role));
  denyViewer(path, { role, ip, discordId });
}

export function revokeApproval(path: string, ip: string, role?: string): void {
  deleteApproval(path, ip, roleKey(role));
}

export function listPendingRequests(): PendingRequest[] {
  return listAccessRequests(Date.now() - STALE_MS).map((r) => ({
    ip: r.ip,
    path: r.path,
    name: r.name,
    image: r.image,
    role: r.role,
    requestedAt: r.requested_at,
  }));
}

export function clearApprovedViewers(path: string): void {
  deleteApprovalsForPath(path);
}

export function clearPendingRequests(path: string): void {
  deleteAccessRequestsForPath(path);
}

// Rotating the password for `rotatedPath` also invalidates any other path that has no
// password override of its own and therefore falls back to it - so those paths' password
// viewers must be cleared too, not just `rotatedPath` itself.
export function usesPasswordOf(path: string, rotatedPath: string): boolean {
  return path === rotatedPath || (rotatedPath === "default" && !getViewerPassword(path));
}

export function clearApprovedPasswordViewers(rotatedPath: string): void {
  for (const a of listApprovedViewers()) {
    if (a.role !== "discord" && usesPasswordOf(a.path, rotatedPath)) {
      deleteApproval(a.path, a.ip, a.role);
    }
  }
}
