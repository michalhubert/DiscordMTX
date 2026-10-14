import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Geist } from 'next/font/google'
import { ACCENT_COOKIE, DEFAULT_ACCENT, isHexColor } from '@/lib/theme'
import ThemeRegistry from './ThemeRegistry'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DiscordMTX',
  description: 'Private stream viewer',
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieAccent = (await cookies()).get(ACCENT_COOKIE)?.value
  const initialAccent = isHexColor(cookieAccent) ? cookieAccent : DEFAULT_ACCENT

  return (
    <html lang="en" className={geist.variable}>
      <body>
        <ThemeRegistry initialAccent={initialAccent}>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
