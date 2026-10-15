import { closeWatchConnection } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const body = await req.json().catch(() => null)
  if (typeof body?.connectionId !== 'string') {
    return new Response('Expected { connectionId: string }', { status: 400 })
  }
  closeWatchConnection(path, body.connectionId)
  return new Response(null, { status: 204 })
}
