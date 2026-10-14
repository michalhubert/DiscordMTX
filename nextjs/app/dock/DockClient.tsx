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
import { accentAlpha } from '@/lib/theme'

type WebrtcSession = {
  id: string
  state?: string
  path?: string
  created?: string
  bytesSent?: number
  remoteAddr?: string
  viewerName?: string | null
  viewerImage?: string | null
  viewerRole?: string | null
  viewerIp?: string | null
  viewerHasPony?: boolean
  viewerDiscordName?: string | null
  viewerDiscordImage?: string | null
}

type MtxPath = {
  name: string
  ready: boolean
  readers?: unknown[]
}

type StreamEvent = {
  type: 'join' | 'leave'
  text: string
  viewer: string
  time: string
}

type Visibility = 'public' | 'private'

type PendingRequest = {
  ip: string
  path: string
  name: string | null
  image: string | null
  role?: string
  requestedAt: number
}

const MAX_EVENTS = 20

function formatBytes(bytes?: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(startTime?: string) {
  if (!startTime) return '0s'
  const start = new Date(startTime).getTime()
  const now = Date.now()
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
  const [status, setStatus] = useState<
    'checking' | 'live' | 'offline' | 'error'
  >('checking')
  const [viewerCount, setViewerCount] = useState(0)
  const [readers, setReaders] = useState<WebrtcSession[]>([])
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [viewerPassword, setViewerPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [availablePaths, setAvailablePaths] = useState<string[]>([])
  const [visibilities, setVisibilities] = useState<Record<string, Visibility>>(
    {},
  )
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [busyRequestKey, setBusyRequestKey] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>('')
  const [kickingSessionId, setKickingSessionId] = useState<string | null>(null)
  const [rerollingSessionId, setRerollingSessionId] = useState<string | null>(
    null,
  )

  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled
  const knownSessions = useRef<Map<string, string>>(new Map())
  const initialLoad = useRef(true)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const prevStatusRef = useRef<'checking' | 'live' | 'offline' | 'error'>(
    'checking',
  )

  function playChime(isJoin = true) {
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

      const now = audioCtx.currentTime
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()

      osc.type = 'sine'
      if (isJoin) {
        osc.frequency.setValueAtTime(587.33, now)
        osc.frequency.setValueAtTime(880, now + 0.1)
      } else {
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.setValueAtTime(587.33, now + 0.1)
      }

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(audioCtx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch (e) {
      console.error('Audio chime error:', e)
    }
  }

  function playStreamTone(isStart = true) {
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

      const now = audioCtx.currentTime
      const notes = isStart ? [523.25, 783.99] : [783.99, 523.25]

      notes.forEach((freq, i) => {
        const start = now + i * 0.09
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)

        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.14, start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)

        osc.connect(gain)
        gain.connect(audioCtx.destination)

        osc.start(start)
        osc.stop(start + 0.18)
      })
    } catch (e) {
      console.error('Audio tone error:', e)
    }
  }

  function logEvent(type: 'join' | 'leave', text: string, viewer: string) {
    const now = new Date()
    const timeStr = now.toTimeString().split(' ')[0]
    setEvents((prev) =>
      [{ type, text, viewer, time: timeStr }, ...prev].slice(0, MAX_EVENTS),
    )
  }

  useEffect(() => {
    let cancelled = false

    async function refreshData() {
      try {
        const [sessionsRes, pathsRes] = await Promise.allSettled([
          fetch('/api/dock/viewers'),
          fetch('/api/mediamtx/paths/list'),
        ])

        let sessions: WebrtcSession[] = []
        let paths: MtxPath[] = []
        let hasAuthError = false
        let hasApiError = false

        if (sessionsRes.status === 'fulfilled') {
          if (sessionsRes.value.ok) {
            const sData = await sessionsRes.value.json()
            sessions = sData.items || []
          } else if (
            sessionsRes.value.status === 401 ||
            sessionsRes.value.status === 403
          ) {
            hasAuthError = true
          } else {
            hasApiError = true
          }
        } else {
          hasApiError = true
        }

        if (pathsRes.status === 'fulfilled') {
          if (pathsRes.value.ok) {
            const pData = await pathsRes.value.json()
            paths = pData.items || []
          } else if (
            pathsRes.value.status === 401 ||
            pathsRes.value.status === 403
          ) {
            hasAuthError = true
          } else {
            hasApiError = true
          }
        } else {
          hasApiError = true
        }

        if (cancelled) return

        const currentReaders = sessions.filter(
          (s) =>
            s.state === 'read' ||
            (s.state !== 'publish' && s.state !== undefined),
        )
        const activePublishers = paths.filter((p) => p.ready)

        let newStatus: 'checking' | 'live' | 'offline' | 'error'
        if (hasAuthError) {
          newStatus = 'error'
        } else if (hasApiError && paths.length === 0 && sessions.length === 0) {
          newStatus = 'error'
        } else if (activePublishers.length > 0) {
          newStatus = 'live'
        } else {
          newStatus = 'offline'
        }

        if (!initialLoad.current) {
          if (newStatus === 'live' && prevStatusRef.current !== 'live') {
            playStreamTone(true)
          } else if (
            newStatus !== 'live' &&
            prevStatusRef.current === 'live'
          ) {
            playStreamTone(false)
          }
        }
        prevStatusRef.current = newStatus
        setStatus(newStatus)

        if (!cancelled) setCurrentPath(activePublishers[0]?.name ?? '')

        const totalPathReaders = paths.reduce(
          (acc, p) => acc + (p.readers ? p.readers.length : 0),
          0,
        )
        setViewerCount(Math.max(currentReaders.length, totalPathReaders))

        const currentSessions = new Map(
          currentReaders.map((r) => [r.id, r.viewerName || 'Guest']),
        )

        if (!initialLoad.current && !hasAuthError) {
          for (const reader of currentReaders) {
            if (!knownSessions.current.has(reader.id)) {
              const viewer = reader.viewerName || 'Guest'
              logEvent('join', `joined /${reader.path || 'stream'}`, viewer)
              playChime(true)
            }
          }
          for (const [oldId, oldViewer] of knownSessions.current) {
            if (!currentSessions.has(oldId)) {
              logEvent('leave', 'disconnected', oldViewer)
              playChime(false)
            }
          }
        }
        knownSessions.current = currentSessions
        initialLoad.current = false

        setReaders(currentReaders)
      } catch (err) {
        console.error('Error updating streamer HUD:', err)
        setStatus('error')
      }
    }

    refreshData()
    const interval = setInterval(refreshData, 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refreshPassword() {
      if (!currentPath) {
        setViewerPassword(null)
        return
      }
      try {
        const res = await fetch(
          `/api/dock/password?path=${encodeURIComponent(currentPath)}`,
        )
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setViewerPassword(data.password ?? null)
      } catch (err) {
        console.error('Error fetching viewer password:', err)
      }
    }

    refreshPassword()
    const interval = setInterval(refreshPassword, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [currentPath])

  useEffect(() => {
    let cancelled = false

    async function refreshPaths() {
      try {
        const [configRes, runtimeRes] = await Promise.allSettled([
          fetch('/api/mediamtx/config/paths/list'),
          fetch('/api/mediamtx/paths/list'),
        ])

        const names = new Set<string>()
        for (const res of [configRes, runtimeRes]) {
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json()
            for (const item of data.items ?? []) {
              if (item?.name) names.add(item.name as string)
            }
          }
        }

        if (!cancelled) setAvailablePaths(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to load MediaMTX path list:', err)
      }
    }

    refreshPaths()
    const interval = setInterval(refreshPaths, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refreshVisibilities() {
      try {
        const res = await fetch('/api/streams/visibility')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setVisibilities(data ?? {})
      } catch (err) {
        console.error('Failed to load stream visibility settings:', err)
      }
    }

    refreshVisibilities()
    const interval = setInterval(refreshVisibilities, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refreshPending() {
      try {
        const res = await fetch('/api/streams/pending')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPendingRequests(data.items ?? [])
      } catch (err) {
        console.error('Failed to load pending join requests:', err)
      }
    }

    refreshPending()
    const interval = setInterval(refreshPending, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function toggleVisibility(path: string) {
    const next: Visibility =
      visibilities[path] === 'private' ? 'public' : 'private'
    setBusyPath(path)
    try {
      const res = await fetch('/api/streams/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, visibility: next }),
      })
      if (res.ok) {
        setVisibilities((prev) => ({ ...prev, [path]: next }))
      }
    } catch (err) {
      console.error('Failed to update stream visibility:', err)
    } finally {
      setBusyPath(null)
    }
  }

  async function approveRequest(req: PendingRequest) {
    const requestKey = `${req.path}:${req.ip}:${req.role ?? 'guest'}`
    setBusyRequestKey(requestKey)
    try {
      const res = await fetch('/api/streams/pending/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: req.path, ip: req.ip, role: req.role }),
      })
      if (res.ok) {
        setPendingRequests((prev) =>
          prev.filter(
            (r) => `${r.path}:${r.ip}:${r.role ?? 'guest'}` !== requestKey,
          ),
        )
      }
    } catch (err) {
      console.error('Failed to approve join request:', err)
    } finally {
      setBusyRequestKey(null)
    }
  }

  async function denyRequest(req: PendingRequest) {
    const requestKey = `${req.path}:${req.ip}:${req.role ?? 'guest'}`
    setBusyRequestKey(requestKey)
    try {
      const res = await fetch('/api/streams/pending/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: req.path, ip: req.ip, role: req.role }),
      })
      if (res.ok) {
        setPendingRequests((prev) =>
          prev.filter(
            (r) => `${r.path}:${r.ip}:${r.role ?? 'guest'}` !== requestKey,
          ),
        )
      }
    } catch (err) {
      console.error('Failed to deny join request:', err)
    } finally {
      setBusyRequestKey(null)
    }
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

  async function rotatePassword() {
    if (!currentPath) return
    try {
      const res = await fetch(
        `/api/dock/password?path=${encodeURIComponent(currentPath)}`,
        { method: 'POST' },
      )
      if (!res.ok) return
      const data = await res.json()
      setViewerPassword(data.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to rotate password:', err)
    }
  }

  async function kickViewer(sessionId: string, viewerName: string) {
    setKickingSessionId(sessionId)
    try {
      const res = await fetch(
        `/api/dock/viewers?id=${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
        },
      )
      if (res.ok) {
        logEvent('leave', 'kicked by streamer', viewerName)
        setReaders((prev) => prev.filter((r) => r.id !== sessionId))
      }
    } catch (err) {
      console.error('Failed to kick viewer:', err)
    } finally {
      setKickingSessionId(null)
    }
  }

  async function rerollAvatar(sessionId: string) {
    setRerollingSessionId(sessionId)
    try {
      const res = await fetch(
        `/api/dock/viewers/avatar?id=${encodeURIComponent(sessionId)}`,
        { method: 'POST' },
      )
      if (res.ok) {
        const { image } = await res.json()
        setReaders((prev) =>
          prev.map((r) => (r.id === sessionId ? { ...r, viewerImage: image } : r)),
        )
      }
    } catch (err) {
      console.error('Failed to reroll avatar:', err)
    } finally {
      setRerollingSessionId(null)
    }
  }

  const statusLabel =
    status === 'live'
      ? 'LIVE'
      : status === 'error'
        ? 'API ERROR'
        : status === 'offline'
          ? 'OFFLINE'
          : 'Checking'

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
            disabled={!currentPath}
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
          {viewerCount}
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
                  disabled={busyPath === p}
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
            const requestKey = `${req.path}:${req.ip}:${req.role ?? 'guest'}`
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
                    onClick={() => approveRequest(req)}
                    disabled={busyRequestKey === requestKey}
                    sx={tintedButtonSx('success')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    onClick={() => denyRequest(req)}
                    disabled={busyRequestKey === requestKey}
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
            polling
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
                {r.viewerImage ? (
                  <AvatarPreview
                    image={r.viewerImage}
                    name={r.viewerName || r.viewerIp || 'Guest'}
                    sx={{ display: 'flex', flexShrink: 0, cursor: 'zoom-in' }}
                  >
                    <SmallAvatar image={r.viewerImage} fallback="G" />
                  </AvatarPreview>
                ) : (
                  <SmallAvatar image={null} fallback={r.viewerName || 'G'} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'primary.light' }}>
                    {r.viewerName || r.viewerIp || 'Guest'}
                  </Typography>
                  {r.viewerDiscordName && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: 'center', fontSize: 10, color: 'discord.light' }}
                    >
                      {r.viewerDiscordImage && (
                        <Avatar
                          src={r.viewerDiscordImage}
                          alt=""
                          slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
                          sx={{ width: 12, height: 12 }}
                        />
                      )}
                      <span>Discord: {r.viewerDiscordName}</span>
                    </Stack>
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                    {(r.viewerRole !== 'discord' || r.viewerHasPony) &&
                      r.viewerIp && <>{r.viewerIp} · </>}
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
                    <Clock size={12} /> <span>{formatDuration(r.created)}</span>
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <HardDrive size={12} /> <span>{formatBytes(r.bytesSent)}</span>
                  </Stack>
                </Stack>
                {r.viewerHasPony && (
                  <IconButton
                    size="small"
                    onClick={() => rerollAvatar(r.id)}
                    disabled={rerollingSessionId === r.id}
                    title="Give this viewer a different pony picture"
                    sx={tintedButtonSx('info')}
                  >
                    {rerollingSessionId === r.id ? (
                      <CircularProgress size={12} color="inherit" />
                    ) : (
                      <Dices size={12} />
                    )}
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={() =>
                    kickViewer(r.id, r.viewerName || r.viewerIp || 'Guest')
                  }
                  disabled={kickingSessionId === r.id}
                  title="Kick this viewer"
                  sx={tintedButtonSx('error')}
                >
                  {kickingSessionId === r.id ? (
                    <CircularProgress size={12} color="inherit" />
                  ) : (
                    <X size={12} />
                  )}
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

// Matches palette.{tone}.main in lib/theme.
const TONE_RGB: Record<Tone, string> = {
  success: '34 197 94',
  error: '239 68 68',
  warning: '245 158 11',
  info: '56 189 248',
}

function tintedChipSx(tone: Tone) {
  return {
    bgcolor: `rgb(${TONE_RGB[tone]} / 0.15)`,
    color: `${tone}.light`,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    '& .MuiChip-icon': { color: 'inherit', ml: 1 },
    '&:hover': { bgcolor: `rgb(${TONE_RGB[tone]} / 0.25)` },
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
    bgcolor: `rgb(${TONE_RGB[tone]} / 0.18)`,
    color: `${tone}.light`,
    '&:hover': { bgcolor: `rgb(${TONE_RGB[tone]} / 0.3)` },
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
        bgcolor: live ? `rgb(${TONE_RGB.success} / 0.15)` : 'rgba(255, 255, 255, 0.06)',
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
