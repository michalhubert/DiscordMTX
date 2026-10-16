// The header the reverse proxy in front of this app puts the client's IP in.
// For x-forwarded-for only the last entry is trusted: it's added by the
// closest proxy, while earlier ones come from the client. Any other header
// (e.g. cf-connecting-ip) must be overwritten by the proxy, or clients can
// pick their own IP.
const CLIENT_IP_HEADER = (process.env.CLIENT_IP_HEADER || "x-forwarded-for").toLowerCase();

export function getClientIp(req: { headers: Headers }): string {
  const value = req.headers.get(CLIENT_IP_HEADER);
  const ip = CLIENT_IP_HEADER === "x-forwarded-for" ? value?.split(",").at(-1) : value;
  return ip?.trim() || "unknown";
}
