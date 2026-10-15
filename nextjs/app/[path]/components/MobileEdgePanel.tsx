'use client'

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import {
  ChevronLeft,
  Maximize,
  Minimize,
  Palette,
  SmilePlus,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import { AccentPickerPopover } from '@/app/components/AccentPicker'
import { accentAlpha, glassSx } from '@/lib/theme'
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
  amber: { fg: 'warning.light', tint: (o: number) => accentAlpha(o, 'warning') },
  accent: { fg: 'primary.light', tint: (o: number) => accentAlpha(o) },
  red: { fg: 'error.light', tint: (o: number) => accentAlpha(o, 'error') },
  sky: { fg: 'info.light', tint: (o: number) => accentAlpha(o, 'info') },
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
  onClick: (e: MouseEvent<HTMLElement>) => void
  badge?: ReactNode
  children: ReactNode
}) {
  const { fg, tint } = tones[tone]
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      sx={[
        {
          position: 'relative',
          height: 64,
          width: '100%',
          borderRadius: 3,
          border: 1,
          transition: 'all 150ms',
          '&:active': { transform: 'scale(0.96)' },
        },
        active
          ? {
              borderColor: tint(0.25),
              bgcolor: tint(0.15),
              color: fg,
              '&:hover': { bgcolor: tint(0.2) },
            }
          : {
              borderColor: 'rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.8)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            },
      ]}
    >
      <Box
        component="span"
        sx={{
          display: 'flex',
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          bgcolor: active ? tint(0.15) : 'rgba(255,255,255,0.07)',
        }}
      >
        {children}
      </Box>
      {badge}
    </ButtonBase>
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
  const [accentAnchor, setAccentAnchor] = useState<HTMLElement | null>(null)

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
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: 'rgba(0, 0, 0, 0.25)',
        }}
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
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          y: '-50%',
        }}
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
        <ButtonBase
          aria-label={isOpen ? 'Close controls' : 'Open controls'}
          title={isOpen ? 'Close controls' : 'Open controls'}
          sx={[
            glassSx,
            {
              position: 'relative',
              zIndex: 10,
              height: 64,
              width: 28,
              flexShrink: 0,
              borderRadius: '8px 0 0 8px',
              borderRight: 0,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              color: 'rgba(255, 255, 255, 0.6)',
              touchAction: 'none',
              transition: 'color 150ms',
              '&:hover': { color: 'common.white' },
              '&:active': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
            },
          ]}
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
            size={16}
            style={{
              transition: 'transform 200ms',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />

          {/* Connection trouble, visible while the drawer is closed */}
          {quality !== 'good' && (
            <Box
              component="span"
              sx={{
                position: 'absolute',
                top: 6,
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: quality === 'poor' ? 'error.light' : 'warning.light',
              }}
            />
          )}
        </ButtonBase>

        <Box
          sx={[
            glassSx,
            {
              display: 'flex',
              width: PANEL_WIDTH,
              flexShrink: 0,
              flexDirection: 'column',
              gap: 1,
              borderRadius: '16px 0 0 16px',
              borderColor: accentAlpha(0.35),
              bgcolor: 'rgba(0, 0, 0, 0.75)',
              p: 1,
              backdropFilter: 'blur(40px)',
            },
          ]}
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
            <SmilePlus size={20} />
          </PanelButton>

          <PanelButton
            label={viewersVisible ? 'Hide viewers' : 'Show viewers'}
            active={viewersVisible}
            tone="accent"
            onClick={onToggleViewers}
            badge={
              viewerCount > 0 && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    minWidth: 16,
                    borderRadius: 4,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 0.5,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: '16px',
                  }}
                >
                  {viewerCount}
                </Box>
              )
            }
          >
            <Users size={20} />
          </PanelButton>

          <PanelButton
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            tone="red"
            onClick={onToggleMute}
            badge={
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: isMuted ? 'error.light' : 'success.light',
                }}
              />
            }
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </PanelButton>

          <PanelButton
            label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            active={isFullscreen}
            tone="sky"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </PanelButton>

          <PanelButton
            label="Accent colour"
            active={!!accentAnchor}
            tone="accent"
            onClick={(e) => setAccentAnchor(e.currentTarget)}
          >
            <Palette size={20} />
          </PanelButton>
        </Box>
      </motion.div>

      <AccentPickerPopover
        anchorEl={accentAnchor}
        onClose={() => setAccentAnchor(null)}
      />
    </>
  )
}
