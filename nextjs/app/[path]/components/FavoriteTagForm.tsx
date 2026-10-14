'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { accentAlpha } from '@/lib/theme'
import type { PonyChangeResult } from '../hooks/useWatchRoom'

interface Props {
  ponyName: string
  favoriteTag: string | null
  cooldownS: number
  busy: boolean
  onSubmit: (tag: string | null) => Promise<PonyChangeResult>
  onClose: () => void
}

// The Derpibooru tag a guest's avatar pictures must have, applied on top of the
// server's own tags.
export default function FavoriteTagForm({
  ponyName,
  favoriteTag,
  cooldownS,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(favoriteTag ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const disabled = busy || cooldownS > 0

  async function submit(tag: string | null) {
    setMessage(null)
    const result = await onSubmit(tag)
    if (!result.ok) {
      setMessage(result.error)
    } else if (result.favoriteTagMatched === false) {
      setMessage(
        `No pictures of ${ponyName} tagged "${tag}" yet - showing any picture of them.`,
      )
    } else {
      onClose()
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      onSubmit={(e) => {
        e.preventDefault()
        const tag = draft.trim()
        void submit(tag ? tag : null)
      }}
      style={{ overflow: 'hidden' }}
    >
      <Box
        sx={{
          mt: 0.75,
          pt: 1,
          px: 0.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: 11,
        }}
      >
        <Box
          component="label"
          htmlFor="favorite-tag"
          sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}
        >
          Favourite tag for your pictures
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <InputBase
            id="favorite-tag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
            placeholder="e.g. cute"
            autoFocus
            autoComplete="off"
            slotProps={{ input: { maxLength: 60, spellCheck: false } }}
            sx={{
              flex: 1,
              minWidth: 0,
              userSelect: 'text',
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.1)',
              px: 1,
              fontSize: 12,
              color: 'common.white',
              '&.Mui-focused': { boxShadow: `0 0 0 2px ${accentAlpha(0.7)}` },
              '& input': { py: 0.5 },
            }}
          />
          <IconButton
            type="submit"
            size="small"
            disabled={disabled}
            aria-label="Save favourite tag"
            title="Save favourite tag"
            sx={{
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.1)',
              color: 'common.white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            {busy ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Check size={14} />
            )}
          </IconButton>
        </Box>
        {message && (
          <Typography sx={{ fontSize: 11, lineHeight: 1.35, color: 'warning.light' }}>
            {message}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>{cooldownS > 0 ? `Can change in ${cooldownS}s` : ''}</span>
          {favoriteTag && (
            <ButtonBase
              disabled={disabled}
              onClick={() => {
                setDraft('')
                void submit(null)
              }}
              sx={{
                px: 0.5,
                borderRadius: 0.5,
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                textUnderlineOffset: 2,
                '&:hover': { color: 'common.white', textDecoration: 'underline' },
                '&.Mui-disabled': { opacity: 0.4 },
              }}
            >
              Remove &ldquo;{favoriteTag}&rdquo;
            </ButtonBase>
          )}
        </Box>
      </Box>
    </motion.form>
  )
}
