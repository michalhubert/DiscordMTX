'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import { AnimatePresence, motion } from 'motion/react'
import { VolumeX, X } from 'lucide-react'
import { useAvatarAccentDetection } from '@/lib/avatarAccent'
import { accentAlpha, accentGlassSx, glassSx } from '@/lib/theme'
import {
  REACTIONS,
  type Reaction,
  type WatchReaction,
} from '@/lib/watchRoomShared'
import { usePlayerStore } from '@/lib/playerStore'
import FloatingReactions, {
  FLOAT_DURATION_S,
  type FloatingReaction,
} from './components/FloatingReactions'
import MobileEdgePanel from './components/MobileEdgePanel'
import PlayerControls from './components/PlayerControls'
import PlayerStatusOverlay from './components/PlayerStatusOverlay'
import ReactionBar from './components/ReactionBar'
import ViewersOverlay from './components/ViewersOverlay'
import { useConnectionStats } from './hooks/useConnectionStats'
import { useFullscreen } from './hooks/useFullscreen'
import { useIsTouchDevice } from './hooks/useIsTouchDevice'
import { useWatchRoom } from './hooks/useWatchRoom'
import { useWhepPlayer } from './hooks/useWhepPlayer'

const CONTROLS_HIDE_DELAY_MS = 3000
const MAX_FLOATING_REACTIONS = 30

interface Props {
  path: string
  whepUrl: string
}

