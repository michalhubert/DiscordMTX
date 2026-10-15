// Best-effort client IP extraction. When the site is proxied through
// Cloudflare, CF-Connecting-IP is Cloudflare's own record of the client's
// real IP and can't be spoofed by the client, so it takes priority over
// X-Forwarded-For - without it, X-Forwarded-For's leftmost entry actually
// ends up being Cloudflare's edge IP (e.g. 172.64.x.x) rather than the
// visitor's, since nothing upstream of this app appends the real client
// IP to that header
// Falls back to X-Forwarded-For/X-Real-IP, trusted as-is: the reverse proxy
// in front of this app is expected to overwrite them, otherwise a client
// can pick its own IP.
export function getClientIp(req: { headers: Headers }): string {
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
