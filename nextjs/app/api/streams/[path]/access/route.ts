import { auth } from '@/lib/auth'
import { getPathVisibility } from '@/lib/db'
import { requestAccess, getDenialInfo } from '@/lib/accessRequests'
import { syncStreamState } from '@/lib/streamState'
import { getClientIp } from '@/lib/net'
import { getKickInfo } from '@/lib/kickedViewers'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { NextRequest } from 'next/server'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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

  // Bounce to login instead of putting them back in the pending queue once the
  // streamer rotates the password.
  if (isViewerPasswordStale(user, path)) {
    return json({ status: 'unauthorized' }, 401)
  }

  // Check if there's an active publisher for this path
  let pathInfo: { ready?: boolean; readyTime?: string } | null = null
  try {
    const host = process.env.MEDIAMTX_HOST ?? 'discordmtx'
    const apiPort = process.env.MEDIAMTX_API_PORT ?? '9997'
    const pathsRes = await fetch(`http://${host}:${apiPort}/v3/paths/list`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (pathsRes.ok) {
      const pathsData = await pathsRes.json()
      pathInfo =
        (pathsData.items || []).find((p: any) => p.name === path) || null
      syncStreamState(path, pathInfo)
      if (!pathInfo || !pathInfo.ready) {
        return json({ status: 'offline' })
      }
    }
  } catch (err) {
    console.error('Failed to check path status:', err)
  }

  const ip = getClientIp(req)

  // Just kicked - report it directly instead of falling through to requestAccess()
  if (user.role !== 'streamer') {
    const kickInfo = getKickInfo(path, ip, user.role)
    if (kickInfo) {
      return json({ status: 'kicked', kickedUntil: kickInfo.kickedUntil })
    }
  }

  if (user.role === 'streamer' || getPathVisibility(path) !== 'private') {
    return json({ status: 'approved' })
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
    return json({ status: 'denied', denialInfo })
  }

  return json({ status })
}
