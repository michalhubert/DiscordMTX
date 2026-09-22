import type { ChangeEvent } from 'react'
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react'

interface Props {
  visible: boolean
  isMuted: boolean
  volume: number
  isFullscreen: boolean
  onToggleMute: () => void
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void
  onToggleFullscreen: () => void
}

export default function PlayerControls({
  visible,
  isMuted,
  volume,
  isFullscreen,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
}: Props) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute bottom-0 left-0 right-0 hidden sm:flex items-center justify-end gap-4 px-4 py-4 bg-gradient-to-t from-black/70 to-transparent transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        onClick={onToggleMute}
        className="text-white hover:text-gray-300 transition-colors p-2 -m-2 touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]"
        title={isMuted ? 'Unmute' : 'Mute'}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <VolumeX className="w-7 h-7" />
        ) : (
          <Volume2 className="w-7 h-7" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={isMuted ? 0 : volume}
        onChange={onVolumeChange}
        className="w-28 h-2 accent-white cursor-pointer"
        title="Volume"
        aria-label="Volume"
      />

      <button
        onClick={onToggleFullscreen}
        className="text-white hover:text-gray-300 transition-colors p-2 -m-2 touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize className="w-7 h-7" />
        ) : (
          <Maximize className="w-7 h-7" />
        )}
      </button>
    </div>
  )
}
