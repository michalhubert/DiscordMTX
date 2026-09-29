import { randomUUID } from 'crypto'
import { authorizeWatch, watchAccessDenied } from '@/lib/watchAccess'
import {
  allowReaction,
  broadcastWatchEvent,
  joinWatchRoom,
  leaveWatchRoom,
  refreshWatchGuest,
  watchViewerFor,
} from '@/lib/watchRoom'
import { isReaction, type WatchEvent } from '@/lib/watchRoomShared'
import { NextRequest } from 'next/server'

// Not under /api/stream*: the middleware treats that prefix as streamer-only.

const HEARTBEAT_MS = 15_000

// SSE stream of presence updates and reactions.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const result = await authorizeWatch(req, path)
  if (!result.user) return new Response(null, { status: result.error })
  const { user, ip } = result

  const { viewer, guest, ponyKey } = await watchViewerFor(user, ip, path)
  const connectionId = randomUUID()
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let heartbeat: ReturnType<typeof setInterval> | undefined

      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      const send = (event: WatchEvent) =>
        write(`data: ${JSON.stringify(event)}\n\n`)

      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        req.signal.removeEventListener('abort', cleanup)
        leaveWatchRoom(path, connectionId)
        try {
          controller.close()
        } catch {
          // Already closed by the client.
        }
      }

      // Padding: Safari and some proxies buffer the first ~1KB.
      write(`:${' '.repeat(2048)}\n\nretry: 3000\n\n`)
      send({ type: 'hello', connectionId, self: viewer, guest })
      joinWatchRoom(path, {
        connectionId,
        viewer,
        ip,
        role: user.role,
        ponyKey,
        send,
        close: cleanup,
      })

      // Keeps proxies from idling out, drops viewers who lost access, and picks
      // up a guest's new identity on a new stream.
      heartbeat = setInterval(() => {
        if (watchAccessDenied(user, path, ip)) return cleanup()
        write(': ping\n\n')
        if (ponyKey) void refreshWatchGuest(path, ponyKey)
      }, HEARTBEAT_MS)

      req.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// Broadcasts a reaction, skipping the sender's connection (it echoes locally).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const result = await authorizeWatch(req, path)
  if (!result.user) return new Response(null, { status: result.error })
  const { user, ip } = result

  const body = await req.json().catch(() => null)
  const emoji = body?.emoji
  if (!isReaction(emoji)) {
    return new Response('Unknown reaction', { status: 400 })
  }

  const { viewer } = await watchViewerFor(user, ip, path, {
    waitForAvatar: false,
  })
  if (!allowReaction(viewer.id)) {
    return new Response('Too many reactions', { status: 429 })
  }

  const connectionId =
    typeof body?.connectionId === 'string' ? body.connectionId : undefined
  broadcastWatchEvent(
    path,
    { type: 'reaction', id: randomUUID(), emoji, from: viewer, at: Date.now() },
    connectionId,
  )
  return new Response(null, { status: 204 })
}
