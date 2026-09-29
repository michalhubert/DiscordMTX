import { useCallback, useEffect, useRef, useState } from 'react'
import {
  REACTION_RATE_LIMIT,
  type Reaction,
  type WatchEvent,
  type WatchGuest,
  type WatchReaction,
  type WatchViewer,
} from '@/lib/watchRoomShared'

const MIN_RETRY_MS = 2000
const MAX_RETRY_MS = 30000

export type PonyChangeResult =
  | { ok: true; favoriteTagMatched: boolean | null }
  | { ok: false; error: string }

export function useWatchRoom(
  path: string,
  onReaction: (reaction: WatchReaction) => void,
) {
  const [viewers, setViewers] = useState<WatchViewer[]>([])
  const [self, setSelf] = useState<WatchViewer | null>(null)
  // null for non-guests.
  const [guest, setGuest] = useState<WatchGuest | null>(null)
  // Local time when the guest may reroll (or change their favorite tag) again.
  const [rerollReadyAt, setRerollReadyAt] = useState(0)
  const [ponyBusy, setPonyBusy] = useState(false)
  const connectionIdRef = useRef<string | null>(null)
  const sentAtRef = useRef<number[]>([])
  const onReactionRef = useRef(onReaction)

  useEffect(() => {
    onReactionRef.current = onReaction
  }, [onReaction])

  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retryMs = MIN_RETRY_MS

    function connect() {
      if (cancelled) return
      source = new EventSource(`/api/watch/${encodeURIComponent(path)}`)

      source.onmessage = (message) => {
        let event: WatchEvent
        try {
          event = JSON.parse(message.data)
        } catch {
          return
        }
        retryMs = MIN_RETRY_MS
        if (event.type === 'hello') {
          connectionIdRef.current = event.connectionId
          setSelf(event.self)
          setGuest(event.guest)
          setRerollReadyAt(Date.now() + (event.guest?.rerollInMs ?? 0))
        } else if (event.type === 'presence') {
          setViewers(event.viewers)
          setSelf(
            (prev) => event.viewers.find((v) => v.id === prev?.id) ?? prev,
          )
        } else if (event.type === 'reaction') {
          onReactionRef.current(event)
        }
      }

      // EventSource gives up for good on HTTP errors (e.g. 403 while kicked).
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED) return
        connectionIdRef.current = null
        setViewers([])
        retryTimeout = setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
      source?.close()
      connectionIdRef.current = null
    }
  }, [path])

  const sendReaction = useCallback(
    (emoji: Reaction) => {
      if (!self) return

      const now = Date.now()
      const recent = sentAtRef.current.filter(
        (t) => now - t < REACTION_RATE_LIMIT.windowMs,
      )
      if (recent.length >= REACTION_RATE_LIMIT.max) return
      recent.push(now)
      sentAtRef.current = recent

      // Echo locally; the server skips this connection.
      onReactionRef.current({
        id: `local-${now}-${Math.random()}`,
        emoji,
        from: self,
        at: now,
      })

      fetch(`/api/watch/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, connectionId: connectionIdRef.current }),
      }).catch(() => {})
    },
    [path, self],
  )

  const kept = guest?.kept ?? null
  const toggleKeep = useCallback(async () => {
    if (kept === null) return
    const next = !kept
    const setKept = (value: boolean) =>
      setGuest((prev) => prev && { ...prev, kept: value })
    setKept(next)
    try {
      const res = await fetch(`/api/watch/${encodeURIComponent(path)}/keep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKept((await res.json()).kept)
    } catch {
      setKept(!next)
    }
  }, [path, kept])

  // The new picture arrives with the next presence event.
  const changePony = useCallback(
    async (
      action: 'avatar' | 'tag',
      body: object = {},
    ): Promise<PonyChangeResult> => {
      setPonyBusy(true)
      try {
        const res = await fetch(
          `/api/watch/${encodeURIComponent(path)}/${action}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        if (res.status === 429) {
          const { rerollInMs } = await res.json()
          setRerollReadyAt(Date.now() + rerollInMs)
          return { ok: false, error: 'Wait for the cooldown to end' }
        }
        if (!res.ok) {
          return {
            ok: false,
            error: (await res.text()) || `HTTP ${res.status}`,
          }
        }
        const data = await res.json()
        setRerollReadyAt(Date.now() + data.rerollInMs)
        setGuest((prev) => prev && { ...prev, favoriteTag: data.favoriteTag })
        return { ok: true, favoriteTagMatched: data.favoriteTagMatched }
      } catch {
        return { ok: false, error: 'Could not reach the server' }
      } finally {
        setPonyBusy(false)
      }
    },
    [path],
  )

  const rerollAvatar = useCallback(() => changePony('avatar'), [changePony])
  const setFavoriteTag = useCallback(
    (tag: string | null) => changePony('tag', { tag }),
    [changePony],
  )

  return {
    viewers,
    self,
    guest,
    toggleKeep,
    rerollReadyAt,
    ponyBusy,
    rerollAvatar,
    setFavoriteTag,
    sendReaction,
    canReact: self !== null,
  }
}
