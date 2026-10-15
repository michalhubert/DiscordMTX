import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { kickViewer } from '@/lib/accessBlocks'
import { kickWebrtcSession } from '@/lib/mediamtx'
import { revokeApproval } from '@/lib/accessRequests'
import { NextRequest } from 'next/server'

export async function DELETE(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('id')

  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 })
  }

  // Otherwise the player's auto-reconnect would undo the kick.
  const identity = getViewerIdentity(sessionId)
  if (identity?.ip && identity.path) {
    kickViewer(identity.path, identity)
    revokeApproval(identity.path, identity.ip, identity.role)
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
