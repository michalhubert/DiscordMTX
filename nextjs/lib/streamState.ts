import { clearApprovedViewers } from "./accessRequests";
import { getStreamSessionByPath, createStreamSession, deleteStreamSession } from "./db";
import { notifyChanged } from "./events";
import { listPaths } from "./mediamtx";

// Catches missed online/offline hooks (e.g. a wrong HOOK_SECRET).
const RECONCILE_MS = 10_000;

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
      notifyChanged(path);
    }
  } else if (!existing) {
    // Restarts are handled by the offline branch above; don't compare readyTime here -
    // the hook and the poller use different clocks and never agree, which was wiping
    // approvals right after they got granted.
    const readyTime = pathInfo.readyTime ? new Date(pathInfo.readyTime).getTime() : Date.now();
    clearApprovedViewers(path);
    createStreamSession(path, String(readyTime));
    notifyChanged(path);
  }
}

export function isStreamOnline(path: string): boolean {
  return !!getStreamSessionByPath(path);
}

// Returns MediaMTX's path list, or null if it couldn't be reached.
export async function refreshStreamStates() {
  const paths = await listPaths();
  for (const item of paths ?? []) {
    if (item.name) syncStreamState(item.name, item);
  }
  return paths;
}

type Reconciler = { watchers: number; timer: ReturnType<typeof setInterval> | null };
const store = globalThis as typeof globalThis & { __streamStateReconciler?: Reconciler };
const reconciler = (store.__streamStateReconciler ??= { watchers: 0, timer: null });

export function watchStreamStates(): () => void {
  reconciler.watchers++;
  reconciler.timer ??= setInterval(() => void refreshStreamStates(), RECONCILE_MS);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--reconciler.watchers > 0 || !reconciler.timer) return;
    clearInterval(reconciler.timer);
    reconciler.timer = null;
  };
}
