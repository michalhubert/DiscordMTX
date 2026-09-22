'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MobileEdgePanel from './components/MobileEdgePanel'
import PlayerControls from './components/PlayerControls'
import PlayerStatusOverlay from './components/PlayerStatusOverlay'
import { useFullscreen } from './hooks/useFullscreen'
import { useIsTouchDevice } from './hooks/useIsTouchDevice'
import { useWhepPlayer } from './hooks/useWhepPlayer'

const CONTROLS_HIDE_DELAY_MS = 3000

interface Props {
  whepUrl: string
}

export default function PlayerClient({ whepUrl }: Props) {
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

  const { status } = useWhepPlayer({
    whepUrl,
    videoRef,
    onAutoMuteRequired: handleAutoMuteRequired,
  })

  const scheduleControlsHide = useCallback(() => {
    if (controlsHideTimeout.current) clearTimeout(controlsHideTimeout.current)
    controlsHideTimeout.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_HIDE_DELAY_MS)
  }, [])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    scheduleControlsHide()
  }, [scheduleControlsHide])

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
      className="relative w-full h-full bg-black overflow-hidden select-none"
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

      <PlayerStatusOverlay status={status} />

      {/* Desktop player controls */}
      {!isTouchDevice && (
        <div className="hidden sm:block">
          <PlayerControls
            visible={controlsVisible}
            isMuted={isMuted}
            volume={volume}
            isFullscreen={isFullscreen}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onToggleFullscreen={toggleFullscreen}
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
        />
      </div>
    </div>
  )
}
