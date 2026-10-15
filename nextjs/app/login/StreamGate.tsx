'use client'

import { signOut } from 'next-auth/react'
import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Lock, Radio, UserX } from 'lucide-react'
import { usePolling } from '@/app/hooks/usePolling'
import type { AccessBlock } from '@/lib/accessBlocks'
import LoginShell from './LoginShell'

type Gate =
  | { status: 'checking' | 'pending' | 'offline' }
  | ({ status: 'blocked' } & AccessBlock)

const blockTitles: Record<AccessBlock['reason'], string> = {
  kicked: 'You were removed by the streamer',
  denied: 'The streamer declined your request',
}

function formatTimeRemaining(ms: number): string {
  const seconds = Math.max(Math.ceil(ms / 1000), 0)
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)}m`
}

// Shown on the login page to a signed-in viewer who can't watch yet: waiting for
// approval on a private stream, blocked for a while, or the stream is offline.
export default function StreamGate({ path }: { path: string }) {
  const [gate, setGate] = useState<Gate>({ status: 'checking' })
  const [now, setNow] = useState(() => Date.now())

  usePolling(
    async (isCancelled) => {
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(path)}/access`)
        if (isCancelled()) return
        if (res.status === 401) {
          window.location.reload()
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (isCancelled()) return
        if (data.status === 'approved') {
          window.location.href = `/${path}`
        } else if (data.status === 'blocked') {
          setGate({ status: 'blocked', reason: data.reason, blockedUntil: data.blockedUntil })
        } else {
          setGate({ status: data.status === 'offline' ? 'offline' : 'pending' })
        }
      } catch (err) {
        console.error('Failed to check stream access:', err)
      }
    },
    3000,
    [path],
  )

  const isBlocked = gate.status === 'blocked'
  useEffect(() => {
    if (!isBlocked) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isBlocked])

  return (
    <LoginShell>
      {gate.status === 'checking' && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
      {gate.status === 'pending' && (
        <GateMessage
          icon={<Lock size={36} />}
          title="Waiting for the streamer to let you in…"
          footer={<CircularProgress size={20} />}
        >
          This is a private stream. Hang tight.
        </GateMessage>
      )}
      {gate.status === 'offline' && (
        <GateMessage icon={<Radio size={36} />} title="Stream is offline">
          You&apos;ll be let in once the streamer goes live.
        </GateMessage>
      )}
      {gate.status === 'blocked' && (
        <GateMessage
          icon={<UserX size={36} />}
          iconColor="error.main"
          title={blockTitles[gate.reason]}
        >
          You can try again in{' '}
          <Box component="span" sx={{ color: 'error.light', fontWeight: 600 }}>
            {formatTimeRemaining(gate.blockedUntil - now)}
          </Box>
        </GateMessage>
      )}

      <Button
        fullWidth
        size="small"
        color="inherit"
        sx={{ mt: 3, color: 'text.secondary' }}
        onClick={() => signOut({ redirect: false }).then(() => window.location.reload())}
      >
        Sign out
      </Button>
    </LoginShell>
  )
}

function GateMessage({
  icon,
  iconColor = 'text.disabled',
  title,
  footer,
  children,
}: {
  icon: ReactNode
  iconColor?: string
  title: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
      <Box sx={{ display: 'flex', color: iconColor }}>{icon}</Box>
      <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
      {footer}
    </Stack>
  )
}
