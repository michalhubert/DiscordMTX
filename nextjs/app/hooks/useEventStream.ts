import { useEffect, useEffectEvent, useState } from 'react'

const MIN_RETRY_MS = 1000
const MAX_RETRY_MS = 15000

// Also retries after HTTP errors, where EventSource gives up.
export function useEventStream<T>(
  url: string,
  onEvent: (event: T) => void,
  onLeave?: () => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const handleEvent = useEffectEvent(onEvent)
  const handleLeave = useEffectEvent(() => onLeave?.())

  useEffect(() => {
    let source: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retryMs = MIN_RETRY_MS
    let left = false

    function connect() {
      left = false
      source = new EventSource(url)
      source.onopen = () => setConnected(true)
      source.onmessage = (message) => {
        retryMs = MIN_RETRY_MS
        let event: T
        try {
          event = JSON.parse(message.data)
        } catch {
          return
        }
        handleEvent(event)
      }
      source.onerror = () => {
        setConnected(false)
        if (source?.readyState !== EventSource.CLOSED) return
        source = null
        retryTimeout = setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
      }
    }

    function leave() {
      if (left) return
      left = true
      if (retryTimeout) clearTimeout(retryTimeout)
      retryTimeout = null
      source?.close()
      source = null
      setConnected(false)
      handleLeave()
    }

    // Back/forward cache restores the page without re-running effects.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted && !source) connect()
    }

    connect()
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', onPageShow)
      leave()
    }
  }, [url])

  return { connected }
}
