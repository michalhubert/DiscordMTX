import { isStreamerAuthorized } from '@/lib/authz'
import { setPathVisibility } from '@/lib/db'
import {
  approvalKey,
  approveAccess,
  clearApprovedViewers,
  clearPendingRequests,
} from '@/lib/accessRequests'
import { clearDenials, kickViewer } from '@/lib/accessBlocks'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { PATH_NAME_RE } from '@/lib/streamSettings'
import { notifyChanged } from '@/lib/events'
import { NextRequest } from 'next/server'

// What happens to people already watching when a stream goes private.
const VIEWER_ACTIONS = ['approve', 'reapprove', 'kick'] as const
type ViewerAction = (typeof VIEWER_ACTIONS)[number]

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

  const {
    path,
    visibility,
    viewers = 'reapprove',
  } = (body ?? {}) as {
    path?: unknown
    visibility?: unknown
    viewers?: unknown
  }
  if (typeof path !== 'string' || !PATH_NAME_RE.test(path)) {
    return Response.json({ error: 'Invalid path' }, { status: 400 })
  }
  if (visibility !== 'public' && visibility !== 'private') {
    return Response.json({ error: 'Invalid visibility' }, { status: 400 })
  }
  if (!VIEWER_ACTIONS.includes(viewers as ViewerAction)) {
    return Response.json({ error: 'Invalid viewers action' }, { status: 400 })
  }

  if (visibility === 'public') {
    setPathVisibility(path, visibility)
    notifyChanged(path)
    clearPendingRequests(path)
    clearDenials(path)
    return Response.json({ path, visibility })
  }

  clearApprovedViewers(path)
  const watching = (await listWebrtcSessions())
    .map((item) => ({ item, identity: getViewerIdentity(item.id) }))
    .filter(
      ({ item, identity }) =>
        (identity?.path ?? item.path) === path &&
        identity?.role !== 'streamer' &&
        item.state !== 'publish',
    )

  // Approved before the switch is pushed, so their players never see the waiting screen.
  if (viewers === 'approve') {
    for (const { identity } of watching) {
      if (!identity?.ip) continue
      approveAccess(path, approvalKey(identity.role, identity.ip, identity.discordId), identity.role)
    }
  }

  setPathVisibility(path, visibility)
  notifyChanged(path)
  if (viewers === 'approve') return Response.json({ path, visibility })

  // Also cuts off pages that ignore the push.
  await Promise.all(
    watching.map(({ item, identity }) => {
      if (viewers === 'kick' && identity?.ip) kickViewer(path, identity)
      return kickWebrtcSession(item.id)
    }),
  )

  return Response.json({ path, visibility })
}
