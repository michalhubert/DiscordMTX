// Tracks viewers who were just kicked (or whose viewer-password session was
// invalidated by a password rotation) so the WHEP endpoint can refuse their
// immediate reconnect instead of letting PlayerClient's auto-reconnect loop
// silently let them straight back in.

const kickedViewers = new Map<string, number>(); // `${path}::${ip}` -> banned-until timestamp

function getCooldownMs(): number {
  const raw = process.env.KICK_COOLDOWN_SECONDS;
  const seconds = raw ? parseInt(raw, 10) : NaN;
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 30) * 1000;
}

function key(path: string, ip: string): string {
  return `${path}::${ip}`;
}

export function kickViewerIp(path: string, ip: string): void {
  kickedViewers.set(key(path, ip), Date.now() + getCooldownMs());
}

export function isViewerKicked(path: string, ip: string): boolean {
  const k = key(path, ip);
  const until = kickedViewers.get(k);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    kickedViewers.delete(k);
    return false;
  }
  return true;
}
