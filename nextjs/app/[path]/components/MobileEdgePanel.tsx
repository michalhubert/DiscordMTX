'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  Maximize,
  Minimize,
  SmilePlus,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import type { ConnectionQuality } from '../hooks/useConnectionStats'

interface Props {
  isMuted: boolean
  isFullscreen: boolean
  onToggleMute: () => void
  onToggleFullscreen: () => void
  reactionsOpen: boolean
  onToggleReactions: () => void
  viewersVisible: boolean
  viewerCount: number
  onToggleViewers: () => void
  quality: ConnectionQuality
}

const PANEL_WIDTH = 112

const tones = {
  amber: {
    button:
      'border-amber-400/20 bg-amber-500/15 text-amber-300 hover:bg-amber-500/20',
    icon: 'bg-amber-500/15',
  },
  violet: {
    button:
      'border-violet-400/20 bg-violet-500/15 text-violet-300 hover:bg-violet-500/20',
    icon: 'bg-violet-500/15',
  },
  red: {
    button: 'border-red-400/20 bg-red-500/15 text-red-300 hover:bg-red-500/20',
    icon: 'bg-red-500/15',
  },
  sky: {
    button: 'border-sky-400/20 bg-sky-500/15 text-sky-300 hover:bg-sky-500/20',
    icon: 'bg-sky-500/15',
  },
}

function PanelButton({
  label,
  active,
  tone,
  onClick,
  badge,
  children,
}: {
  label: string
  active: boolean
  tone: keyof typeof tones
  onClick: () => void
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`relative flex h-16 w-full items-center justify-center rounded-xl border transition-all active:scale-[0.96] ${
        active
          ? tones[tone].button
          : 'border-white/[0.08] bg-white/[0.06] text-white/80 hover:bg-white/10'
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          active ? tones[tone].icon : 'bg-white/[0.07]'
        }`}
      >
        {children}
      </span>
      {badge}
    </button>
  )
}

export default function MobileEdgePanel({
  isMuted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  reactionsOpen,
  onToggleReactions,
  viewersVisible,
  viewerCount,
  onToggleViewers,
  quality,
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

          {/* Connection trouble, visible while the drawer is closed */}
          {quality !== 'good' && (
            <span
              className={`absolute top-1.5 h-1.5 w-1.5 rounded-full ${
                quality === 'poor' ? 'bg-red-400' : 'bg-amber-400'
              }`}
            />
          )}
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
          <PanelButton
            label={reactionsOpen ? 'Close reactions' : 'Send a reaction'}
            active={reactionsOpen}
            tone="amber"
            onClick={() => {
              onToggleReactions()
              setIsOpen(false)
            }}
          >
            <SmilePlus className="h-5 w-5" />
          </PanelButton>

          <PanelButton
            label={viewersVisible ? 'Hide viewers' : 'Show viewers'}
            active={viewersVisible}
            tone="violet"
            onClick={onToggleViewers}
            badge={
              viewerCount > 0 && (
                <span className="absolute right-2 top-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {viewerCount}
                </span>
              )
            }
          >
            <Users className="h-5 w-5" />
          </PanelButton>

          <PanelButton
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            tone="red"
            onClick={onToggleMute}
            badge={
              <span
                className={`absolute bottom-2 h-1 w-1 rounded-full ${
                  isMuted ? 'bg-red-400' : 'bg-emerald-400'
                }`}
              />
            }
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </PanelButton>

          <PanelButton
            label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            active={isFullscreen}
            tone="sky"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </PanelButton>
        </div>
      </motion.div>
    </>
  )
}
