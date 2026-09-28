// In-memory watch rooms, one per stream path: the open event streams of
// app/api/watch/[path]/route.ts, used for the viewer list and reactions.
import { createHash } from "crypto";
import type { SessionUser } from "./authz";
import { cachedGuestIdentity, guestIdentity } from "./guestIdentity";
import { REACTION_RATE_LIMIT, type WatchEvent, type WatchViewer } from "./watchRoomShared";

export type WatchClient = {
  connectionId: string;
  viewer: WatchViewer;
  ip: string;
  role: string;
  send: (event: WatchEvent) => void;
  close: () => void;
};

type Room = Map<string, WatchClient>; // connectionId -> client

// On globalThis so every route bundle (and dev HMR) shares one registry.
const store = globalThis as typeof globalThis & {
  __watchRooms?: Map<string, Room>;
  __watchReactionLog?: Map<string, number[]>;
};
const rooms = (store.__watchRooms ??= new Map<string, Room>());
const reactionLog = (store.__watchReactionLog ??= new Map<string, number[]>());

function shortHash(value: string): string {
  return createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET ?? ""}:${value}`)
    .digest("hex")
    .slice(0, 12);
}

// Ids are hashed, since other viewers see them. Guests are told apart by IP.
export async function watchViewerFor(
  user: SessionUser,
  ip: string,
  path: string,
  { waitForAvatar = true } = {},
): Promise<{ viewer: WatchViewer; kept: boolean | null }> {
  if (user.role === "discord") {
    return {
      viewer: { id: shortHash(`discord:${user.name}`), name: user.name, image: user.image, role: "discord" },
      kept: null,
    };
  }
  if (user.role === "streamer") {
    return { viewer: { id: shortHash("streamer"), name: "Streamer", image: null, role: "streamer" }, kept: null };
  }
  const guest = waitForAvatar ? await guestIdentity(path, ip) : cachedGuestIdentity(path, ip);
  return {
    viewer: { id: shortHash(`viewer:${ip}`), name: guest.name, image: guest.image, role: "viewer" },
    kept: guest.kept,
  };
}

function presence(room: Room): WatchViewer[] {
  // Several tabs of one person are listed once.
  const unique = new Map<string, WatchViewer>();
  for (const client of room.values()) unique.set(client.viewer.id, client.viewer);
  return Array.from(unique.values()).sort((a, b) => {
    if (a.role === "streamer" && b.role !== "streamer") return -1;
    if (b.role === "streamer" && a.role !== "streamer") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function broadcastWatchEvent(path: string, event: WatchEvent, exceptConnectionId?: string): void {
  const room = rooms.get(path);
  if (!room) return;
  for (const client of room.values()) {
    if (client.connectionId !== exceptConnectionId) client.send(event);
  }
}

function broadcastPresence(path: string): void {
  const room = rooms.get(path);
  if (room) broadcastWatchEvent(path, { type: "presence", viewers: presence(room) });
}

export function joinWatchRoom(path: string, client: WatchClient): void {
  let room = rooms.get(path);
  if (!room) {
    room = new Map();
    rooms.set(path, room);
  }
  room.set(client.connectionId, client);
  broadcastPresence(path);
}

export function leaveWatchRoom(path: string, connectionId: string): void {
  const room = rooms.get(path);
  if (!room?.delete(connectionId)) return;
  if (room.size === 0) rooms.delete(path);
  else broadcastPresence(path);
}

// Tells the room when a guest's name or picture changed (new stream, reroll).
export async function refreshWatchGuest(path: string, ip: string): Promise<void> {
  const room = rooms.get(path);
  const clients = room ? Array.from(room.values()).filter((c) => c.ip === ip && c.viewer.role === "viewer") : [];
  if (clients.length === 0) return;

  const guest = await guestIdentity(path, ip);
  let changed = false;
  for (const client of clients) {
    if (client.viewer.name !== guest.name || client.viewer.image !== guest.image) {
      client.viewer = { ...client.viewer, name: guest.name, image: guest.image };
      changed = true;
    }
  }
  if (changed) broadcastPresence(path);
}

export function disconnectWatchViewer(path: string, ip: string, role?: string): void {
  const room = rooms.get(path);
  if (!room) return;
  for (const client of Array.from(room.values())) {
    if (client.ip === ip && client.role === role) client.close();
  }
}

export function allowReaction(viewerId: string): boolean {
  const now = Date.now();
  const recent = (reactionLog.get(viewerId) ?? []).filter((t) => now - t < REACTION_RATE_LIMIT.windowMs);
  if (recent.length >= REACTION_RATE_LIMIT.max) {
    reactionLog.set(viewerId, recent);
    return false;
  }
  recent.push(now);
  reactionLog.set(viewerId, recent);

  // Prune viewers that stopped reacting.
  if (reactionLog.size > 1000) {
    for (const [id, times] of reactionLog) {
      if (times.every((t) => now - t >= REACTION_RATE_LIMIT.windowMs)) reactionLog.delete(id);
    }
  }
  return true;
}
