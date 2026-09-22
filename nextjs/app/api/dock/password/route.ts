import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerPassword, rotateViewerPassword } from '@/lib/db'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { kickViewerIp } from '@/lib/kickedViewers'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { clearApprovedPasswordViewers } from '@/lib/accessRequests'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path') || 'default'
  const password = getViewerPassword(path)

  return new Response(JSON.stringify({ password }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path') || 'default'
  const newPassword = rotateViewerPassword(path)

  // The old password is now invalid. Drop live WebRTC sessions for viewer-password users
  // affected by this rotation - that's viewers on this exact path, plus (when rotating the
  // "default" password) viewers on any other path that has no override of its own and
  // therefore was relying on the default password too. Discord OAuth viewers are NOT
  // affected because they do not authenticate using the viewer password.
  const sessions = await listWebrtcSessions()
  for (const item of sessions) {
    const identity = getViewerIdentity(item.id)
    if (identity?.role !== 'viewer' || !identity.path) continue
    const affected =
      identity.path === path ||
      (path === 'default' && !getViewerPassword(identity.path))
    if (!affected) continue
    if (identity.ip) kickViewerIp(identity.path, identity.ip, identity.role)
    await kickWebrtcSession(item.id)
  }

  // Clear password viewers' approvals for this rotation (including paths that fall back to
  // it). Discord users remain approved and continue watching!
  clearApprovedPasswordViewers(path)

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
