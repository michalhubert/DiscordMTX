// Tracks viewers who were just kicked (or whose viewer-password session was
// invalidated by a password rotation) so the WHEP endpoint can refuse their
// immediate reconnect instead of letting PlayerClient's auto-reconnect loop
// silently let them straight back in.
import { viewerKey as key } from "./viewerKey";

const kickedViewers = new Map<string, number>(); // viewerKey(path, ip, role) -> banned-until timestamp

function getCooldownMs(): number {
  const raw = process.env.KICK_COOLDOWN_SECONDS;
  const seconds = raw ? parseInt(raw, 10) : NaN;
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
}

export function kickViewerIp(path: string, ip: string, role?: string): void {
  kickedViewers.set(key(path, ip, role), Date.now() + getCooldownMs());
}

// Returns the cooldown end timestamp if this viewer is still banned, or null otherwise.
export function getKickInfo(path: string, ip: string, role?: string): { kickedUntil: number } | null {
  const k = key(path, ip, role);
  const until = kickedViewers.get(k);
  if (until === undefined) return null;
  if (Date.now() >= until) {
    kickedViewers.delete(k);
    return null;
  }
  return { kickedUntil: until };
}
