import { syncStreamState } from '@/lib/streamState'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { path, action } = body || {}
    if (path && typeof path === 'string') {
      if (action === 'ready' || action === 'online') {
        syncStreamState(path, {
          ready: true,
          readyTime: new Date().toISOString(),
        })
      } else if (action === 'notReady' || action === 'offline') {
        syncStreamState(path, { ready: false })
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
