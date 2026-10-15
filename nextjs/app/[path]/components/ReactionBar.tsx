import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import type { SxProps, Theme } from '@mui/material/styles'
import { accentAlpha } from '@/lib/theme'
import { REACTIONS, type Reaction } from '@/lib/watchRoomShared'
import ControlTooltip from './ControlTooltip'

// Centre-to-centre distance of the desktop buttons (40px + 2px gap).
export const REACTION_BUTTON_PITCH_PX = 42

interface Props {
  disabled?: boolean
  onReact: (emoji: Reaction) => void
  size?: 'sm' | 'lg'
  sx?: SxProps<Theme>
}

export default function ReactionBar({
  disabled,
  onReact,
  size = 'sm',
  sx = { display: 'flex', alignItems: 'center', gap: '2px' },
}: Props) {
  const large = size === 'lg'

  return (
    <Box sx={sx} role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji, i) => {
        const button = (
          <ButtonBase
            key={emoji}
            disabled={disabled}
            onClick={() => onReact(emoji)}
            aria-label={`React ${emoji}`}
            sx={{
              width: large ? 44 : 40,
              height: large ? 44 : 40,
              borderRadius: '50%',
              fontSize: large ? 24 : 22,
              lineHeight: 1,
              touchAction: 'manipulation',
              transition: 'transform 150ms, background-color 150ms',
              '&:hover, &.Mui-focusVisible': {
                bgcolor: accentAlpha(0.25),
              },
              '&:hover': { transform: 'translateY(-2px) scale(1.1)' },
              '&:active': { transform: 'scale(0.9)' },
              '&.Mui-disabled': { opacity: 0.4 },
            }}
          >
            {emoji}
          </ButtonBase>
        )
        return large ? (
          button
        ) : (
          <ControlTooltip key={emoji} label="React" shortcut={String(i + 1)}>
            {/* Disabled buttons fire no events, so the tooltip needs a wrapper. */}
            <Box component="span" sx={{ display: 'flex' }}>
              {button}
            </Box>
          </ControlTooltip>
        )
      })}
    </Box>
  )
}
