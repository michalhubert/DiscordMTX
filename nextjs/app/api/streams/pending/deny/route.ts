import { isStreamerAuthorized } from '@/lib/authz'
import { denyAccess } from '@/lib/accessRequests'
import { NextRequest } from 'next/server'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

  const { path, ip, role } = (body ?? {}) as {
    path?: unknown
    ip?: unknown
    role?: unknown
  }
  if (typeof path !== 'string' || typeof ip !== 'string' || !path || !ip) {
    return json({ error: 'Missing path or ip' }, 400)
  }

  denyAccess(path, ip, typeof role === 'string' ? role : undefined)
  return json({ ok: true })
}
