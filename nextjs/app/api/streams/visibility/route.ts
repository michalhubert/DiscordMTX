import { isStreamerAuthorized } from '@/lib/authz'
import { getAllPathVisibilities, setPathVisibility } from '@/lib/db'
import { clearApprovedViewers, clearPendingRequests } from '@/lib/accessRequests'
import { clearDenials } from '@/lib/accessBlocks'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { disconnectAllWatchViewers } from '@/lib/watchRoom'
import { PATH_NAME_RE } from '@/lib/streamSettings'
import { NextRequest } from 'next/server'

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  return Response.json(getAllPathVisibilities())
}

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

  if (visibility === 'private') {
    clearApprovedViewers(path)
  } else {
    clearPendingRequests(path)
    clearDenials(path)
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

  return Response.json({ path, visibility })
}
