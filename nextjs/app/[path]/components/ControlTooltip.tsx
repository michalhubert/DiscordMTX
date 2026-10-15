import type { ReactElement } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'

interface Props {
  label: string
  shortcut?: string
  align?: 'start' | 'center' | 'end'
  children: ReactElement
}

const placement = {
  start: 'top-start',
  center: 'top',
  end: 'top-end',
} as const

export default function ControlTooltip({
  label,
  shortcut,
  align = 'center',
  children,
}: Props) {
  return (
    <Tooltip
      placement={placement[align]}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {label}
          {shortcut && (
            <Box
              component="kbd"
              sx={{
                borderRadius: 0.5,
                bgcolor: 'rgba(255,255,255,0.15)',
                px: 0.75,
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {shortcut}
            </Box>
          )}
        </Box>
      }
    >
      {children}
    </Tooltip>
  )
}
