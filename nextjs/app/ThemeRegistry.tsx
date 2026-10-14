'use client'

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { ACCENT_COOKIE, createAppTheme } from '@/lib/theme'
import { resolveAccent, useThemeStore } from '@/lib/themeStore'

const ONE_YEAR_S = 60 * 60 * 24 * 365
const subscribeNever = () => () => {}

interface Props {
  // Accent from the cookie, so the server render already has the right colour.
  initialAccent: string
  children: ReactNode
}

export default function ThemeRegistry({ initialAccent, children }: Props) {
  const storedAccent = useThemeStore(resolveAccent)
  // The persisted store only exists in the browser: keep the server's accent
  // until mounted so hydration matches.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const accent = mounted ? storedAccent : initialAccent

  useEffect(() => {
    if (!mounted) return
    document.cookie = `${ACCENT_COOKIE}=${encodeURIComponent(accent)}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`
  }, [accent, mounted])

  const theme = useMemo(() => createAppTheme(accent), [accent])

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
