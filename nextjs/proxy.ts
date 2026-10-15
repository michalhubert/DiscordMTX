import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

const DOCK_PREFIXES = [
  '/dock',
  '/stream',
  '/api/mediamtx',
  '/api/dock',
  '/api/stream',
  '/api/streams/visibility',
  '/api/streams/pending',
  '/api/whip',
]

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  // Other sites can't trigger actions with the user's cookies (or at all with
  // DISABLE_DOCK_AUTH). Only browsers send this header.
  const fetchSite = req.headers.get('sec-fetch-site')
  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    fetchSite &&
    fetchSite !== 'same-origin' &&
    fetchSite !== 'none'
  ) {
    return new Response('Cross-site request blocked', { status: 403 })
  }
  const isLoggedIn = !!req.auth?.user
  const isLoginPage = pathname.startsWith('/login')
  const isAuthApi = pathname.startsWith('/api/auth')
  // MediaMTX has no session; the route checks HOOK_SECRET itself.
  if (pathname === '/api/streams/hook') return NextResponse.next()
  const isDockArea = DOCK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
  const dockAuthDisabled = process.env.DISABLE_DOCK_AUTH === 'true'

  const redirectToLogin = (streamer: boolean) => {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    if (streamer) loginUrl.searchParams.set('mode', 'streamer')
    return Response.redirect(loginUrl)
  }

  if (!isLoggedIn && !isLoginPage && !isAuthApi) {
    if (isDockArea && dockAuthDisabled) {
      return NextResponse.next()
    }
    return redirectToLogin(isDockArea)
  }

  const role = (req.auth?.user as { role?: string } | undefined)?.role
  if (isDockArea && isLoggedIn && role !== 'streamer' && !dockAuthDisabled) {
    return redirectToLogin(true)
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
