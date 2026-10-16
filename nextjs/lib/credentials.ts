import { timingSafeEqual } from "crypto";

export function safeEqual(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Failed password logins per IP, against guessing.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

type Failures = { count: number; since: number };
const store = globalThis as typeof globalThis & { __loginFailures?: Map<string, Failures> };
const failures = (store.__loginFailures ??= new Map<string, Failures>());

function current(ip: string): Failures | undefined {
  const entry = failures.get(ip);
  if (entry && Date.now() - entry.since > WINDOW_MS) {
    failures.delete(ip);
    return undefined;
  }
  return entry;
}

// Runs `check` unless the IP failed too often; a lockout lasts out the window.
export function throttledLogin(ip: string, check: () => boolean): boolean {
  if ((current(ip)?.count ?? 0) >= MAX_FAILURES) return false;
  if (check()) return true;
  const entry = current(ip);
  if (entry) entry.count++;
  else failures.set(ip, { count: 1, since: Date.now() });
  return false;
}
