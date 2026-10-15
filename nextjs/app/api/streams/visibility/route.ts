import { isStreamerAuthorized } from '@/lib/authz'
import { setPathVisibility } from '@/lib/db'
import { clearApprovedViewers, clearPendingRequests } from '@/lib/accessRequests'
import { clearDenials } from '@/lib/accessBlocks'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { PATH_NAME_RE } from '@/lib/streamSettings'
import { notifyChanged } from '@/lib/events'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { path, visibility } = (body ?? {}) as {
    path?: unknown
    visibility?: unknown
  }
  if (typeof path !== 'string' || !PATH_NAME_RE.test(path)) {
    return Response.json({ error: 'Invalid path' }, { status: 400 })
  }
  if (visibility !== 'public' && visibility !== 'private') {
    return Response.json({ error: 'Invalid visibility' }, { status: 400 })
  }

  setPathVisibility(path, visibility)
  notifyChanged(path)

  if (visibility === 'public') {
    clearPendingRequests(path)
    clearDenials(path)
    return Response.json({ path, visibility })
  }

  // Also cuts off pages that ignore the push.
  clearApprovedViewers(path)
  const sessions = await listWebrtcSessions()
  await Promise.all(
    sessions
      .filter((item) => {
        const identity = getViewerIdentity(item.id)
        return (
          (identity?.path ?? item.path) === path &&
          identity?.role !== 'streamer' &&
          item.state !== 'publish'
        )
      })
      .map((item) => kickWebrtcSession(item.id)),
  )

  return Response.json({ path, visibility })
}
