import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { rerollGuestAvatar } from '@/lib/guestIdentity'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

// Gives a guest a different picture of their pony.
export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sessionId = new URL(req.url).searchParams.get('id')
  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 })
  }

  const identity = getViewerIdentity(sessionId)
  if (!identity?.ip || !identity.path || identity.role !== 'viewer') {
    return new Response('Not a guest viewer', { status: 400 })
  }

  const guest = await rerollGuestAvatar(identity.path, identity.ip)
  await refreshWatchGuest(identity.path, identity.ip)
  return Response.json({ image: guest.image })
}
