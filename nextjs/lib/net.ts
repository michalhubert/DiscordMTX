import { NextRequest } from "next/server";

// Best-effort client IP extraction. Trusts X-Forwarded-For/X-Real-IP, which is
// fine here since the reverse proxy in front of this app is expected to set
// them (see API_TRUSTED_PROXIES in docker-compose.yaml).
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
