import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { ponyKeyFor, rerollGuestAvatar } from '@/lib/guestIdentity'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

// Gives a viewer a different picture of their pony.
export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sessionId = new URL(req.url).searchParams.get('id')
  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 })
  }

  const identity = getViewerIdentity(sessionId)
  const ponyKey =
    identity?.ip && identity.path
      ? ponyKeyFor(identity.role, identity.name, identity.ip, identity.path)
      : null
  if (!identity?.path || !ponyKey) {
    return new Response('Viewer has no pony identity', { status: 400 })
  }

  const pony = await rerollGuestAvatar(identity.path, ponyKey)
  await refreshWatchGuest(identity.path, ponyKey)
  return Response.json({ image: pony.image })
}
