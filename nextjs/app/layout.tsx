import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DiscordMTX',
  description: 'Private stream viewer',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 antialiased`}>
        {children}
      </body>
    </html>
  )
}
