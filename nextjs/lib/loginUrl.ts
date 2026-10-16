export function loginUrlFor(path: string): string {
  return `/login?${new URLSearchParams({ callbackUrl: `/${path}` })}`
}

// Rejects other sites and schemes like javascript: in a callbackUrl.
export function sameSitePath(url: string | null, fallback: string): string {
  if (!url) return fallback
  try {
    const parsed = new URL(url, 'http://same.site')
    if (parsed.origin !== 'http://same.site') return fallback
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return fallback
  }
}

export function streamPathOf(callbackUrl: unknown): string | null {
  if (typeof callbackUrl !== 'string') return null
  try {
    return new URL(callbackUrl, 'http://localhost').pathname.split('/')[1] || null
  } catch {
    return null
  }
}
