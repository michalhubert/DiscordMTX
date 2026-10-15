'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Radio } from 'lucide-react'
import AccentPicker from '@/app/components/AccentPicker'

export default function LoginForm({
  discordEnabled,
}: {
  discordEnabled: boolean
}) {
  const searchParams = useSearchParams()
  const isStreamerMode = searchParams.get('mode') === 'streamer'
  const callbackUrl =
    searchParams.get('callbackUrl') ?? (isStreamerMode ? '/dock' : '/')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn(
      isStreamerMode ? 'streamer-password' : 'viewer-password',
      { password, redirect: false },
    )
    setLoading(false)
    if (res?.error) {
      setError('Invalid password. Try again.')
    } else {
      window.location.href = callbackUrl
    }
  }

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
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 4 }}>
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

        {!isStreamerMode && discordEnabled && (
          <>
            <Button
              fullWidth
              variant="contained"
              color="discord"
              size="large"
              onClick={() => signIn('discord', { callbackUrl })}
            >
              Sign in with Discord
            </Button>
            <Divider sx={{ my: 2.5, typography: 'caption', color: 'text.disabled' }}>
              or
            </Divider>
          </>
        )}

        <Stack component="form" onSubmit={handleSubmit} spacing={2}>
          <TextField
            type="password"
            label={isStreamerMode ? 'Streamer Password' : 'Viewer Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isStreamerMode
                ? 'Enter streamer password'
                : 'Enter stream password'
            }
            required
            error={!!error}
            helperText={error || undefined}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            loading={loading}
            loadingPosition="start"
          >
            {loading
              ? 'Signing in…'
              : isStreamerMode
                ? 'Open Dock'
                : 'Watch Stream'}
          </Button>
        </Stack>

        {!isStreamerMode && (
          <Typography
            variant="caption"
            component="p"
            color="text.disabled"
            sx={{ mt: 3, textAlign: 'center' }}
          >
            Don&apos;t have Discord? Ask the streamer for the viewer password.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
