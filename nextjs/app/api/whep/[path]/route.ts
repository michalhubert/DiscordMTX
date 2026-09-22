import { auth } from '@/lib/auth'
import { rememberViewerIdentity } from '@/lib/viewerIdentities'
import { getClientIp } from '@/lib/net'
import { getPathVisibility } from '@/lib/db'
import { isApproved } from '@/lib/accessRequests'
import { getKickInfo } from '@/lib/kickedViewers'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { path } = await params
  const user = session.user as SessionUser
  const ip = getClientIp(req)

  // Refuse to hand out a new WHEP session once the streamer has rotated the password -
  // the client is forced back to the login screen instead of silently reconnecting.
  if (isViewerPasswordStale(user, path)) {
    return new Response('Viewer password changed', { status: 401 })
  }

  // Recently kicked by the streamer - refuse reconnects for the cooldown window
  const kickInfo =
    user.role !== 'streamer' ? getKickInfo(path, ip, user.role) : null
  if (kickInfo) {
    return new Response(
      JSON.stringify({ error: 'kicked', kickedUntil: kickInfo.kickedUntil }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Check if viewer is approved for private streams
  if (user.role !== 'streamer' && getPathVisibility(path) === 'private') {
    if (!isApproved(path, ip, user.role)) {
      return new Response('Access not approved', { status: 403 })
    }
  }

  const host = process.env.MEDIAMTX_HOST ?? 'discordmtx'
  const port = process.env.MEDIAMTX_PORT ?? '8889'
  const upstream = `http://${host}:${port}/${path}/whep`

  const body = await req.text()
  const res = await fetch(upstream, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body,
  })

  const responseHeaders = new Headers()
  for (const [key, value] of res.headers.entries()) {
    const lower = key.toLowerCase()
    if (
      lower === 'content-type' ||
      lower === 'location' ||
      lower === 'link' ||
      lower === 'accept-patch' ||
      lower === 'id'
    ) {
      responseHeaders.set(key, value)
    }
  }

  const location = res.headers.get('location')
  // MediaMTX's "Id" response header carries the same session id used by
  // /v3/webrtcsessions/list. The Location header's path segment is a
  // separate WHEP resource identifier and is NOT guaranteed to match it,
  // so we must key off "Id" rather than parsing Location.
  const sessionId =
    res.headers.get('id') || location?.split('/').filter(Boolean).pop()
  if (res.ok && sessionId) {
    rememberViewerIdentity(sessionId, {
      // Discord viewers show their real name/avatar; everyone else (viewer-password) is
      // identified by IP address instead, since there's no per-person account for them.
      name: user.role === 'discord' ? user.name : ip,
      image: user.role === 'discord' ? user.image : null,
      role: user.role,
      ip,
      path,
    })
  }

  return new Response(await res.text(), {
    status: res.status,
    headers: responseHeaders,
  })
}
