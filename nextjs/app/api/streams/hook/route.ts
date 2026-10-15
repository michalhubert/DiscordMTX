import { syncStreamState } from '@/lib/streamState'
import { notifyChanged } from '@/lib/events'
import { syncDiscordWebhookMessage } from '@/lib/discordWebhook'
import { timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

function hasHookSecret(req: NextRequest): boolean {
  const expected = process.env.HOOK_SECRET
  const given = req.headers.get('x-hook-secret')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!hasHookSecret(req)) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const body = await req.json()
    const { path, action } = body || {}
    if (path && typeof path === 'string') {
      if (action === 'ready' || action === 'online') {
        syncStreamState(path, {
          ready: true,
          readyTime: new Date().toISOString(),
        })
        await syncDiscordWebhookMessage(path, true)
      } else if (action === 'notReady' || action === 'offline') {
        syncStreamState(path, { ready: false })
        await syncDiscordWebhookMessage(path, false)
      } else if (action === 'read' || action === 'unread') {
        notifyChanged(path)
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
