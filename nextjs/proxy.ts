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
  '/api/whip',
]

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth?.user
  const isLoginPage = pathname.startsWith('/login')
  const isAuthApi = pathname.startsWith('/api/auth')
  const isDockArea = DOCK_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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
