'use client'

import { AnimatePresence, motion } from 'motion/react'
import { REACTIONS, type WatchReaction } from '@/lib/watchRoomShared'
import { REACTION_BUTTON_PITCH_PX } from './ReactionBar'
import ViewerAvatar from './ViewerAvatar'

export type FloatingReaction = WatchReaction & {
  // Random offset and sway, so a burst of one emoji doesn't stack.
  jitter: number
  sway: number
  isSelf: boolean
}

export const FLOAT_DURATION_S = 3.2

interface Props {
  reactions: FloatingReaction[]
}

// Offset from the player's centre of this emoji's button in the (centred) reaction bar.
function buttonOffset(emoji: WatchReaction['emoji']): number {
  const index = REACTIONS.indexOf(emoji)
  return (index - (REACTIONS.length - 1) / 2) * REACTION_BUTTON_PITCH_PX
}

export default function FloatingReactions({ reactions }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden
    >
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            className="absolute bottom-14"
            style={{
              left: `calc(50% + ${buttonOffset(r.emoji) + r.jitter}px)`,
              // Scale from the bottom so it grows out of its button.
              originX: 0,
              originY: 1,
            }}
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              y: '-55vh',
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.25, 1, 1],
              x: [0, r.sway, -r.sway * 0.6, r.sway * 0.3],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: FLOAT_DURATION_S,
              ease: 'easeOut',
              opacity: { duration: FLOAT_DURATION_S, times: [0, 0.1, 0.75, 1] },
              scale: { duration: 0.5, times: [0, 0.6, 1, 1] },
              x: { duration: FLOAT_DURATION_S, ease: 'easeInOut' },
            }}
          >
            {/* Centring lives here since motion owns the outer transform */}
            <div className="relative -translate-x-1/2">
              <span className="block text-4xl leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {r.emoji}
              </span>
              <span
                title={r.isSelf ? 'You' : r.from.name}
                className={`absolute -bottom-1 -right-2 rounded-full shadow-md ${
                  r.isSelf ? 'ring-2 ring-white' : 'ring-2 ring-black/60'
                }`}
              >
                <ViewerAvatar viewer={r.from} className="h-[18px] w-[18px]" />
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
