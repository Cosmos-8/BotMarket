import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BotMarket - Polymarket Bot Builder',
  description: 'No-code Polymarket trading bot builder and marketplace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

