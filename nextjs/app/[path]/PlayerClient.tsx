'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import {
  REACTIONS,
  type Reaction,
  type WatchReaction,
} from '@/lib/watchRoomShared'
import ConnectionWarnings from './components/ConnectionWarnings'
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
import { useStoredToggle } from './hooks/useStoredToggle'
import { useWatchRoom } from './hooks/useWatchRoom'
import { useWhepPlayer } from './hooks/useWhepPlayer'

const CONTROLS_HIDE_DELAY_MS = 3000
const MAX_FLOATING_REACTIONS = 30
const SHOW_VIEWERS_STORAGE_KEY = 'discordmtx:showViewers'

interface Props {
  path: string
  whepUrl: string
}

export default function PlayerClient({ path, whepUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [controlsVisible, setControlsVisible] = useState(true)

  const isTouchDevice = useIsTouchDevice()
  const { isFullscreen, toggleFullscreen } = useFullscreen(
    containerRef,
    videoRef,
  )

  const handleAutoMuteRequired = useCallback(() => {
    setIsMuted(true)
  }, [])

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
  const [viewersVisible, toggleViewers] = useStoredToggle(
    SHOW_VIEWERS_STORAGE_KEY,
    true,
  )

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

  const { viewers, self, kept, toggleKeep, sendReaction, canReact } =
    useWatchRoom(path, handleReaction)
  useEffect(() => {
    selfIdRef.current = self?.id ?? null
  }, [self])

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
        toggleViewers()
      } else if (e.key === 'm' || e.key === 'M') {
        playbackShortcuts.current.toggleMute()
      } else if (e.key === 'f' || e.key === 'F') {
        playbackShortcuts.current.toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [react, toggleViewers])

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

  // Keep the bar up while the pointer rests on it.
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

    if (isMuted) {
      setIsMuted(false)
      video.muted = false
      if (volume === 0) {
        setVolume(1)
        video.volume = 1
      }
      video.play().catch(() => {})
    } else {
      setIsMuted(true)
      video.muted = true
    }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value)
    setVolume(next)
    setIsMuted(next === 0)
    if (videoRef.current) {
      videoRef.current.muted = next === 0
    }
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden select-none ${
        !isTouchDevice && !controlsVisible ? 'cursor-none' : ''
      }`}
      onMouseMove={showControls}
      onClick={handleContainerInteraction}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain"
      />

      {isLive && <FloatingReactions reactions={floating} />}

      {isLive && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-start">
          <div className="order-2 sm:col-start-1 sm:row-start-1">
            <AnimatePresence>
              {viewersVisible && viewers.length > 0 && (
                <ViewersOverlay
                  viewers={viewers}
                  selfId={self?.id ?? null}
                  selfKept={kept}
                  onToggleKeep={toggleKeep}
                  onHide={toggleViewers}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="order-1 sm:col-start-2 sm:row-start-1">
            <ConnectionWarnings warnings={warnings} stats={stats} />
          </div>
        </div>
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
            className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-1 rounded-2xl border border-white/10 bg-black/70 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <ReactionBar
              disabled={!canReact}
              onReact={react}
              size="lg"
              className="grid grid-cols-4 gap-0.5 sm:flex"
            />
            <button
              type="button"
              onClick={() => setReactionTrayOpen(false)}
              aria-label="Close reactions"
              className="flex h-11 w-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <PlayerStatusOverlay status={status} />

      {/* Desktop player controls */}
      {!isTouchDevice && (
        <div className="hidden sm:block">
          <PlayerControls
            visible={controlsVisible}
            onHoldVisible={holdControlsVisible}
            isLive={isLive}
            isMuted={isMuted}
            volume={volume}
            isFullscreen={isFullscreen}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onToggleFullscreen={toggleFullscreen}
            canReact={canReact && isLive}
            onReact={react}
            viewerCount={viewers.length}
            viewersVisible={viewersVisible}
            onToggleViewers={toggleViewers}
            quality={quality}
            stats={stats}
          />
        </div>
      )}

      {/* Mobile edge swipeable tab & panel */}
      <div className={isTouchDevice ? 'block' : 'hidden max-md:block'}>
        <MobileEdgePanel
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          reactionsOpen={reactionTrayOpen}
          onToggleReactions={() => setReactionTrayOpen((open) => !open)}
          viewersVisible={viewersVisible}
          viewerCount={viewers.length}
          onToggleViewers={toggleViewers}
          quality={quality}
        />
      </div>
    </div>
  )
}