export default function PlayerClient({ path, whepUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    volume,
    muted,
    showViewers,
    setVolume,
    setMuted,
    toggleShowViewers,
  } = usePlayerStore()
  // Muted by the browser's autoplay policy rather than by the viewer.
  const [autoMuted, setAutoMuted] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const isTouchDevice = useIsTouchDevice()
  const { isFullscreen, toggleFullscreen } = useFullscreen(
    containerRef,
    videoRef,
  )

  const handleAutoMuteRequired = useCallback(() => {
    setMuted(true)
    setAutoMuted(true)
  }, [setMuted])

  // Browsers only allow sound after the viewer interacts with the page, so a
  // refresh starts muted: unmute on their first click or key press.
  useEffect(() => {
    if (!autoMuted) return
    function unmute(e: Event) {
      // M toggles mute itself.
      if (e instanceof KeyboardEvent && (e.key === 'm' || e.key === 'M')) return
      const video = videoRef.current
      setAutoMuted(false)
      if (!video) return
      video.muted = false
      setMuted(false)
      video.play().catch(() => {})
    }
    window.addEventListener('click', unmute, true)
    window.addEventListener('keydown', unmute, true)
    return () => {
      window.removeEventListener('click', unmute, true)
      window.removeEventListener('keydown', unmute, true)
    }
  }, [autoMuted, setMuted])

  const { status, peerConnectionRef } = useWhepPlayer({
    whepUrl,
    videoRef,
    onAutoMuteRequired: handleAutoMuteRequired,
  })

  const isLive = status === 'connected'
  const { stats, warnings, quality } = useConnectionStats(
    peerConnectionRef,
    isLive,
  )

  const [floating, setFloating] = useState<FloatingReaction[]>([])
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false)

  const selfIdRef = useRef<string | null>(null)
  const handleReaction = useCallback((reaction: WatchReaction) => {
    const item: FloatingReaction = {
      ...reaction,
      jitter: (Math.random() - 0.5) * 16,
      sway: 6 + Math.random() * 10,
      isSelf: reaction.from.id === selfIdRef.current,
    }
    setFloating((prev) => [...prev, item].slice(-MAX_FLOATING_REACTIONS))
    setTimeout(() => {
      setFloating((prev) => prev.filter((r) => r.id !== item.id))
    }, FLOAT_DURATION_S * 1000)
  }, [])

  const {
    viewers,
    self,
    guest,
    toggleKeep,
    rerollReadyAt,
    ponyBusy,
    rerollAvatar,
    setFavoriteTag,
    sendReaction,
    canReact,
  } = useWatchRoom(path, handleReaction)
  useEffect(() => {
    selfIdRef.current = self?.id ?? null
  }, [self])
  // Self's entry in the presence list carries the current picture after a reroll.
  const selfImage = viewers.find((v) => v.id === self?.id)?.image ?? self?.image
  useAvatarAccentDetection(selfImage)

  const react = useCallback(
    (emoji: Reaction) => {
      if (isLive) sendReaction(emoji)
    },
    [isLive, sendReaction],
  )

  // Via a ref, since these are recreated every render.
  const playbackShortcuts = useRef({
    toggleMute: () => {},
    toggleFullscreen: () => {},
  })
  useEffect(() => {
    playbackShortcuts.current = { toggleMute, toggleFullscreen }
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      const index = Number(e.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < REACTIONS.length) {
        react(REACTIONS[index])
      } else if (e.key === 'v' || e.key === 'V') {
        toggleShowViewers()
      } else if (e.key === 'm' || e.key === 'M') {
        playbackShortcuts.current.toggleMute()
      } else if (e.key === 'f' || e.key === 'F') {
        playbackShortcuts.current.toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [react, toggleShowViewers])

  const controlsHeld = useRef(false)

  const scheduleControlsHide = useCallback(() => {
    if (controlsHideTimeout.current) clearTimeout(controlsHideTimeout.current)
    if (controlsHeld.current) return
    controlsHideTimeout.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_HIDE_DELAY_MS)
  }, [])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    scheduleControlsHide()
  }, [scheduleControlsHide])

  const holdControlsVisible = useCallback(
    (hold: boolean) => {
      controlsHeld.current = hold
      if (hold) setControlsVisible(true)
      scheduleControlsHide()
    },
    [scheduleControlsHide],
  )

  function handleContainerInteraction() {
    if (isTouchDevice) return
    setControlsVisible((prev) => {
      const next = !prev
      if (next) scheduleControlsHide()
      return next
    })
  }

  useEffect(() => {
    if (isTouchDevice) {
      setControlsVisible(false)
      if (controlsHideTimeout.current) clearTimeout(controlsHideTimeout.current)
      return
    }
    scheduleControlsHide()
    return () => {
      if (controlsHideTimeout.current) clearTimeout(controlsHideTimeout.current)
    }
  }, [isTouchDevice, scheduleControlsHide])

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    setAutoMuted(false)

    if (muted) {
      setMuted(false)
      video.muted = false
      if (volume === 0) {
        setVolume(1)
        video.volume = 1
      }
      video.play().catch(() => {})
    } else {
      setMuted(true)
      video.muted = true
    }
  }

  function handleVolumeChange(next: number) {
    setAutoMuted(false)
    setVolume(next)
    setMuted(next === 0)
    if (videoRef.current) {
      videoRef.current.muted = next === 0
    }
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: 'common.black',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: !isTouchDevice && !controlsVisible ? 'none' : undefined,
      }}
      onMouseMove={showControls}
      onClick={handleContainerInteraction}
    >
      <Box
        component="video"
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />

      {isLive && <FloatingReactions reactions={floating} />}

      {isLive && (
        <Box
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            insetInline: 12,
            top: 12,
            zIndex: 20,
            display: { xs: 'flex', sm: 'grid' },
            flexDirection: 'column',
            gap: 1,
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: { sm: 'start' },
          }}
        >
          <Box sx={{ order: { xs: 2, sm: 0 }, gridColumn: 1, gridRow: 1 }}>
            <AnimatePresence>
              {showViewers && viewers.length > 0 && (
                <ViewersOverlay
                  viewers={viewers}
                  selfId={self?.id ?? null}
                  guest={guest}
                  rerollReadyAt={rerollReadyAt}
                  ponyBusy={ponyBusy}
                  onToggleKeep={toggleKeep}
                  onReroll={rerollAvatar}
                  onSetFavoriteTag={setFavoriteTag}
                  onHide={toggleShowViewers}
                />
              )}
            </AnimatePresence>
          </Box>
          <Box
            sx={{
              order: { xs: 1, sm: 0 },
              gridColumn: 2,
              gridRow: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <AnimatePresence>
              {autoMuted && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <Box
                    sx={[
                      glassSx,
                      {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        borderRadius: 5,
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        fontWeight: 500,
                      },
                    ]}
                  >
                    <VolumeX size={14} />
                    {isTouchDevice ? 'Tap' : 'Click'} anywhere to unmute
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      )}

      {/* Mobile reaction tray */}
      <AnimatePresence>
        {isLive && reactionTrayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 16,
              zIndex: 20,
              marginInline: 'auto',
              width: 'fit-content',
              maxWidth: 'calc(100% - 2rem)',
            }}
          >
            <Box
              sx={[
                accentGlassSx,
                {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  borderRadius: 4,
                  p: 0.75,
                },
              ]}
            >
              <ReactionBar
                disabled={!canReact}
                onReact={react}
                size="lg"
                sx={{
                  display: { xs: 'grid', sm: 'flex' },
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '2px',
                }}
              />
              <IconButton
                onClick={() => setReactionTrayOpen(false)}
                aria-label="Close reactions"
                sx={{
                  height: 44,
                  width: 36,
                  borderRadius: 3,
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': { bgcolor: accentAlpha(0.2), color: 'common.white' },
                }}
              >
                <X size={20} />
              </IconButton>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <PlayerStatusOverlay status={status} />

      {!isTouchDevice && (
          <PlayerControls
            visible={controlsVisible}
            onHoldVisible={holdControlsVisible}
            isLive={isLive}
            isMuted={muted}
            volume={volume}
            isFullscreen={isFullscreen}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onToggleFullscreen={toggleFullscreen}
            canReact={canReact && isLive}
            onReact={react}
            viewerCount={viewers.length}
            viewersVisible={showViewers}
            onToggleViewers={toggleShowViewers}
            quality={quality}
            stats={stats}
            warnings={warnings}
          />
      )}

      <Box sx={{ display: isTouchDevice ? 'block' : { xs: 'block', md: 'none' } }}>
        <MobileEdgePanel
          isMuted={muted}
          isFullscreen={isFullscreen}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          reactionsOpen={reactionTrayOpen}
          onToggleReactions={() => setReactionTrayOpen((open) => !open)}
          viewersVisible={showViewers}
          viewerCount={viewers.length}
          onToggleViewers={toggleShowViewers}
          quality={quality}
        />
      </Box>
    </Box>
  )
}
