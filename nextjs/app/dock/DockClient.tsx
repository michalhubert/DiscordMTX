'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import type { SxProps, Theme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import {
  Bell,
  BellOff,
  Clock,
  Dices,
  Globe,
  HardDrive,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react'
import AccentPicker from '@/app/components/AccentPicker'
import AvatarPreview from '@/app/components/AvatarPreview'
import type { PendingRequest } from '@/lib/accessRequests'
import type { DockSnapshot, DockViewer } from '@/lib/dockSnapshot'
import { accentAlpha } from '@/lib/theme'
import { useEventStream } from '../hooks/useEventStream'

type StreamEvent = {
  type: 'join' | 'leave'
  text: string
  viewer: string
  time: string
}

type Visibility = 'public' | 'private'

const MAX_EVENTS = 20

type HudStatus = 'checking' | 'live' | 'offline' | 'error'

const STATUS_LABELS: Record<HudStatus, string> = {
  checking: 'Checking',
  live: 'LIVE',
  offline: 'OFFLINE',
  error: 'API ERROR',
}

function requestKeyOf(req: PendingRequest) {
  return `${req.path}:${req.ip}:${req.role}`
}

function viewerLabel(viewer: DockViewer) {
  return viewer.name || viewer.ip || 'Guest'
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(startTime: string | null, now: number) {
  if (!startTime) return '0s'
  const start = new Date(startTime).getTime()
  const diffSec = Math.max(0, Math.floor((now - start) / 1000))
  if (diffSec < 60) return `${diffSec}s`
  const mins = Math.floor(diffSec / 60)
  const secs = diffSec % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

export default function DockClient({ embedded = false }: { embedded?: boolean }) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [snapshot, setSnapshot] = useState<DockSnapshot | null>(null)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // A double-clicked deny would escalate the block.
  const [busy, setBusy] = useState<string | null>(null)

  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled
  const knownViewers = useRef<Map<string, string> | null>(null)
  // Logged as kicked, so not again as disconnected.
  const kickedViewers = useRef(new Set<string>())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const wasLiveRef = useRef<boolean | null>(null)

  function withAudio(play: (ctx: AudioContext, now: number) => void) {
    if (!soundEnabledRef.current) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )()
      }
      const audioCtx = audioCtxRef.current
      if (audioCtx.state === 'suspended') audioCtx.resume()
      play(audioCtx, audioCtx.currentTime)
    } catch (e) {
      console.error('Audio playback error:', e)
    }
  }

  function playChime(isJoin = true) {
    withAudio((ctx, now) => {
      const [first, second] = isJoin ? [587.33, 880] : [880, 587.33]
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(first, now)
      osc.frequency.setValueAtTime(second, now + 0.1)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    })
  }

  function playStreamTone(isStart = true) {
    withAudio((ctx, now) => {
      const notes = isStart ? [523.25, 783.99] : [783.99, 523.25]
      notes.forEach((freq, i) => {
        const start = now + i * 0.09
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)

        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.14, start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(start)
        osc.stop(start + 0.18)
      })
    })
  }

  function logEvent(type: 'join' | 'leave', text: string, viewer: string) {
    const now = new Date()
    const timeStr = now.toTimeString().split(' ')[0]
    setEvents((prev) =>
      [{ type, text, viewer, time: timeStr }, ...prev].slice(0, MAX_EVENTS),
    )
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  function announceChanges(next: DockSnapshot) {
    // A failed MediaMTX request isn't the stream ending or everyone leaving.
    if (!next.mediamtxReachable) return

    const isLive = next.livePaths.length > 0
    if (wasLiveRef.current !== null && isLive !== wasLiveRef.current) {
      playStreamTone(isLive)
    }
    wasLiveRef.current = isLive

    const known = knownViewers.current
    const current = new Map(next.viewers.map((v) => [v.id, viewerLabel(v)]))
    knownViewers.current = current
    if (!known) return
    for (const viewer of next.viewers) {
      if (known.has(viewer.id)) continue
      logEvent('join', `joined /${viewer.path || 'stream'}`, viewerLabel(viewer))
      playChime(true)
    }
    for (const [id, name] of known) {
      if (current.has(id) || kickedViewers.current.delete(id)) continue
      logEvent('leave', 'disconnected', name)
      playChime(false)
    }
  }

  const { connected } = useEventStream<{ type: 'snapshot'; snapshot: DockSnapshot }>(
    '/api/dock/events',
    (event) => {
      if (event.type !== 'snapshot') return
      announceChanges(event.snapshot)
      setSnapshot(event.snapshot)
      setNow(Date.now())
    },
  )

  const visibilities = snapshot?.visibility ?? {}
  const pendingRequests = snapshot?.pending ?? []
  const readers = snapshot?.viewers ?? []
  const availablePaths = snapshot?.paths ?? []
  const currentPath = snapshot?.currentPath ?? ''
  const viewerPassword = snapshot?.viewerPassword ?? null

  let status: HudStatus = 'checking'
  if (snapshot) {
    if (!connected || !snapshot.mediamtxReachable) status = 'error'
    else status = snapshot.livePaths.length > 0 ? 'live' : 'offline'
  }

  async function run(key: string, request: () => Promise<Response>) {
    setBusy(key)
    try {
      const res = await request()
      if (!res.ok) console.error(`Dock action failed: HTTP ${res.status}`)
      return res.ok
    } catch (err) {
      console.error('Dock action failed:', err)
      return false
    } finally {
      setBusy(null)
    }
  }

  function toggleVisibility(path: string) {
    const visibility: Visibility =
      visibilities[path] === 'private' ? 'public' : 'private'
    return run(`visibility:${path}`, () =>
      fetch('/api/streams/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, visibility }),
      }),
    )
  }

  function respondToRequest(req: PendingRequest, action: 'approve' | 'deny') {
    return run(`request:${requestKeyOf(req)}`, () =>
      fetch(`/api/streams/pending/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: req.path, ip: req.ip, role: req.role }),
      }),
    )
  }

  async function copyPassword() {
    if (!viewerPassword) return
    try {
      await navigator.clipboard.writeText(viewerPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy password:', err)
    }
  }

  function rotatePassword() {
    if (!currentPath) return
    return run('password', () =>
      fetch(`/api/dock/password?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
      }),
    )
  }

  async function kickViewer(viewer: DockViewer) {
    kickedViewers.current.add(viewer.id)
    const kicked = await run(`kick:${viewer.id}`, () =>
      fetch(`/api/dock/viewers?id=${encodeURIComponent(viewer.id)}`, {
        method: 'DELETE',
      }),
    )
    if (kicked) logEvent('leave', 'kicked by streamer', viewerLabel(viewer))
    else kickedViewers.current.delete(viewer.id)
  }

  function rerollAvatar(sessionId: string) {
    return run(`reroll:${sessionId}`, () =>
      fetch(`/api/dock/viewers/avatar?id=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
      }),
    )
  }

  const statusLabel = STATUS_LABELS[status]

  return (
    <Box
      sx={{
        minHeight: embedded ? undefined : '100vh',
        bgcolor: 'background.paper',
        fontSize: 13,
        lineHeight: 1.4,
        p: 1.5,
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.25,
          mb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
            DiscordMTX
          </Typography>
          <StatusPill live={status === 'live'} label={statusLabel} />
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <AccentPicker size="small" sx={{ color: 'text.secondary' }} />
          <Button
            size="small"
            variant={soundEnabled ? 'outlined' : 'contained'}
            color={soundEnabled ? 'inherit' : 'primary'}
            onClick={() => setSoundEnabled((s) => !s)}
            title="Toggle audio chime on viewer join/leave and stream start/end"
            startIcon={soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            sx={{
              fontSize: 11,
              py: 0.25,
              ...(soundEnabled && { color: 'text.secondary', borderColor: 'divider' }),
            }}
          >
            {soundEnabled ? 'Sound On' : 'Muted'}
          </Button>
        </Stack>
      </Box>

      <SectionHeader
        title={`Current Viewer Password${currentPath ? ` (/${currentPath})` : ''}`}
      />
      <Card
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 1,
          mb: 1.5,
        }}
      >
        <Typography
          noWrap
          sx={{ fontFamily: 'monospace', fontSize: 14, color: 'warning.light' }}
        >
          {!currentPath ? 'no active stream' : (viewerPassword ?? 'unavailable')}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <IconButton
            size="small"
            onClick={rotatePassword}
            disabled={!currentPath || busy === 'password'}
            title="Rotate viewer password for the currently streaming path"
            sx={smallButtonSx}
          >
            <RefreshCw size={12} />
          </IconButton>
          <Button
            size="small"
            onClick={copyPassword}
            disabled={!viewerPassword}
            title="Copy viewer password"
            sx={smallButtonSx}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
      </Card>

      <Card sx={{ px: 1.5, py: 1, mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 11 }}>
          Active Viewers
        </Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'success.main', lineHeight: 1.2 }}>
          {readers.length}
        </Typography>
      </Card>

      <SectionHeader title="Stream Access" />
      <List>
        {availablePaths.length === 0 ? (
          <EmptyRow>No paths configured</EmptyRow>
        ) : (
          availablePaths.map((p) => {
            const visibility = visibilities[p] ?? 'private'
            const isPrivate = visibility === 'private'
            return (
              <Row key={p}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: 'primary.light' }}>
                  /{p}
                </Typography>
                <Chip
                  size="small"
                  clickable
                  onClick={() => toggleVisibility(p)}
                  disabled={busy === `visibility:${p}`}
                  title="Toggle between public (anyone can join) and private (streamer approves each viewer)"
                  icon={isPrivate ? <Lock size={12} /> : <Globe size={12} />}
                  label={isPrivate ? 'Private' : 'Public'}
                  sx={tintedChipSx(isPrivate ? 'warning' : 'success')}
                />
              </Row>
            )
          })
        )}
      </List>

      <SectionHeader
        title="Pending Requests"
        extra={
          pendingRequests.length > 0 && (
            <Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: 'warning.light' }}>
              {pendingRequests.length}
            </Box>
          )
        }
      />
      <List scroll>
        {pendingRequests.length === 0 ? (
          <EmptyRow>No pending requests</EmptyRow>
        ) : (
          pendingRequests.map((req) => {
            const requestKey = requestKeyOf(req)
            return (
              <Row key={requestKey}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <SmallAvatar image={req.image} fallback={req.name || req.ip} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'primary.light' }}>
                      {req.name ?? req.ip}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                      wants to join <strong>/{req.path}</strong>
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                  <Button
                    size="small"
                    onClick={() => respondToRequest(req, 'approve')}
                    disabled={busy === `request:${requestKey}`}
                    sx={tintedButtonSx('success')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    onClick={() => respondToRequest(req, 'deny')}
                    disabled={busy === `request:${requestKey}`}
                    sx={tintedButtonSx('error')}
                  >
                    Deny
                  </Button>
                </Stack>
              </Row>
            )
          })
        )}
      </List>

      <SectionHeader
        title="Current Viewers"
        extra={
          <Box component="span" sx={{ fontSize: 10, opacity: 0.7, textTransform: 'none' }}>
            live
          </Box>
        }
      />
      <List scroll>
        {readers.length === 0 ? (
          <EmptyRow>No viewers connected</EmptyRow>
        ) : (
          readers.map((r) => (
            <Row key={r.id}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                {r.image ? (
                  <AvatarPreview
                    image={r.image}
                    name={viewerLabel(r)}
                    sx={{ display: 'flex', flexShrink: 0, cursor: 'zoom-in' }}
                  >
                    <SmallAvatar image={r.image} fallback="G" />
                  </AvatarPreview>
                ) : (
                  <SmallAvatar image={null} fallback={r.name || 'G'} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'primary.light' }}>
                    {viewerLabel(r)}
                  </Typography>
                  {r.discordName && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: 'center', fontSize: 10, color: 'discord.light' }}
                    >
                      {r.discordImage && (
                        <Avatar
                          src={r.discordImage}
                          alt=""
                          slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
                          sx={{ width: 12, height: 12 }}
                        />
                      )}
                      <span>Discord: {r.discordName}</span>
                    </Stack>
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                    {(r.role !== 'discord' || r.hasPony) &&
                      r.ip && <>{r.ip} · </>}
                    Path: <strong>{r.path || 'default'}</strong>
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                <Stack
                  spacing={0.25}
                  sx={{ alignItems: 'flex-end', fontSize: 11, color: 'text.secondary' }}
                >
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Clock size={12} /> <span>{formatDuration(r.created, now)}</span>
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <HardDrive size={12} /> <span>{formatBytes(r.bytesSent)}</span>
                  </Stack>
                </Stack>
                {r.hasPony && (
                  <IconButton
                    size="small"
                    onClick={() => rerollAvatar(r.id)}
                    disabled={busy === `reroll:${r.id}`}
                    title="Give this viewer a different pony picture"
                    sx={tintedButtonSx('info')}
                  >
                    {busy === `reroll:${r.id}` ? (
                      <CircularProgress size={12} color="inherit" />
                    ) : (
                      <Dices size={12} />
                    )}
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={() => kickViewer(r)}
                  disabled={busy === `kick:${r.id}`}
                  title="Kick this viewer"
                  sx={tintedButtonSx('error')}
                >
                  <X size={12} />
                </IconButton>
              </Stack>
            </Row>
          ))
        )}
      </List>

      <SectionHeader
        title="Recent Activity"
        extra={
          <Link
            component="button"
            onClick={() => setEvents([])}
            color="inherit"
            sx={{ fontSize: 10, textTransform: 'none' }}
          >
            Clear
          </Link>
        }
      />
      <List scroll last>
        {events.length === 0 ? (
          <EmptyRow>No recent activity</EmptyRow>
        ) : (
          events.map((e, i) => (
            <Row key={i} dense>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Box
                  component="span"
                  sx={[
                    tintedChipSx(e.type === 'join' ? 'success' : 'error'),
                    { fontSize: 10, fontWeight: 600, px: 0.75, borderRadius: 0.5 },
                  ]}
                >
                  {e.type === 'join' ? 'JOIN' : 'LEAVE'}
                </Box>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {e.viewer}
                </Box>
                <Box component="span" sx={{ fontSize: 10, color: 'text.secondary' }}>
                  {e.text}
                </Box>
              </Stack>
              <Box
                component="span"
                sx={{ fontFamily: 'monospace', fontSize: 10, color: 'text.secondary' }}
              >
                {e.time}
              </Box>
            </Row>
          ))
        )}
      </List>
    </Box>
  )
}

type Tone = 'success' | 'error' | 'warning' | 'info'

function tintedChipSx(tone: Tone) {
  return {
    bgcolor: accentAlpha(0.15, tone),
    color: `${tone}.light`,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    '& .MuiChip-icon': { color: 'inherit', ml: 1 },
    '&:hover': { bgcolor: accentAlpha(0.25, tone) },
  } as const
}

function tintedButtonSx(tone: Tone) {
  return {
    minWidth: 0,
    px: 1,
    py: 0.5,
    borderRadius: 1.5,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    bgcolor: accentAlpha(0.18, tone),
    color: `${tone}.light`,
    '&:hover': { bgcolor: accentAlpha(0.3, tone) },
    '&.Mui-disabled': { color: `${tone}.light`, opacity: 0.4 },
  } as const
}

const smallButtonSx = {
  minWidth: 0,
  px: 1,
  py: 0.5,
  borderRadius: 1.5,
  fontSize: 11,
  lineHeight: 1.4,
  color: 'text.primary',
  bgcolor: 'rgba(255, 255, 255, 0.06)',
  border: 1,
  borderColor: 'divider',
  '&:hover': { bgcolor: accentAlpha(0.3) },
} as const

function StatusPill({ live, label }: { live: boolean; label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        bgcolor: live ? accentAlpha(0.15, 'success') : 'rgba(255, 255, 255, 0.06)',
        color: live ? 'success.main' : 'text.secondary',
      }}
    >
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: 'currentColor',
          boxShadow: live ? '0 0 6px currentColor' : 'none',
        }}
      />
      {label}
    </Box>
  )
}

function SectionHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        my: 1.5,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'text.secondary',
      }}
    >
      <span>{title}</span>
      {extra}
    </Box>
  )
}

function Card({ sx, children }: { sx?: SxProps<Theme>; children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={[
        { bgcolor: 'background.default', borderRadius: 2 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Paper>
  )
}

function List({
  scroll,
  last,
  children,
}: {
  scroll?: boolean
  last?: boolean
  children: ReactNode
}) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        mb: last ? 0 : 1.5,
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        maxHeight: scroll ? 220 : undefined,
        overflowY: scroll ? 'auto' : undefined,
      }}
    >
      {children}
    </Box>
  )
}

function Row({ dense, children }: { dense?: boolean; children: ReactNode }) {
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{
        bgcolor: 'background.default',
        borderRadius: 1.5,
        px: 1.25,
        py: dense ? 0.75 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        fontSize: dense ? 11 : 12,
      }}
    >
      {children}
    </Paper>
  )
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <Box
      component="li"
      sx={{
        p: 2,
        textAlign: 'center',
        fontStyle: 'italic',
        color: 'text.secondary',
        borderRadius: 1.5,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: 'rgba(0, 0, 0, 0.2)',
      }}
    >
      {children}
    </Box>
  )
}

function SmallAvatar({
  image,
  fallback,
}: {
  image: string | null
  fallback: string
}) {
  return (
    <Avatar
      src={image ?? undefined}
      alt=""
      slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
      sx={{
        width: 24,
        height: 24,
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 600,
        bgcolor: 'rgba(255, 255, 255, 0.08)',
        color: 'text.secondary',
      }}
    >
      {fallback.charAt(0).toUpperCase()}
    </Avatar>
  )
}
