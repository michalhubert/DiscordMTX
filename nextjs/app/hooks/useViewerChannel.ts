import { useRef, useState } from 'react'
import type { WatchAccess, WatchEvent } from '@/lib/watchRoomShared'
import { useEventStream } from './useEventStream'

export type ViewerState = {
  access: WatchAccess
  online: boolean
  // A block ends at receivedAt + remainingMs.
  receivedAt: number
}

export function useViewerChannel(
  path: string,
  { gate = false, onEvent }: { gate?: boolean; onEvent?: (event: WatchEvent) => void } = {},
) {
  const [state, setState] = useState<ViewerState | null>(null)
  const connectionIdRef = useRef<string | null>(null)
  const base = `/api/watch/${encodeURIComponent(path)}`

  useEventStream<WatchEvent>(
    gate ? `${base}?mode=gate` : base,
    (event) => {
      if (event.type === 'connected') {
        connectionIdRef.current = event.connectionId
      } else if (event.type === 'state') {
        setState({ access: event.access, online: event.online, receivedAt: Date.now() })
      }
      onEvent?.(event)
    },
    // The server may notice a closed connection only much later.
    () => {
      const connectionId = connectionIdRef.current
      connectionIdRef.current = null
      if (!connectionId) return
      navigator.sendBeacon(
        `${base}/leave`,
        new Blob([JSON.stringify({ connectionId })], { type: 'application/json' }),
      )
    },
  )

  return { state, connectionIdRef }
}
