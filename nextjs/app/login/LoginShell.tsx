'use client'

import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Radio } from 'lucide-react'
import AccentPicker from '@/app/components/AccentPicker'

export default function LoginShell({
  isStreamerMode = false,
  children,
}: {
  isStreamerMode?: boolean
  children: ReactNode
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{ p: 4, width: '100%', maxWidth: 384, borderRadius: 4 }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center', mb: 4 }}
        >
          <Box sx={{ display: 'flex', color: 'primary.main' }}>
            <Radio size={24} />
          </Box>
          <Typography
            variant="h6"
            component="h1"
            sx={{ fontWeight: 600, flex: 1, letterSpacing: '-0.01em' }}
          >
            DiscordMTX{isStreamerMode ? ' — Streamer' : ''}
          </Typography>
          <AccentPicker size="small" sx={{ color: 'text.secondary' }} />
        </Stack>

        {children}
      </Paper>
    </Box>
  )
}
