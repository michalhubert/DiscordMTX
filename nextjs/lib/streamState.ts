import { clearApprovedViewers } from "./accessRequests";
import { getStreamSessionByPath, createStreamSession, deleteStreamSession } from "./db";

export function syncStreamState(
  path: string,
  pathInfo?: { ready?: boolean; readyTime?: string } | null
): void {
  if (!path) return;

  const existing = getStreamSessionByPath(path);

  if (!pathInfo?.ready) {
    if (existing) {
      deleteStreamSession(path);
      clearApprovedViewers(path);
    }
  } else if (!existing) {
    // Restarts are handled by the offline branch above; don't compare readyTime here -
    // the hook and the poller use different clocks and never agree, which was wiping
    // approvals right after they got granted.
    const readyTime = pathInfo.readyTime ? new Date(pathInfo.readyTime).getTime() : Date.now();
    clearApprovedViewers(path);
    createStreamSession(path, String(readyTime));
  }
}
