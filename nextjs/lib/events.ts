// Listeners re-read state themselves; passing no details keeps them in sync.

type Listener = (paths: ReadonlySet<string>) => void;

type Hub = { listeners: Set<Listener>; pending: Set<string>; scheduled: boolean };

// On globalThis so every route bundle (and dev HMR) shares one hub.
const store = globalThis as typeof globalThis & { __changeHub?: Hub };
const hub = (store.__changeHub ??= { listeners: new Set(), pending: new Set(), scheduled: false });

export const ALL_PATHS = "*";

export function notifyChanged(path: string): void {
  hub.pending.add(path);
  if (hub.scheduled) return;
  hub.scheduled = true;
  // Deferred: callers are mid-update, and listeners may change state themselves.
  setImmediate(flush);
}

function flush(): void {
  hub.scheduled = false;
  const paths = new Set(hub.pending);
  hub.pending.clear();
  for (const listener of hub.listeners) {
    try {
      listener(paths);
    } catch (err) {
      console.error("Change listener failed:", err);
    }
  }
}

export function onChanged(listener: Listener): () => void {
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
  };
}

export function affectsPath(paths: ReadonlySet<string>, path: string): boolean {
  return paths.has(path) || paths.has(ALL_PATHS);
}
