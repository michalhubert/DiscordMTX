import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { type SessionUser } from '@/lib/authz'
import {
  closeAccessRequest,
  keepAccessRequest,
  openAccessRequest,
  type AccessRequester,
} from '@/lib/accessRequests'
import { affectsPath, onChanged } from '@/lib/events'
import { ponyKeyFor } from '@/lib/guestIdentity'
import { getClientIp } from '@/lib/net'
import { eventStream } from '@/lib/sse'
import {
  isStreamOnline,
  refreshStreamStates,
  watchStreamStates,
} from '@/lib/streamState'
import {
  authorizeWatch,
  viewerAccess,
  type ViewerAccess,
} from '@/lib/watchAccess'
import {
  allowReaction,
  broadcastWatchEvent,
  joinWatchRoom,
  leaveWatchRoom,
  refreshWatchGuest,
  registerWatchConnection,
  watchViewerFor,
} from '@/lib/watchRoom'
import {
  isReaction,
  type WatchAccess,
  type WatchEvent,
} from '@/lib/watchRoomShared'
import { NextRequest } from 'next/server'

// Not under /api/stream*: the middleware treats that prefix as streamer-only.

function toWatchAccess(access: ViewerAccess): WatchAccess {
  if (access.status !== 'blocked') return access
  return {
    status: 'blocked',
    reason: access.reason,
    remainingMs: Math.max(access.blockedUntil - Date.now(), 0),
  }
}

// ?mode=gate is the waiting screen; its open connection is the access request.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const session = await auth()
  if (!session?.user) return new Response(null, { status: 401 })
  const user = session.user as SessionUser
  const ip = getClientIp(req)
  const isGate = req.nextUrl.searchParams.get('mode') === 'gate'
  const requester: AccessRequester = {
    path,
    ip,
    role: user.role,
    name: user.role === 'discord' ? user.name : null,
    image: user.role === 'discord' ? user.image : null,
    discordId: user.role === 'discord' ? user.id : null,
  }

  // In case a hook was missed.
  await refreshStreamStates()

  return eventStream(req, (stream) => {
    const connectionId = randomUUID()
    const send = (event: WatchEvent) => stream.send(event)
    let closed = false
    let lastState = ''
    let requestOpen = false
    let blockTimer: ReturnType<typeof setTimeout> | undefined
    // Access can flip while a join is underway.
    let inRoom = false
    let roomToken = 0
    // Going public turns Discord viewers into ponies.
    let roomPonyKey: string | null = null
    const currentPonyKey = () => ponyKeyFor(user.role, user.name, ip, path)

    async function joinRoom() {
      inRoom = true
      roomPonyKey = currentPonyKey()
      const token = ++roomToken
      let joined
      try {
        joined = await watchViewerFor(user, ip, path)
      } catch (err) {
        console.error('Failed to join watch room:', err)
        if (token === roomToken) inRoom = false
        return
      }
      if (closed || token !== roomToken) return
      send({ type: 'hello', self: joined.viewer, guest: joined.guest })
      joinWatchRoom(path, {
        connectionId,
        viewer: joined.viewer,
        ip,
        role: user.role,
        ponyKey: joined.ponyKey,
        send,
      })
    }

    function leaveRoom() {
      if (!inRoom) return
      inRoom = false
      roomToken++
      leaveWatchRoom(path, connectionId)
    }

    function update() {
      if (closed) return
      const access = viewerAccess(user, path, ip)
      const online = isStreamOnline(path)

      const wantsRequest = isGate && access.status === 'pending' && online
      if (wantsRequest && !requestOpen) openAccessRequest(requester)
      else if (!wantsRequest && requestOpen) closeAccessRequest(requester)
      requestOpen = wantsRequest

      clearTimeout(blockTimer)
      if (access.status === 'blocked') {
        blockTimer = setTimeout(update, access.blockedUntil - Date.now() + 50)
      }

      if (!isGate) {
        if (access.status !== 'ok') leaveRoom()
        else if (!inRoom || currentPonyKey() !== roomPonyKey) void joinRoom()
      }

      // By end time; the time left always changes.
      const state = JSON.stringify({ access, online })
      if (state === lastState) return
      lastState = state
      send({ type: 'state', access: toWatchAccess(access), online })
    }

    send({ type: 'connected', connectionId })
    const unregister = registerWatchConnection(path, connectionId, stream.close)
    const stopWatchingStreams = watchStreamStates()
    const unsubscribe = onChanged((paths) => {
      if (affectsPath(paths, path)) update()
    })
    update()

    return {
      heartbeat() {
        update()
        if (requestOpen) keepAccessRequest(requester)
        if (inRoom && roomPonyKey) void refreshWatchGuest(path, roomPonyKey)
      },
      close() {
        closed = true
        clearTimeout(blockTimer)
        unsubscribe()
        stopWatchingStreams()
        unregister()
        leaveRoom()
        if (requestOpen) closeAccessRequest(requester)
      },
    }
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
