import { isStreamerAuthorized } from '@/lib/authz'
import { getViewerPassword, rotateViewerPassword } from '@/lib/db'
import { getViewerIdentity } from '@/lib/viewerIdentities'
import { listWebrtcSessions, kickWebrtcSession } from '@/lib/mediamtx'
import { clearApprovedPasswordViewers, usesPasswordOf } from '@/lib/accessRequests'
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

  // Discord viewers don't use the viewer password, so they stay connected.
  const sessions = await listWebrtcSessions()
  for (const item of sessions) {
    const identity = getViewerIdentity(item.id)
    if (identity?.role !== 'viewer' || !identity.path) continue
    if (!usesPasswordOf(identity.path, path)) continue
    await kickWebrtcSession(item.id)
  }

  clearApprovedPasswordViewers(path)

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
