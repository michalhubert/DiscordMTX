// Shared identity key for per-viewer state (pending/approved/denied/kicked), keyed by
// path+ip+role so Discord and password/guest viewers sharing an IP never collide.
export function viewerKey(path: string, ip: string, role?: string): string {
  return `${path}::${ip}::${role ?? "guest"}`;
}
