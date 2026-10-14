'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Lock, Radio, UserX } from 'lucide-react'
import PlayerClient from './PlayerClient'

type AccessStatus =
  'checking' | 'pending' | 'approved' | 'offline' | 'denied' | 'kicked'

type Access = {
  status: AccessStatus
  denialInfo?: { deniedUntil: number; denialCount: number } | null
  kickedUntil?: number
}

interface Props {
  path: string
  whepUrl: string
  isPrivate: boolean
  bypass: boolean
}

// Gates access to a private stream: polls /api/streams/[path]/access until the
// streamer approves the pending join request, then mounts the actual player.
export default function JoinGate({ path, whepUrl, isPrivate, bypass }: Props) {
  const [access, setAccess] = useState<Access>({
    status: isPrivate && !bypass ? 'checking' : 'approved',
  })
  const { status, denialInfo, kickedUntil } = access
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
          if (data.status === 'unauthorized') {
            window.location.href = '/login'
          } else if (data.status === 'kicked') {
            setAccess({
              status: 'kicked',
              kickedUntil:
                typeof data.kickedUntil === 'number'
                  ? data.kickedUntil
                  : Date.now(),
            })
          } else if (data.status === 'denied') {
            setAccess({ status: 'denied', denialInfo: data.denialInfo || null })
          } else if (
            data.status === 'approved' ||
            data.status === 'offline'
          ) {
            setAccess({ status: data.status })
          } else {
            setAccess({ status: 'pending' })
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
      <GateMessage
        icon={<Radio size={40} />}
        iconColor="error.main"
        title="Stream is offline"
      >
        The streamer is not currently streaming.
      </GateMessage>
    )
  }

  if (status === 'denied' && denialInfo) {
    const timeRemaining = denialInfo.deniedUntil - now
    return (
      <GateMessage
        icon={<Lock size={40} />}
        iconColor="error.main"
        title="Access denied"
      >
        You can try again in{' '}
        <Countdown>{formatTimeRemaining(timeRemaining)}</Countdown>
      </GateMessage>
    )
  }

  if (status === 'kicked' && kickedUntil) {
    const timeRemaining = kickedUntil - now
    return (
      <GateMessage
        icon={<UserX size={40} />}
        iconColor="error.main"
        title="You have been kicked by the streamer"
      >
        You can rejoin the wait room in{' '}
        <Countdown>{formatTimeRemaining(timeRemaining)}</Countdown>
      </GateMessage>
    )
  }

  if (status !== 'approved') {
    return (
      <GateMessage
        icon={<Lock size={40} />}
        iconColor="text.disabled"
        title="Waiting for the streamer to let you in…"
        footer={<CircularProgress size={20} color="primary" />}
      >
        This is a private stream. Hang tight.
      </GateMessage>
    )
  }

  return <PlayerClient path={path} whepUrl={whepUrl} />
}

function GateMessage({
  icon,
  iconColor,
  title,
  footer,
  children,
}: {
  icon: ReactNode
  iconColor: string
  title: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        height: '100%',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'common.black',
        px: 2,
        textAlign: 'center',
      }}
    >
      <Box sx={{ display: 'flex', color: iconColor }}>{icon}</Box>
      <Typography variant="h6" component="p" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
      {footer}
    </Stack>
  )
}

function Countdown({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ color: 'error.light', fontWeight: 600 }}>
      {children}
    </Box>
  )
}
