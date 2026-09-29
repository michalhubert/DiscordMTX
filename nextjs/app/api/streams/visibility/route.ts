import { isStreamerAuthorized } from '@/lib/authz'
import { getAllPathVisibilities, setPathVisibility } from '@/lib/db'
import { clearApprovedViewers, clearPendingRequests } from '@/lib/accessRequests'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { disconnectAllWatchViewers } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PATH_NAME_RE = /^[A-Za-z0-9/]{1,64}$/

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  return json(getAllPathVisibilities())
}

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { path, visibility } = (body ?? {}) as {
    path?: unknown
    visibility?: unknown
  }
  if (typeof path !== 'string' || !PATH_NAME_RE.test(path)) {
    return json({ error: 'Invalid path' }, 400)
  }
  if (visibility !== 'public' && visibility !== 'private') {
    return json({ error: 'Invalid visibility' }, 400)
  }

  setPathVisibility(path, visibility)

  if (visibility === 'private') {
    clearApprovedViewers(path)
  } else {
    clearPendingRequests(path)
  }

  const sessions = await listWebrtcSessions()
  for (const item of sessions) {
    const identity = getViewerIdentity(item.id)
    if (
      (identity?.path === path || item.path === path) &&
      identity?.role !== 'streamer' &&
      item.user !== 'streamer' &&
      !item.publish
    ) {
      await kickWebrtcSession(item.id)
    }
  }

  disconnectAllWatchViewers(path)

  return json({ path, visibility })
}
