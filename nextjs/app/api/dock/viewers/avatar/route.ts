import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { ponyKeyForSession, rerollGuestAvatar } from '@/lib/guestIdentity'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { notifyChanged } from '@/lib/events'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sessionId = new URL(req.url).searchParams.get('id')
  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 })
  }

  const guest = ponyKeyForSession(getViewerIdentity(sessionId))
  if (!guest) {
    return new Response('Viewer has no pony identity', { status: 400 })
  }

  const pony = await rerollGuestAvatar(guest.path, guest.ponyKey)
  await refreshWatchGuest(guest.path, guest.ponyKey)
  notifyChanged(guest.path)
  return Response.json({ image: pony.image })
}
