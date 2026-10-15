// Kicks and denials. Discord viewers are blocked by account, everyone else by IP.
import {
  deleteAccessBlock,
  getAccessBlock,
  pruneAccessBlocks,
  setAccessBlock,
  type AccessBlockRow,
} from "./db";

export type BlockedViewer = { role?: string; ip?: string; discordId?: string | null };

const DEFAULT_KICK_SECONDS = 60;
const DEFAULT_DENIAL_MINUTES = [1, 5, 15];
// Expired denials are kept this long so a repeat denial escalates to the next timeout.
const DENIAL_MEMORY_MS = 60 * 60 * 1000;

function getKickCooldownMs(): number {
  const seconds = parseInt(process.env.KICK_COOLDOWN_SECONDS ?? "", 10);
  return (seconds > 0 ? seconds : DEFAULT_KICK_SECONDS) * 1000;
}

function getDenialTimeoutsMs(): number[] {
  let minutes = DEFAULT_DENIAL_MINUTES;
  const env = process.env.DENIAL_TIMEOUTS;
  if (env) {
    const parsed = env.split(",").map((s) => parseInt(s.trim(), 10));
    if (parsed.some(isNaN)) console.warn("Invalid DENIAL_TIMEOUTS format, using defaults");
    else minutes = parsed;
  }
  return minutes.map((m) => m * 60 * 1000);
}

const DENIAL_TIMEOUTS_MS = getDenialTimeoutsMs();

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

export function kickViewer(path: string, viewer: BlockedViewer): void {
  const subject = subjectOf(viewer);
  if (!subject) return;
  setAccessBlock({
    path,
    subject,
    reason: "kicked",
    denial_count: getAccessBlock(path, subject)?.denial_count ?? 0,
    blocked_until: Date.now() + getKickCooldownMs(),
  });
}

export function denyViewer(path: string, viewer: BlockedViewer): void {
  const subject = subjectOf(viewer);
  if (!subject) return;
  pruneAccessBlocks(Date.now() - DENIAL_MEMORY_MS);
  const previous = getAccessBlock(path, subject)?.denial_count ?? 0;
  const denialCount = Math.min(previous + 1, DENIAL_TIMEOUTS_MS.length);
  setAccessBlock({
    path,
    subject,
    reason: "denied",
    denial_count: denialCount,
    blocked_until: Date.now() + DENIAL_TIMEOUTS_MS[denialCount - 1],
  });
}

export function clearBlock(path: string, viewer: BlockedViewer): void {
  const subject = subjectOf(viewer);
  if (subject) deleteAccessBlock(path, subject);
}
