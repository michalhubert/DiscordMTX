import { auth } from '@/lib/auth'
import { getPathVisibility } from '@/lib/db'
import { requestAccess } from '@/lib/accessRequests'
import { syncStreamState } from '@/lib/streamState'
import { getClientIp } from '@/lib/net'
import { blockedViewerOf, getBlock } from '@/lib/accessBlocks'
import { listPaths } from '@/lib/mediamtx'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { NextRequest } from 'next/server'

// Polled by the login page while a signed-in viewer waits to get into a stream
// (see StreamGate.tsx). Public streams and the streamer are always "approved".
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

  const ip = getClientIp(req)
  const viewer = blockedViewerOf(user, ip)

  const block = user.role !== 'streamer' && getBlock(path, viewer)
  if (block) {
    return Response.json({ status: 'blocked', ...block })
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

  if (user.role === 'streamer' || getPathVisibility(path) !== 'private') {
    return Response.json({ status: 'approved' })
  }

  const status = requestAccess(
    path,
    ip,
    user.role === 'discord' ? user.name : null,
    user.role === 'discord' ? user.image : null,
    user.role,
    viewer.discordId,
  )

  return Response.json({ status })
}
