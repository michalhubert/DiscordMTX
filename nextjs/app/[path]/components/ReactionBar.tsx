import { REACTIONS, type Reaction } from '@/lib/watchRoomShared'
import ControlTooltip from './ControlTooltip'

// Centre-to-centre distance of the desktop buttons (w-10 + gap-0.5).
export const REACTION_BUTTON_PITCH_PX = 42

interface Props {
  disabled?: boolean
  onReact: (emoji: Reaction) => void
  size?: 'sm' | 'lg'
  className?: string
}

export default function ReactionBar({
  disabled,
  onReact,
  size = 'sm',
  className = 'flex items-center gap-0.5',
}: Props) {
  const buttonSize =
    size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-10 w-10 text-[22px]'

  return (
    <div className={className} role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji, i) => {
        const button = (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onReact(emoji)}
            aria-label={`React ${emoji}`}
            className={`${buttonSize} flex items-center justify-center rounded-full leading-none transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:scale-110 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-90 disabled:pointer-events-none disabled:opacity-40 touch-manipulation`}
          >
            {emoji}
          </button>
        )
        return size === 'sm' ? (
          <ControlTooltip key={emoji} label="React" shortcut={String(i + 1)}>
            {button}
          </ControlTooltip>
        ) : (
          button
        )
      })}
    </div>
  )
}
