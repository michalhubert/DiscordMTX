import { isStreamerAuthorized } from '@/lib/authz'
import { NextRequest } from 'next/server'

type PendingTarget = { path: string; ip: string; role: string | undefined }

export async function parsePendingBody(
  req: NextRequest,
): Promise<PendingTarget | Response> {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { path, ip, role } = (body ?? {}) as {
    path?: unknown
    ip?: unknown
    role?: unknown
  }
  if (typeof path !== 'string' || typeof ip !== 'string' || !path || !ip) {
    return Response.json({ error: 'Missing path or ip' }, { status: 400 })
  }

  return { path, ip, role: typeof role === 'string' ? role : undefined }
}
