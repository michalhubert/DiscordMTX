import { clearApprovedViewers } from "./accessRequests";
import { getStreamSessionByPath, createStreamSession, deleteStreamSession } from "./db";

export function syncStreamState(
  path: string,
  pathInfo?: { ready?: boolean; readyTime?: string } | null
): void {
  if (!path) return;

  const isReady = Boolean(pathInfo && pathInfo.ready);

  if (!isReady) {
    const existing = getStreamSessionByPath(path);
    if (existing) {
      deleteStreamSession(path);
      clearApprovedViewers(path);
    }
  } else {
    const readyTime = pathInfo?.readyTime ? new Date(pathInfo.readyTime).getTime() : Date.now();
    const existing = getStreamSessionByPath(path);
    if (!existing) {
      clearApprovedViewers(path);
      createStreamSession(path, String(readyTime));
    } else if (existing.resource_id && pathInfo?.readyTime && existing.resource_id !== String(readyTime)) {
      clearApprovedViewers(path);
      createStreamSession(path, String(readyTime));
    }
  }
}
