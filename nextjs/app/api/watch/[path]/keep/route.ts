import { setGuestKeep } from '@/lib/guestIdentity'
import { authorizeGuest } from '@/lib/watchAccess'
import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const guest = await authorizeGuest(req, path)
  if (guest instanceof Response) return guest
  const { ponyKey } = guest

  const body = await req.json().catch(() => null)
  if (typeof body?.keep !== 'boolean') {
    return new Response('Expected { keep: boolean }', { status: 400 })
  }

  const identity = setGuestKeep(path, ponyKey, body.keep)
  return Response.json({ kept: identity.kept })
}
