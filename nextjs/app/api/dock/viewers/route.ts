import { isStreamerAuthorized } from '@/lib/authz'
import {
  getViewerIdentity,
  pruneViewerIdentities,
} from '@/lib/viewerIdentities'
import { kickViewer } from '@/lib/accessBlocks'
import { fetchWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { revokeApproval } from '@/lib/accessRequests'
import { disconnectWatchViewer } from '@/lib/watchRoom'
import { cachedGuestIdentity, ponyKeyForSession } from '@/lib/guestIdentity'
import { NextRequest } from 'next/server'

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const items = await fetchWebrtcSessions()
  if (!items) {
    return Response.json({ error: 'MediaMTX API unreachable' }, { status: 502 })
  }

  pruneViewerIdentities(items.map((item) => item.id))

  const merged = items.map((item) => {
    const identity = getViewerIdentity(item.id)
    const guest = ponyKeyForSession(identity)
    // Looked up each time: a pony can change while connected (avatar picked later, reroll).
    const pony = guest ? cachedGuestIdentity(guest.path, guest.ponyKey) : null
    return {
      ...item,
      viewerName: pony?.name ?? identity?.name ?? null,
      viewerImage: pony ? pony.image : (identity?.image ?? null),
      viewerRole: identity?.role ?? null,
      viewerIp: identity?.ip ?? null,
      viewerHasPony: !!pony,
      // The real Discord account behind a pony.
      viewerDiscordName:
        pony && identity?.role === 'discord' ? identity.name : null,
      viewerDiscordImage:
        pony && identity?.role === 'discord' ? identity.image : null,
    }
  })

  return Response.json({ items: merged })
}

export async function DELETE(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('id')

  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 })
  }

  // Block this viewer on their path for a short cooldown so, once MediaMTX drops
  // the connection below, the player's auto-reconnect loop can't just open a
  // fresh WHEP session and undo the kick.
  const identity = getViewerIdentity(sessionId)
  if (identity?.ip && identity.path) {
    kickViewer(identity.path, identity)
    revokeApproval(identity.path, identity.ip, identity.role)
    disconnectWatchViewer(identity.path, identity.ip, identity.role)
  }

  const kicked = await kickWebrtcSession(sessionId)
  if (!kicked) {
    return Response.json(
      { error: 'MediaMTX API unreachable or session not found' },
      { status: 502 },
    )
  }

  return Response.json({ ok: true })
}
