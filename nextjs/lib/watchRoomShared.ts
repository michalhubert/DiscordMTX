// Shared by lib/watchRoom.ts and the player UI - no server-only imports.

export const REACTIONS = ["❤️", "😂", "🔥", "👏", "😮", "😢", "💯", "🎉"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

// Per viewer, enforced on both sides so the local echo matches what the server accepts.
export const REACTION_RATE_LIMIT = { max: 6, windowMs: 3000 };

export type WatchViewer = {
  id: string;
  name: string;
  image: string | null;
  role: "discord" | "viewer" | "streamer";
};

export type WatchReaction = {
  id: string;
  emoji: Reaction;
  from: WatchViewer;
  at: number;
};

// A guest's own pony settings; null for non-guests.
export type WatchGuest = { kept: boolean; favoriteTag: string | null; rerollInMs: number };

// Time left, so a wrong client clock doesn't matter.
export type WatchAccess =
  | { status: "ok" }
  | { status: "pending" }
  | { status: "blocked"; reason: "kicked" | "denied"; remainingMs: number }
  | { status: "unauthorized" };

export type WatchEvent =
  | { type: "connected"; connectionId: string }
  | { type: "state"; access: WatchAccess; online: boolean }
  // Player only.
  | { type: "hello"; self: WatchViewer; guest: WatchGuest | null }
  | { type: "presence"; viewers: WatchViewer[] }
  | ({ type: "reaction" } & WatchReaction);
