import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { waitForIceGathering } from '@/lib/webrtc'

export type PlayerStatus =
  'connecting' | 'connected' | 'offline' | 'error'

interface UseWhepPlayerOptions {
  whepUrl: string
  videoRef: RefObject<HTMLVideoElement | null>
  online: boolean | null
  onAutoMuteRequired?: () => void
  onDenied: () => void
}

const RETRY_MIN_MS = 500
const RETRY_MAX_MS = 5000
// While offline (a fallback for a missed online push), and after errors that
// retrying soon won't fix.
const SLOW_RETRY_MS = 15000
// "disconnected" often recovers by itself.
const DISCONNECT_GRACE_MS = 2500

export function useWhepPlayer({
  whepUrl,
  videoRef,
  online,
  onAutoMuteRequired,
  onDenied,
}: UseWhepPlayerOptions) {
  const [status, setStatus] = useState<PlayerStatus>('connecting')
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const onlineRef = useRef(online)
  const controlsRef = useRef<{ connectNow: () => void; goOffline: () => void } | null>(null)
  const handleAutoMute = useEffectEvent(() => onAutoMuteRequired?.())
  const handleDenied = useEffectEvent(() => onDenied())

  useEffect(() => {
    let cancelled = false
    let attempt = 0
    let failures = 0
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let graceTimeout: ReturnType<typeof setTimeout> | null = null

    function clearTimers() {
      if (retryTimeout) clearTimeout(retryTimeout)
      if (graceTimeout) clearTimeout(graceTimeout)
      retryTimeout = graceTimeout = null
    }

    function closeConnection() {
      attempt++
      clearTimers()
      pcRef.current?.close()
      pcRef.current = null
      // Closing doesn't reliably reach MediaMTX; a failed attempt would linger.
      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      if (sessionId) {
        navigator.sendBeacon(
          `${whepUrl}/leave`,
          new Blob([JSON.stringify({ sessionId })], { type: 'application/json' }),
        )
      }
    }

    function retryLater(slow = false) {
      clearTimers()
      const delay =
        slow || onlineRef.current === false
          ? SLOW_RETRY_MS
          : Math.min(RETRY_MIN_MS * 2 ** failures++, RETRY_MAX_MS)
      retryTimeout = setTimeout(connect, delay)
    }

    async function connect() {
      if (cancelled) return
      closeConnection()
      const current = attempt
      const isStale = () => cancelled || current !== attempt
      setStatus((prev) => (prev === 'connected' ? prev : 'connecting'))

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        pcRef.current = pc

        pc.ontrack = (event) => {
          if (isStale()) return
          const video = videoRef.current
          if (video && event.streams[0]) {
            video.srcObject = event.streams[0]
            video.play().catch(() => {
              if (isStale()) return
              video.muted = true
              handleAutoMute()
              video.play().catch(() => {})
            })
          }
        }

        pc.onconnectionstatechange = () => {
          if (isStale()) return
          const state = pc.connectionState
          if (state === 'connected') {
            failures = 0
            if (graceTimeout) clearTimeout(graceTimeout)
            graceTimeout = null
            setStatus('connected')
          } else if (state === 'disconnected') {
            graceTimeout ??= setTimeout(() => {
              graceTimeout = null
              if (isStale() || pc.connectionState === 'connected') return
              setStatus(onlineRef.current === false ? 'offline' : 'error')
              retryLater()
            }, DISCONNECT_GRACE_MS)
          } else if (state === 'failed') {
            setStatus(onlineRef.current === false ? 'offline' : 'error')
            retryLater()
          }
        }

        pc.addTransceiver('video', { direction: 'recvonly' })
        pc.addTransceiver('audio', { direction: 'recvonly' })

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGathering(pc)
        if (isStale()) return

        const res = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp ?? offer.sdp,
        })
        if (isStale()) return

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            handleDenied()
            return
          }
          const offline = res.status === 404 || res.status === 503
          if (!offline) console.error(`Playback refused (HTTP ${res.status}):`, await res.text())
          setStatus(offline ? 'offline' : 'error')
          closeConnection()
          retryLater(!offline && res.status < 500)
          return
        }

        sessionIdRef.current =
          res.headers.get('id') ||
          res.headers.get('location')?.split('/').filter(Boolean).pop() ||
          null
        const sdpAnswer = await res.text()
        if (isStale()) return
        await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer })
        if (!isStale() && pc.connectionState === 'connected') {
          setStatus('connected')
        }
      } catch (err) {
        if (!isStale()) {
          console.error('Playback failed:', err)
          setStatus('error')
          closeConnection()
          retryLater()
        }
      }
    }

    controlsRef.current = {
      connectNow() {
        const state = pcRef.current?.connectionState
        if (state && state !== 'failed' && state !== 'closed') return
        failures = 0
        void connect()
      },
      goOffline() {
        closeConnection()
        const video = videoRef.current
        if (video) video.srcObject = null
        setStatus('offline')
        retryLater()
      },
    }

    const onPageHide = () => closeConnection()

    // Back/forward cache restores the page without re-running effects.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) controlsRef.current?.connectNow()
    }

    void connect()
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      controlsRef.current = null
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      closeConnection()
    }
  }, [whepUrl, videoRef])

  useEffect(() => {
    onlineRef.current = online
    if (online === true) controlsRef.current?.connectNow()
    else if (online === false) controlsRef.current?.goOffline()
  }, [online])

  return { status, peerConnectionRef: pcRef }
}
