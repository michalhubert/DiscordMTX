'use client'

import Box from '@mui/material/Box'
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
    <Box
      aria-hidden
      sx={{
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            style={{
              position: 'absolute',
              bottom: 56,
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
            <Box sx={{ position: 'relative', transform: 'translateX(-50%)' }}>
              <Box
                component="span"
                sx={{
                  display: 'block',
                  fontSize: 36,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
                }}
              >
                {r.emoji}
              </Box>
              <Box
                component="span"
                title={r.isSelf ? 'You' : r.from.name}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -8,
                  display: 'flex',
                  borderRadius: '50%',
                  boxShadow: r.isSelf
                    ? '0 0 0 2px #fff'
                    : '0 0 0 2px rgba(0,0,0,0.6)',
                }}
              >
                <ViewerAvatar viewer={r.from} size={18} />
              </Box>
            </Box>
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  )
}
