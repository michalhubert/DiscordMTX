'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react'
import { motion, useDragControls } from 'motion/react'

interface Props {
  isMuted: boolean
  isFullscreen: boolean
  onToggleMute: () => void
  onToggleFullscreen: () => void
}

const PANEL_WIDTH = 112

export default function MobileEdgePanel({
  isMuted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const dragControls = useDragControls()
  const didDrag = useRef(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 z-20 bg-black/25"
        initial={false}
        animate={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        transition={{ duration: 0.18 }}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <motion.div
        className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 items-center"
        initial={false}
        animate={{ x: isOpen ? 0 : PANEL_WIDTH }}
        transition={{
          type: 'spring',
          stiffness: 450,
          damping: 36,
          mass: 0.7,
        }}
        drag="x"
        dragConstraints={{
          left: 0,
          right: PANEL_WIDTH,
        }}
        dragElastic={0.04}
        dragMomentum={false}
        dragDirectionLock
        dragControls={dragControls}
        dragListener={false}
        onDragStart={() => {
          didDrag.current = true
        }}
        onDragEnd={(_, info) => {
          const startX = isOpen ? 0 : PANEL_WIDTH

          const currentX = Math.max(
            0,
            Math.min(PANEL_WIDTH, startX + info.offset.x),
          )

          if (info.velocity.x < -450) {
            setIsOpen(true)
          } else if (info.velocity.x > 450) {
            setIsOpen(false)
          } else {
            setIsOpen(currentX < PANEL_WIDTH * 0.5)
          }

          // Let the click event fire, then ignore it.
          requestAnimationFrame(() => {
            didDrag.current = false
          })
        }}
      >
        {/* Handle */}
        <button
          type="button"
          aria-label={isOpen ? 'Close controls' : 'Open controls'}
          title={isOpen ? 'Close controls' : 'Open controls'}
          className="
            relative z-10
            flex h-16 w-7 shrink-0
            items-center justify-center
            rounded-l-lg
            border border-r-0 border-white/10
            bg-black/70
            text-white/60
            shadow-xl
            backdrop-blur-xl
            transition-colors
            hover:text-white
            active:bg-black/80
          "
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => {
            didDrag.current = false

            dragControls.start(event, {
              distanceThreshold: 6,
            })
          }}
          onClick={() => {
            if (didDrag.current) return
            setIsOpen((value) => !value)
          }}
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Panel */}
        <div
          className="
            flex w-28 shrink-0 flex-col
            gap-2
            rounded-l-2xl
            border border-white/[0.08]
            bg-black/75
            p-2
            shadow-2xl
            backdrop-blur-2xl
          "
        >
          {/* Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={`
              relative
              flex h-16 w-full
              items-center justify-center
              rounded-xl
              border
              transition-all
              active:scale-[0.96]
              ${
                isMuted
                  ? 'border-red-400/20 bg-red-500/15 text-red-300 hover:bg-red-500/20'
                  : 'border-white/[0.08] bg-white/[0.06] text-white/80 hover:bg-white/10'
              }
            `}
          >
            <span
              className={`
                flex h-10 w-10 items-center justify-center rounded-lg
                ${isMuted ? 'bg-red-500/15' : 'bg-white/[0.07]'}
              `}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </span>

            {/* tiny state indicator */}
            <span
              className={`
                absolute bottom-2 h-1 w-1 rounded-full
                ${isMuted ? 'bg-red-400' : 'bg-emerald-400'}
              `}
            />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className={`
              relative
              flex h-16 w-full
              items-center justify-center
              rounded-xl
              border
              transition-all
              active:scale-[0.96]
              ${
                isFullscreen
                  ? 'border-sky-400/20 bg-sky-500/15 text-sky-300 hover:bg-sky-500/20'
                  : 'border-white/[0.08] bg-white/[0.06] text-white/80 hover:bg-white/10'
              }
            `}
          >
            <span
              className={`
                flex h-10 w-10 items-center justify-center rounded-lg
                ${isFullscreen ? 'bg-sky-500/15' : 'bg-white/[0.07]'}
              `}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </span>
          </button>
        </div>
      </motion.div>
    </>
  )
}
