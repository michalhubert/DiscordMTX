import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Slider from '@mui/material/Slider'
import { keyframes } from '@mui/material/styles'
import {
  Maximize,
  Minimize,
  Users,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import AccentPicker from '@/app/components/AccentPicker'
import { accentAlpha } from '@/lib/theme'
import type { Reaction } from '@/lib/watchRoomShared'
import type {
  ConnectionQuality,
  ConnectionStats,
  ConnectionWarning,
} from '../hooks/useConnectionStats'
import ConnectionIndicator from './ConnectionIndicator'
import ControlTooltip from './ControlTooltip'
import ReactionBar from './ReactionBar'

const pulse = keyframes`
  50% { opacity: 0.4; }
`

interface Props {
  visible: boolean
  onHoldVisible: (hold: boolean) => void
  isLive: boolean
  isMuted: boolean
  volume: number
  isFullscreen: boolean
  onToggleMute: () => void
  onVolumeChange: (volume: number) => void
  onToggleFullscreen: () => void
  canReact: boolean
  onReact: (emoji: Reaction) => void
  viewerCount: number
  viewersVisible: boolean
  onToggleViewers: () => void
  quality: ConnectionQuality
  stats: ConnectionStats | null
  warnings: ConnectionWarning[]
}

const controlButtonSx = {
  height: 40,
  minWidth: 40,
  gap: 1,
  px: 1.25,
  borderRadius: 5,
  color: 'rgba(255,255,255,0.9)',
  transition: 'background-color 150ms, transform 150ms',
  '&:hover, &.Mui-focusVisible': {
    bgcolor: accentAlpha(0.2),
    color: 'common.white',
  },
  '&:active': { transform: 'scale(0.95)' },
  '&[aria-pressed="true"]': {
    bgcolor: accentAlpha(0.3),
    color: 'primary.light',
  },
}

function ControlButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void
  label: string
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      sx={controlButtonSx}
    >
      {children}
    </ButtonBase>
  )
}

export default function PlayerControls({
  visible,
  onHoldVisible,
  isLive,
  isMuted,
  volume,
  isFullscreen,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  canReact,
  onReact,
  viewerCount,
  viewersVisible,
  onToggleViewers,
  quality,
  stats,
  warnings,
}: Props) {
  const level = isMuted ? 0 : volume
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        insetInline: 0,
        bottom: 0,
        zIndex: 20,
        display: { xs: 'none', sm: 'block' },
        background:
          'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 50%, transparent)',
        px: 2,
        pb: 2,
        pt: 10,
        transition: 'opacity 300ms',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? undefined : 'none',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 2,
        }}
        onPointerEnter={() => onHoldVisible(true)}
        onPointerLeave={() => onHoldVisible(false)}
      >
        <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 0.5 }}>
          <Box
            component="span"
            sx={{
              mr: 1,
              display: 'flex',
              height: 24,
              alignItems: 'center',
              gap: 0.75,
              borderRadius: 1,
              px: 1,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              bgcolor: isLive ? 'error.dark' : 'rgba(255,255,255,0.15)',
              color: isLive ? 'common.white' : 'rgba(255,255,255,0.6)',
            }}
          >
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'common.white',
                opacity: isLive ? 1 : 0.6,
                animation: isLive ? `${pulse} 2s ease-in-out infinite` : 'none',
              }}
            />
            {isLive ? 'Live' : 'Offline'}
          </Box>

          <ControlTooltip
            label={viewersVisible ? 'Hide viewers' : 'Show viewers'}
            shortcut="V"
          >
            <ControlButton
              onClick={onToggleViewers}
              label={`${viewerCount} watching - ${viewersVisible ? 'hide' : 'show'} viewer list`}
              pressed={viewersVisible}
            >
              <Users size={20} />
              <Box
                component="span"
                sx={{
                  minWidth: '2ch',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {viewerCount > 0 ? viewerCount : '–'}
              </Box>
            </ControlButton>
          </ControlTooltip>

          <ConnectionIndicator quality={quality} stats={stats} warnings={warnings} />
        </Box>

        <Box
          sx={{
            borderRadius: 6,
            bgcolor: accentAlpha(0.12),
            p: 0.5,
            boxShadow: `0 0 0 1px ${accentAlpha(0.35)}, 0 8px 24px rgba(0,0,0,0.3)`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <ReactionBar disabled={!canReact} onReact={onReact} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              '&:hover .volume-slider, &:focus-within .volume-slider': {
                width: 96,
              },
            }}
          >
            <ControlTooltip label={isMuted ? 'Unmute' : 'Mute'} shortcut="M">
              <ControlButton
                onClick={onToggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon size={20} />
              </ControlButton>
            </ControlTooltip>
            <Box
              className="volume-slider"
              sx={{
                display: 'flex',
                height: 40,
                width: 0,
                alignItems: 'center',
                overflow: 'hidden',
                transition: 'width 200ms ease-out',
              }}
            >
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.01}
                value={level}
                onChange={(_, value) => onVolumeChange(value as number)}
                aria-label="Volume"
                sx={{
                  mx: 1.5,
                  width: 72,
                  flexShrink: 0,
                  color: 'primary.main',
                  '& .MuiSlider-rail': { opacity: 0.25 },
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: `0 0 0 6px ${accentAlpha(0.25)}`,
                    },
                  },
                }}
              />
            </Box>
          </Box>

          <AccentPicker sx={{ ...controlButtonSx, px: 0 }} />

          <ControlTooltip
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            shortcut="F"
            align="end"
          >
            <ControlButton
              onClick={onToggleFullscreen}
              label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </ControlButton>
          </ControlTooltip>
        </Box>
      </Box>
    </Box>
  )
}
