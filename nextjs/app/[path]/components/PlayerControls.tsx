import type { ChangeEvent, ReactNode } from 'react'
import {
  Maximize,
  Minimize,
  Users,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { Reaction } from '@/lib/watchRoomShared'
import type {
  ConnectionQuality,
  ConnectionStats,
  ConnectionWarning,
} from '../hooks/useConnectionStats'
import ConnectionIndicator from './ConnectionIndicator'
import ControlTooltip from './ControlTooltip'
import ReactionBar from './ReactionBar'

interface Props {
  visible: boolean
  onHoldVisible: (hold: boolean) => void
  isLive: boolean
  isMuted: boolean
  volume: number
  isFullscreen: boolean
  onToggleMute: () => void
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void
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

function IconButton({
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2.5 text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95 aria-pressed:bg-white/15 aria-pressed:text-white"
    >
      {children}
    </button>
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
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute inset-x-0 bottom-0 z-20 hidden bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-20 transition-opacity duration-300 sm:block ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"
        onPointerEnter={() => onHoldVisible(true)}
        onPointerLeave={() => onHoldVisible(false)}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={`mr-2 flex h-6 items-center gap-1.5 rounded px-2 text-[11px] font-bold uppercase tracking-wider ${
              isLive ? 'bg-red-600 text-white' : 'bg-white/15 text-white/60'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full bg-white ${isLive ? 'animate-pulse' : 'opacity-60'}`}
            />
            {isLive ? 'Live' : 'Offline'}
          </span>

          <ControlTooltip
            label={viewersVisible ? 'Hide viewers' : 'Show viewers'}
            shortcut="V"
          >
            <IconButton
              onClick={onToggleViewers}
              label={`${viewerCount} watching - ${viewersVisible ? 'hide' : 'show'} viewer list`}
              pressed={viewersVisible}
            >
              <Users className="h-5 w-5" />
              <span className="min-w-[2ch] text-left text-sm font-semibold tabular-nums">
                {viewerCount > 0 ? viewerCount : '–'}
              </span>
            </IconButton>
          </ControlTooltip>

          <ConnectionIndicator quality={quality} stats={stats} warnings={warnings} />
        </div>

        <div className="rounded-full bg-white/[0.08] p-1 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <ReactionBar disabled={!canReact} onReact={onReact} />
        </div>

        <div className="flex items-center justify-end gap-1">
          <div className="group/volume flex items-center">
            <ControlTooltip label={isMuted ? 'Unmute' : 'Mute'} shortcut="M">
              <IconButton
                onClick={onToggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className="h-5 w-5" />
              </IconButton>
            </ControlTooltip>
            <div className="flex h-10 w-0 items-center overflow-hidden transition-[width] duration-200 ease-out group-hover/volume:w-24 group-focus-within/volume:w-24">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={level}
                onChange={onVolumeChange}
                aria-label="Volume"
                style={{
                  background: `linear-gradient(to right, #fff ${level * 100}%, rgba(255,255,255,0.25) ${level * 100}%)`,
                }}
                className="mx-2 block h-1 w-20 cursor-pointer appearance-none rounded-full focus-visible:outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
              />
            </div>
          </div>

          <ControlTooltip
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            shortcut="F"
            align="end"
          >
            <IconButton
              onClick={onToggleFullscreen}
              label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </IconButton>
          </ControlTooltip>
        </div>
      </div>
    </div>
  )
}
