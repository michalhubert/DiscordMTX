'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lock, Radio, UserX } from 'lucide-react'
import PlayerClient from './PlayerClient'

type AccessStatus =
  'checking' | 'pending' | 'approved' | 'offline' | 'denied' | 'kicked'

interface Props {
  path: string
  whepUrl: string
  isPrivate: boolean
  bypass: boolean
}

// Gates access to a private stream: polls /api/streams/[path]/access until the
// streamer approves the pending join request, then mounts the actual player.
export default function JoinGate({ path, whepUrl, isPrivate, bypass }: Props) {
  const [status, setStatus] = useState<AccessStatus>(
    isPrivate && !bypass ? 'checking' : 'approved',
  )
  const [denialInfo, setDenialInfo] = useState<{
    deniedUntil: number
    denialCount: number
  } | null>(null)
  const [kickedUntil, setKickedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isPrivate || bypass) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(
          `/api/streams/${encodeURIComponent(path)}/access`,
        )
        if (res.status === 401) {
          if (!cancelled) window.location.href = '/login'
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          if (data.status === 'approved') {
            setStatus('approved')
            setDenialInfo(null)
            setKickedUntil(null)
          } else if (data.status === 'offline') {
            setStatus('offline')
            setDenialInfo(null)
            setKickedUntil(null)
          } else if (data.status === 'denied') {
            setStatus('denied')
            setDenialInfo(data.denialInfo || null)
            setKickedUntil(null)
          } else if (data.status === 'kicked') {
            setStatus('kicked')
            setKickedUntil(
              typeof data.kickedUntil === 'number'
                ? data.kickedUntil
                : Date.now(),
            )
          } else if (data.status === 'unauthorized') {
            window.location.href = '/login'
          } else {
            setStatus('pending')
            setDenialInfo(null)
            setKickedUntil(null)
          }
        }
      } catch (err) {
        console.error('Failed to check join request status:', err)
      }
    }

    poll()
    // Poll every second while kicked/denied so the cooldown expiry (and a possible
    // stale-password redirect) is picked up right away, not up to 3s late.
    const interval = setInterval(
      poll,
      status === 'kicked' || status === 'denied' ? 1000 : 3000,
    )
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [path, isPrivate, bypass, status])

  // Tick every second so the denied/kicked countdown text actually counts down.
  // Sync `now` immediately on entering the state too, otherwise the first render
  // uses a stale mount-time value and briefly shows the wrong (too large) minutes.
  useEffect(() => {
    if (status !== 'denied' && status !== 'kicked') return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  function formatTimeRemaining(ms: number): string {
    const seconds = Math.max(Math.ceil(ms / 1000), 0)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.ceil(seconds / 60)
    return `${minutes}m`
  }

  if (status === 'offline') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Radio className="w-10 h-10 text-red-500" />
        <p className="text-lg font-medium">Stream is offline</p>
        <p className="text-sm text-gray-500">
          The streamer is not currently streaming.
        </p>
      </div>
    )
  }

  if (status === 'denied' && denialInfo) {
    const timeRemaining = denialInfo.deniedUntil - now
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Lock className="w-10 h-10 text-red-500" />
        <p className="text-lg font-medium">Access denied</p>
        <p className="text-sm text-gray-500">
          You can try again in{' '}
          <span className="text-red-400 font-semibold">
            {formatTimeRemaining(timeRemaining)}
          </span>
        </p>
      </div>
    )
  }

  if (status === 'kicked' && kickedUntil) {
    const timeRemaining = kickedUntil - now
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <UserX className="w-10 h-10 text-red-500" />
        <p className="text-lg font-medium">
          You have been kicked by the streamer
        </p>
        <p className="text-sm text-gray-500">
          You can rejoin the wait room in{' '}
          <span className="text-red-400 font-semibold">
            {formatTimeRemaining(timeRemaining)}
          </span>
        </p>
      </div>
    )
  }

  if (status !== 'approved') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Lock className="w-10 h-10 text-gray-500" />
        <p className="text-lg font-medium">
          Waiting for the streamer to let you in…
        </p>
        <p className="text-sm text-gray-500">
          This is a private stream. Hang tight.
        </p>
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    )
  }

  return <PlayerClient whepUrl={whepUrl} />
}
