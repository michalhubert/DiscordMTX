import { auth } from '@/lib/auth'
import { getPathVisibility } from '@/lib/db'
import { requestAccess, getDenialInfo } from '@/lib/accessRequests'
import { syncStreamState } from '@/lib/streamState'
import { getClientIp } from '@/lib/net'
import { getKickInfo } from '@/lib/kickedViewers'
import { listPaths } from '@/lib/mediamtx'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { NextRequest } from 'next/server'

// Polled by viewers of a private stream while they wait in the pending queue
// (see JoinGate.tsx). Public streams and the streamer themself are always "approved".
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { path } = await params
  const user = session.user as SessionUser

  if (isViewerPasswordStale(user, path)) {
    return Response.json({ status: 'unauthorized' }, { status: 401 })
  }

  const paths = await listPaths()
  if (paths) {
    const pathInfo = paths.find((p) => p.name === path) ?? null
    syncStreamState(path, pathInfo)
    if (!pathInfo?.ready) {
      return Response.json({ status: 'offline' })
    }
  } else {
    console.error('Failed to check path status')
  }

  const ip = getClientIp(req)

  if (user.role !== 'streamer') {
    const kickInfo = getKickInfo(path, ip, user.role)
    if (kickInfo) {
      return Response.json({ status: 'kicked', kickedUntil: kickInfo.kickedUntil })
    }
  }

  if (user.role === 'streamer' || getPathVisibility(path) !== 'private') {
    return Response.json({ status: 'approved' })
  }

  const status = requestAccess(
    path,
    ip,
    user.role === 'discord' ? user.name : null,
    user.role === 'discord' ? user.image : null,
    user.role,
  )

  if (status === 'denied') {
    const denialInfo = getDenialInfo(path, ip)
    return Response.json({ status: 'denied', denialInfo })
  }

  return Response.json({ status })
}
