import { auth } from '@/lib/auth'
import { type SessionUser } from '@/lib/authz'
import { kickWebrtcSession } from '@/lib/mediamtx'
import { getClientIp } from '@/lib/net'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { NextRequest } from 'next/server'

// A closed tab doesn't tell MediaMTX. Only ends the caller's own session.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const session = await auth()
  if (!session?.user) return new Response(null, { status: 401 })
  const user = session.user as SessionUser

  const { path } = await params
  const body = await req.json().catch(() => null)
  const sessionId = body?.sessionId
  if (typeof sessionId !== 'string') {
    return new Response('Expected { sessionId: string }', { status: 400 })
  }

  const identity = getViewerIdentity(sessionId)
  const isOwn =
    !!identity &&
    identity.path === path &&
    identity.role === user.role &&
    identity.ip === getClientIp(req) &&
    (user.role !== 'discord' || identity.discordId === user.id)
  if (isOwn) await kickWebrtcSession(sessionId)
  return new Response(null, { status: 204 })
}
