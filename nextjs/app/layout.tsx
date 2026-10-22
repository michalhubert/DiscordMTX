import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Geist } from 'next/font/google'
import {
  ACCENT_COOKIES,
  DEFAULT_ACCENT,
  isHexColor,
  LEGACY_ACCENT_COOKIES,
  type AccentScope,
} from '@/lib/theme'
import ThemeRegistry from './ThemeRegistry'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'MTXcord',
  description: 'Private stream viewer',
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const cookieAccent = (scope: AccentScope) => {
    const value =
      cookieStore.get(ACCENT_COOKIES[scope])?.value ??
      cookieStore.get(LEGACY_ACCENT_COOKIES[scope])?.value
    return isHexColor(value) ? value : DEFAULT_ACCENT
  }
  const initialAccents = {
    viewer: cookieAccent('viewer'),
    studio: cookieAccent('studio'),
  }

  return (
    <html lang="en" className={geist.variable}>
      <body>
        <ThemeRegistry initialAccents={initialAccents}>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
