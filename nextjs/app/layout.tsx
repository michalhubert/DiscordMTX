import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Geist } from 'next/font/google'
import { ACCENT_COOKIES, DEFAULT_ACCENT, isHexColor } from '@/lib/theme'
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
  const cookieAccent = (name: string) => {
    const value = cookieStore.get(name)?.value
    return isHexColor(value) ? value : DEFAULT_ACCENT
  }
  const initialAccents = {
    viewer: cookieAccent(ACCENT_COOKIES.viewer),
    studio: cookieAccent(ACCENT_COOKIES.studio),
  }

  return (
    <html lang="en" className={geist.variable}>
      <body>
        <ThemeRegistry initialAccents={initialAccents}>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
