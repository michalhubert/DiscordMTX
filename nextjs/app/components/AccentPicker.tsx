'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Check, Palette, Pipette, UserRound } from 'lucide-react'
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '@/lib/theme'
import { followsAvatar, useAccentScope, useThemeStore } from '@/lib/themeStore'

const SWATCH = 28

function Swatch({
  color,
  selected,
  label,
  onClick,
}: {
  color: string
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      sx={{
        width: SWATCH,
        height: SWATCH,
        borderRadius: '50%',
        bgcolor: color,
        color: '#fff',
        boxShadow: selected
          ? `0 0 0 2px var(--mui-palette-background-paper), 0 0 0 4px ${color}`
          : 'inset 0 0 0 1px rgba(255,255,255,0.15)',
        transition: 'transform 120ms, box-shadow 120ms',
        '&:hover': { transform: 'scale(1.1)' },
      }}
    >
      {selected && <Check size={14} strokeWidth={3} />}
    </ButtonBase>
  )
}

interface PopoverProps {
  anchorEl: HTMLElement | null
  onClose: () => void
}

export function AccentPickerPopover({ anchorEl, onClose }: PopoverProps) {
  const store = useThemeStore()
  const { avatarAccent, avatarAccentAvailable, followAvatarAccent } = store
  const studio = useAccentScope() === 'studio'
  const customAccent = studio ? store.studioAccent : store.customAccent
  const setCustomAccent = studio ? store.setStudioAccent : store.setCustomAccent
  const isCustom = studio || !followsAvatar(store)
  // The colour input fires on every drag tick; each commit rebuilds the theme.
  const [draft, setDraft] = useState<string | null>(null)
  const shownCustom = draft ?? customAccent
  const customIsPreset = ACCENT_PRESETS.includes(shownCustom.toLowerCase())

  useEffect(() => {
    if (draft === null) return
    const timeout = setTimeout(() => {
      setCustomAccent(draft)
      setDraft(null)
    }, 150)
    return () => clearTimeout(timeout)
  }, [draft, setCustomAccent])

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            mt: -1,
            p: 1.5,
            width: 232,
            border: 1,
            borderColor: 'divider',
          },
        },
      }}
    >
      <Typography variant="overline" color="text.secondary">
        Accent colour
      </Typography>

      {avatarAccentAvailable && (
        <ButtonBase
          onClick={followAvatarAccent}
          aria-pressed={!isCustom}
          sx={{
            mt: 0.5,
            mb: 1.5,
            width: '100%',
            justifyContent: 'flex-start',
            gap: 1.25,
            p: 1,
            borderRadius: 2,
            border: 1,
            borderColor: !isCustom ? 'primary.main' : 'divider',
            bgcolor: !isCustom ? 'action.selected' : 'transparent',
            textAlign: 'left',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: SWATCH,
              height: SWATCH,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: avatarAccent ?? DEFAULT_ACCENT,
              color: '#fff',
            }}
          >
            <UserRound size={15} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Match my avatar
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {avatarAccent ? 'Picked from your picture' : 'No colour found in your picture'}
            </Typography>
          </Box>
        </ButtonBase>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(6, ${SWATCH}px)`,
          justifyContent: 'space-between',
          rowGap: 1,
        }}
      >
        {ACCENT_PRESETS.map((color) => (
          <Swatch
            key={color}
            color={color}
            label={`Use ${color}`}
            selected={isCustom && customAccent.toLowerCase() === color}
            onClick={() => setCustomAccent(color)}
          />
        ))}
        <Tooltip title="Custom colour">
          <Box
            component="label"
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: SWATCH,
              height: SWATCH,
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#fff',
              background:
                isCustom && !customIsPreset
                  ? shownCustom
                  : 'conic-gradient(#ef4444, #f59e0b, #22c55e, #38bdf8, #8b5cf6, #ec4899, #ef4444)',
              boxShadow:
                isCustom && !customIsPreset
                  ? `0 0 0 2px var(--mui-palette-background-paper), 0 0 0 4px ${shownCustom}`
                  : 'none',
              '&:hover': { transform: 'scale(1.1)' },
              transition: 'transform 120ms',
            }}
          >
            <Pipette size={14} />
            <Box
              component="input"
              type="color"
              value={shownCustom}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Custom accent colour"
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
          </Box>
        </Tooltip>
      </Box>
    </Popover>
  )
}

export default function AccentPicker(props: Omit<IconButtonProps, 'onClick'>) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Tooltip title="Accent colour">
        <IconButton
          aria-label="Accent colour"
          {...props}
          onClick={(e: MouseEvent<HTMLElement>) => {
            e.stopPropagation()
            setAnchorEl(e.currentTarget)
          }}
        >
          <Palette size={props.size === 'small' ? 16 : 20} />
        </IconButton>
      </Tooltip>
      <AccentPickerPopover
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
      />
    </>
  )
}
