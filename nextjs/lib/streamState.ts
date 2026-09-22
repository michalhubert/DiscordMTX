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
    // Restarts are handled by the offline branch above; don't compare readyTime here -
    // the hook and the poller use different clocks and never agree, which was wiping
    // approvals right after they got granted.
    const existing = getStreamSessionByPath(path);
    if (!existing) {
      const readyTime = pathInfo?.readyTime ? new Date(pathInfo.readyTime).getTime() : Date.now();
      clearApprovedViewers(path);
      createStreamSession(path, String(readyTime));
    }
  }
}
