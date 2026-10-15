'use client'

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { ACCENT_COOKIES, createAppTheme, type AccentScope } from '@/lib/theme'
import { resolveAccent, useAccentScope, useThemeStore } from '@/lib/themeStore'

const ONE_YEAR_S = 60 * 60 * 24 * 365
const subscribeNever = () => () => {}

interface Props {
  // Accents from the cookies, so the server render already has the right colour.
  initialAccents: Record<AccentScope, string>
  children: ReactNode
}

export default function ThemeRegistry({ initialAccents, children }: Props) {
  const scope = useAccentScope()
  const storedAccent = useThemeStore((s) => resolveAccent(s, scope))
  // The persisted store only exists in the browser: keep the server's accent
  // until mounted so hydration matches.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const accent = mounted ? storedAccent : initialAccents[scope]

  useEffect(() => {
    if (!mounted) return
    document.cookie = `${ACCENT_COOKIES[scope]}=${encodeURIComponent(accent)}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`
  }, [accent, mounted, scope])

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
