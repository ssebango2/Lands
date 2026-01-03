import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}


