// Kicks and denials. Discord viewers are blocked by account, everyone else by IP.
import {
  deleteAccessBlock,
  deleteAccessBlocks,
  getAccessBlock,
  pruneAccessBlocks,
  setAccessBlock,
  type AccessBlockRow,
} from "./db";

export type BlockedViewer = { role?: string; ip?: string; discordId?: string | null };

const DEFAULT_BLOCK_MINUTES = [1, 5, 15];
// Expired blocks are kept this long so a repeat kick or denial escalates to the next timeout.
const BLOCK_MEMORY_MS = 60 * 60 * 1000;

function getBlockTimeoutsMs(): number[] {
  let minutes = DEFAULT_BLOCK_MINUTES;
  const env = process.env.DENIAL_TIMEOUTS;
  if (env) {
    const parsed = env.split(",").map((s) => parseInt(s.trim(), 10));
    if (parsed.some(isNaN)) console.warn("Invalid DENIAL_TIMEOUTS format, using defaults");
    else minutes = parsed;
  }
  return minutes.map((m) => m * 60 * 1000);
}

const BLOCK_TIMEOUTS_MS = getBlockTimeoutsMs();

function subjectOf({ role, ip, discordId }: BlockedViewer): string | null {
  if (role === "discord") return discordId ? `discord:${discordId}` : null;
  return ip ? `${role ?? "guest"}@${ip}` : null;
}

export function blockedViewerOf(user: { role?: string; id?: string }, ip: string): BlockedViewer {
  return { role: user.role, ip, discordId: user.role === "discord" ? user.id : null };
}

export type AccessBlock = { reason: AccessBlockRow["reason"]; blockedUntil: number };

export function getBlock(path: string, viewer: BlockedViewer): AccessBlock | null {
  const subject = subjectOf(viewer);
  const row = subject && getAccessBlock(path, subject);
  return row && Date.now() < row.blocked_until
    ? { reason: row.reason, blockedUntil: row.blocked_until }
    : null;
}

// Kicks and denials share one escalating ladder, so getting kicked and
// coming back doesn't reset the next timeout.
function blockViewer(path: string, viewer: BlockedViewer, reason: AccessBlockRow["reason"]): void {
  const subject = subjectOf(viewer);
  if (!subject) return;
  pruneAccessBlocks(Date.now() - BLOCK_MEMORY_MS);
  const previous = getAccessBlock(path, subject)?.denial_count ?? 0;
  const count = Math.min(previous + 1, BLOCK_TIMEOUTS_MS.length);
  setAccessBlock({
    path,
    subject,
    reason,
    denial_count: count,
    blocked_until: Date.now() + BLOCK_TIMEOUTS_MS[count - 1],
  });
}

export function kickViewer(path: string, viewer: BlockedViewer): void {
  blockViewer(path, viewer, "kicked");
}

export function denyViewer(path: string, viewer: BlockedViewer): void {
  blockViewer(path, viewer, "denied");
}

export function clearBlock(path: string, viewer: BlockedViewer): void {
  const subject = subjectOf(viewer);
  if (subject) deleteAccessBlock(path, subject);
}

export function clearDenials(path: string): void {
  deleteAccessBlocks(path, "denied");
}
