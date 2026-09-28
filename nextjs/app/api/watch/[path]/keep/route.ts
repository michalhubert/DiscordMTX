import { setGuestKeep } from '@/lib/guestIdentity'
import { authorizeWatch } from '@/lib/watchAccess'
import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const result = await authorizeWatch(req, path)
  if (!result.user) return new Response(null, { status: result.error })
  if (result.user.role !== 'viewer') {
    return new Response('Only guests have a pony identity', { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.keep !== 'boolean') {
    return new Response('Expected { keep: boolean }', { status: 400 })
  }

  const identity = setGuestKeep(path, result.ip, body.keep)
  return Response.json({ kept: identity.kept })
}
