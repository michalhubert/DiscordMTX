export function loginUrlFor(path: string): string {
  return `/login?${new URLSearchParams({ callbackUrl: `/${path}` })}`
}

export function streamPathOf(callbackUrl: unknown): string | null {
  if (typeof callbackUrl !== 'string') return null
  try {
    return new URL(callbackUrl, 'http://localhost').pathname.split('/')[1] || null
  } catch {
    return null
  }
}
