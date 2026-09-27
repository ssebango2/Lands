import type { Metadata } from 'next'
import { ALL_CARD_IMAGES } from '@/lib/cardImages'
import './globals.css'

export const metadata: Metadata = {
  title: 'Basic Lands Game Simulator',
  description: 'Magic: The Gathering Basic Lands Card Game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* All six images are small; fetching them up front (even from the lobby) means no card pops in late. */}
        {ALL_CARD_IMAGES.map((src) => (
          <link key={src} rel="preload" as="image" href={src} type="image/webp" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  )
}
